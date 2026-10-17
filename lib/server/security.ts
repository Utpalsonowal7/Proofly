import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { query } from "./db";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
export const token = () => randomBytes(32).toString("base64url");
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
export const SESSION_COOKIE = "proofly_session";
export function applicationUrl() {
  if (!process.env.APP_URL && process.env.NODE_ENV === "production")
    throw new ApiError(503, "The workspace is not configured yet. Please contact its owner.");
  const url = new URL(process.env.APP_URL ?? "http://localhost:3000");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !local)
  )
    throw new ApiError(503, "A secure application URL is required.");
  return url.origin;
}
export function verifyOrigin(request: Request) {
  if (
    request.headers.get("origin") !== applicationUrl() ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new ApiError(403, "This request must come from your Proofly workspace.");
  if (
    !request.headers.get("content-type")?.toLowerCase().startsWith("application/json") &&
    request.method !== "DELETE"
  )
    throw new ApiError(415, "Send this request as JSON.");
}
export function readCookie(request: Request, name = SESSION_COOKIE) {
  const entry = request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`));
  return entry?.slice(name.length + 1);
}
export function sessionCookie(value: string, clear = false) {
  const secure = applicationUrl().startsWith("https:");
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 604800}${secure ? "; Secure" : ""}`;
}
function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, encoded] = stored.split(":");
  if (
    algorithm !== "scrypt" ||
    !/^[0-9a-f]{32}$/.test(salt ?? "") ||
    !/^[0-9a-f]{128}$/.test(encoded ?? "")
  )
    return false;
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, Buffer.from(encoded, "hex"));
}
export async function jsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "A JSON request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw new ApiError(413, "This request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "This request contains invalid JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(
      422,
      parsed.error.issues[0]?.message ?? "Please check the details and try again.",
    );
  return parsed.data;
}
export function clientAddress(request: Request) {
  // X-Real-IP is overwritten by the supplied Nginx proxy. Do not trust caller-controlled forwarding chains.
  return process.env.TRUST_PROXY === "true"
    ? request.headers.get("x-real-ip")?.slice(0, 64) || "unknown"
    : "unproxied";
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const result = await query<{ hits: number; retry: number }>(
    `INSERT INTO rate_limits (key, hits, resets_at) VALUES ($1, 1, now() + $2 * interval '1 second')
    ON CONFLICT (key) DO UPDATE SET hits = CASE WHEN rate_limits.resets_at <= now() THEN 1 ELSE rate_limits.hits + 1 END,
    resets_at = CASE WHEN rate_limits.resets_at <= now() THEN now() + $2 * interval '1 second' ELSE rate_limits.resets_at END
    RETURNING hits, greatest(1, ceil(extract(epoch FROM resets_at - now())))::int AS retry`,
    [tokenHash(key), seconds],
  );
  if (result.rows[0].hits > limit)
    throw new ApiError(
      429,
      "A little pause. Please try again in a few minutes.",
      result.rows[0].retry,
    );
}
