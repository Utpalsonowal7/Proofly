import assert from "node:assert/strict";
import test from "node:test";
import {
  ApiError,
  hashPassword,
  jsonBody,
  readCookie,
  sessionCookie,
  token,
  tokenHash,
  verifyOrigin,
  verifyPassword,
} from "../lib/server/security";
import { commentSchema, projectSchema, uploadSchema } from "../lib/server/validation";
import { detectImageType, uploadConditions, type UploadRecord } from "../lib/server/storage";

process.env.APP_URL = "http://localhost:3000";
test("passwords use independent salts and reject incorrect or malformed hashes", async () => {
  const password = "a-long-and-unique-password";
  const first = await hashPassword(password),
    second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("a-different-password", first), false);
  assert.equal(await verifyPassword(password, "malformed"), false);
});
test("session tokens have enough entropy, are hashed, and cookies stay private", () => {
  const one = token(),
    two = token();
  assert.match(one, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(one, two);
  assert.equal(tokenHash(one).length, 64);
  assert.notEqual(tokenHash(one), one);
  assert.match(sessionCookie(one), /HttpOnly; SameSite=Lax/);
  assert.match(sessionCookie("", true), /Max-Age=0/);
  assert.equal(
    readCookie(
      new Request("http://localhost", {
        headers: { cookie: `other=1; proofly_session=${one}; last=2` },
      }),
    ),
    one,
  );
});
test("mutations reject cross-origin callers and non-JSON requests", () => {
  assert.throws(
    () =>
      verifyOrigin(
        new Request("http://localhost:3000/api/projects", {
          method: "POST",
          headers: { origin: "https://other.example", "content-type": "application/json" },
        }),
      ),
    (e: unknown) => e instanceof ApiError && e.status === 403,
  );
  assert.throws(
    () =>
      verifyOrigin(
        new Request("http://localhost:3000/api/projects", {
          method: "POST",
          headers: { origin: "http://localhost:3000", "content-type": "text/plain" },
        }),
      ),
    (e: unknown) => e instanceof ApiError && e.status === 415,
  );
  assert.doesNotThrow(() =>
    verifyOrigin(
      new Request("http://localhost:3000/api/projects", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      }),
    ),
  );
});
test("request bodies are bounded even without a Content-Length header", async () => {
  await assert.rejects(
    jsonBody(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ body: "x".repeat(17000) }),
      }),
      commentSchema,
    ),
    (e: unknown) => e instanceof ApiError && e.status === 413,
  );
});
test("pins use normalized coordinates and replies cannot pin themselves", () => {
  assert.equal(commentSchema.safeParse({ body: "A useful thought", x: 0, y: 1 }).success, true);
  assert.equal(
    commentSchema.safeParse({ body: "A useful thought", x: 1.01, y: 0.5 }).success,
    false,
  );
  assert.equal(commentSchema.safeParse({ body: "A useful thought", x: 0.5 }).success, false);
  assert.equal(
    commentSchema.safeParse({
      body: "A useful thought",
      x: 0.5,
      y: 0.5,
      parentId: "11111111-1111-4111-8111-111111111111",
    }).success,
    false,
  );
});
test("project dates must be real calendar dates", () => {
  assert.equal(projectSchema.safeParse({ name: "Launch", dueDate: "2026-02-30" }).success, false);
  assert.equal(projectSchema.safeParse({ name: "Launch", dueDate: "2028-02-29" }).success, true);
});
test("uploads reject executable formats, oversized files, and mismatched magic bytes", () => {
  const file = {
    projectId: "11111111-1111-4111-8111-111111111111",
    filename: "design.png",
    contentType: "image/png",
    byteSize: 200,
    width: 100,
    height: 100,
  };
  assert.equal(uploadSchema.safeParse(file).success, true);
  assert.equal(uploadSchema.safeParse({ ...file, contentType: "image/svg+xml" }).success, false);
  assert.equal(uploadSchema.safeParse({ ...file, byteSize: 20971521 }).success, false);
  assert.equal(detectImageType(Buffer.from("<svg onload='alert(1)'>")), null);
  assert.equal(detectImageType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "image/png");
  assert.equal(detectImageType(Buffer.from([255, 216, 255, 224])), "image/jpeg");
  assert.equal(detectImageType(Buffer.from("RIFF0000WEBP")), "image/webp");
});
test("presigned upload policy binds both content type and exact file length", () => {
  const record = {
    byteSize: 1024,
    contentType: "image/png",
    uploadKey: "staging/unique-version",
  } as UploadRecord;
  assert.deepEqual(uploadConditions(record), [
    ["content-length-range", 1024, 1024],
    ["eq", "$Content-Type", "image/png"],
    ["eq", "$key", "staging/unique-version"],
  ]);
});
