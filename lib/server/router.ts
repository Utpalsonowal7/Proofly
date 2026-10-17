import { randomUUID } from "node:crypto";
import { z } from "zod";
import { editor, getSession, owner, projectAccess, versionAccess } from "./auth";
import { invitation, iso, loadReview, loadWorkspace, presentComment, presentProject, recordEvent, reviewLink } from "./data";
import { query, transaction } from "./db";
import { ApiError, applicationUrl, clientAddress, hashPassword, jsonBody, rateLimit, readCookie, sessionCookie, token, tokenHash, tokenPattern, verifyOrigin, verifyPassword } from "./security";
import { asUploadRecord, s3Storage, type Storage } from "./storage";
import { commentSchema, decisionSchema, id, loginSchema, projectSchema, projectUpdateSchema, registrationSchema, shareSchema, uploadSchema } from "./validation";
import type { PoolClient, QueryResultRow } from "pg";

const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(value, { status, headers: { "Cache-Control": "no-store", ...headers } });
const uuid = (value: string) => { if (!id.safeParse(value).success) throw new ApiError(404, "This item could not be found."); return value; };
async function authenticated(request: Request) { const session = await getSession(readCookie(request)); if (!session) throw new ApiError(401, "Your session has ended. Sign in to continue."); return session; }
async function createSession(userId: string, client: PoolClient) {
  const value = token();
  await query("DELETE FROM sessions WHERE user_id = $1 AND expires_at <= now()", [userId], client);
  await query("INSERT INTO sessions(token_hash, user_id, expires_at) VALUES($1,$2,now() + interval '7 days')", [tokenHash(value), userId], client);
  return value;
}
async function addComment(version: QueryResultRow, user: { id: string | null; name: string }, values: z.infer<typeof commentSchema>, client: PoolClient) {
  if (values.parentId) {
    const parent = await query("SELECT id FROM comments WHERE id = $1 AND version_id = $2 AND parent_id IS NULL", [values.parentId, version.id], client);
    if (!parent.rowCount) throw new ApiError(404, "This conversation could not be found on this version.");
  }
  const result = await query("INSERT INTO comments(id, version_id, author_id, author_name, body, x, y, parent_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *", [randomUUID(), version.id, user.id, user.name, values.body, values.x, values.y, values.parentId ?? null], client);
  await recordEvent(version.workspace_id, `${user.name} left feedback`, version.project_name, client);
  return presentComment(result.rows[0]);
}
async function setDecision(version: QueryResultRow, decision: string, name: string, client: PoolClient) {
  if (version.current_version_id !== version.id) throw new ApiError(409, "A newer version is available. Review the latest version before making a decision.");
  await query("UPDATE asset_versions SET decision = $1 WHERE id = $2", [decision, version.id], client);
  await recordEvent(version.workspace_id, `${name} ${decision === "approved" ? "approved a version" : "requested changes"}`, `${version.project_name} · Version ${version.version_number}`, client);
}
async function sharedVersion(value: string, versionId: string, client?: PoolClient, lock = false) {
  const link = await reviewLink(value, client);
  const result = await query(`SELECT v.*, a.current_version_id, p.workspace_id, p.name AS project_name FROM asset_versions v JOIN assets a ON a.id = v.asset_id
    JOIN projects p ON p.id = a.project_id WHERE v.id = $1 AND a.project_id = $2 AND v.state = 'ready' ${lock ? "FOR UPDATE OF a" : ""}`, [uuid(versionId), link.project_id], client);
  if (!result.rowCount) throw new ApiError(404, "This version is not part of this review.");
  return { link, version: result.rows[0] };
}

/** The Next.js route delegates here so the same authorization paths can be tested against PostgreSQL. */
export async function handleApi(request: Request, storage: Storage = s3Storage): Promise<Response> {
  try {
    const result = await route(request, storage);
    return request.method === "HEAD" ? new Response(null, { status: result.status, headers: result.headers }) : result;
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status, error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {});
    const code = (error as { code?: string }).code;
    if (code === "23505") return json({ error: "These details are already in use. Sign in or choose different details." }, 409);
    if (["ECONNREFUSED", "ENOTFOUND", "57P01", "53300"].includes(code ?? "") || (error as Error).message === "DATABASE_URL is not configured") return json({ error: "The workspace is temporarily unavailable. Its owner may need to finish the database setup." }, 503);
    console.error("A workspace request failed.", { name: (error as Error).name, code: code ?? "unknown" });
    return json({ error: "Something interrupted this request. Please try again." }, 500);
  }
}

async function route(request: Request, storage: Storage): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const method = request.method === "HEAD" ? "GET" : request.method;
  if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) throw new ApiError(405, "This request method is not supported.");
  if (method !== "GET") verifyOrigin(request);
  if (path.join("/") === "health/live" && method === "GET") return json({ status: "ok", service: "proofly" });
  if (path.join("/") === "health" && method === "GET") {
    await query("SELECT 1");
    const ready = Boolean(process.env.S3_BUCKET && process.env.AWS_REGION);
    return json({ status: ready ? "ready" : "setup_required", database: "connected", storage: ready ? "configured" : "not_configured" }, ready ? 200 : 503);
  }

  if (path[0] === "auth" && path.length === 2) {
    if (path[1] === "logout" && method === "POST") {
      const value = readCookie(request); if (value && tokenPattern.test(value)) await query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(value)]);
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", true) });
    }
    if (["register", "login"].includes(path[1]) && method === "POST") {
      await rateLimit(`auth-ip:${clientAddress(request)}`, 20, 900);
      if (path[1] === "register") {
        const values = await jsonBody(request, registrationSchema);
        await rateLimit(`auth-email:${values.email}`, 6, 900);
        const passwordHash = await hashPassword(values.password);
        const session = await transaction(async client => {
          const userId = randomUUID(), workspaceId = randomUUID();
          await query("INSERT INTO users(id,name,email,password_hash) VALUES($1,$2,$3,$4)", [userId, values.name, values.email, passwordHash], client);
          await query("INSERT INTO workspaces(id,name) VALUES($1,$2)", [workspaceId, `${values.name.split(" ")[0]}'s workspace`], client);
          await query("INSERT INTO memberships(user_id, workspace_id, role) VALUES($1,$2,'owner')", [userId, workspaceId], client);
          await query("UPDATE users SET current_workspace_id = $1 WHERE id = $2", [workspaceId, userId], client);
          await recordEvent(workspaceId, "A fresh workspace is ready", `Welcome, ${values.name}. Let’s make something good.`, client);
          return createSession(userId, client);
        });
        return json({ ok: true }, 201, { "Set-Cookie": sessionCookie(session) });
      }
      const values = await jsonBody(request, loginSchema);
      await rateLimit(`auth-email:${values.email}`, 8, 900);
      const result = await query("SELECT id, password_hash FROM users WHERE email = $1", [values.email]);
      const row = result.rows[0];
      const valid = await verifyPassword(values.password, row?.password_hash ?? `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`);
      if (!row || !valid) throw new ApiError(401, "That email and password don’t match. Give it another try.");
      const session = await transaction(client => createSession(row.id, client));
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(session) });
    }
  }

  if (path[0] === "reviews" && path[1]) {
    const value = path[1];
    await rateLimit(`review-ip:${clientAddress(request)}`, method === "GET" ? 180 : 40, 60);
    if (path.length === 2 && method === "GET") return json(await loadReview(value));
    if (path[2] === "versions" && path[3]) {
      if (path[4] === "preview" && path.length === 5 && method === "GET") {
        const { version } = await sharedVersion(value, path[3]);
        return new Response(null, { status: 307, headers: { Location: await storage.preview(asUploadRecord(version), url.searchParams.get("download") === "1"), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
      }
      if (path[4] === "comments" && path.length === 5 && method === "POST") {
        const values = await jsonBody(request, commentSchema);
        if (!values.authorName) throw new ApiError(422, "Add your name so the team knows who left feedback.");
        return json(await transaction(async client => {
          const { link, version } = await sharedVersion(value, path[3], client);
          if (!link.allow_comments) throw new ApiError(403, "This review link allows viewing only.");
          return addComment(version, { id: null, name: values.authorName! }, values, client);
        }), 201);
      }
      if (path.length === 4 && method === "PATCH") {
        const values = await jsonBody(request, decisionSchema);
        if (!values.authorName) throw new ApiError(422, "Add your name before making a review decision.");
        await transaction(async client => { const { link, version } = await sharedVersion(value, path[3], client, true); if (!link.allow_comments) throw new ApiError(403, "This review link allows viewing only."); await setDecision(version, values.decision, values.authorName!, client); });
        return json({ ok: true });
      }
    }
    throw new ApiError(404, "This review could not be found.");
  }

  const session = await authenticated(request);
  if (method !== "GET") await rateLimit(`workspace-write:${session.user.id}`, 120, 60);
  if (path[0] === "workspace") {
    if (path.length === 1 && method === "GET") return json(await loadWorkspace(session));
    if (path.length === 1 && method === "PATCH") {
      owner(session); const values = await jsonBody(request, z.object({ name: z.string().trim().min(2).max(80) }));
      await query("UPDATE workspaces SET name = $1 WHERE id = $2", [values.name, session.workspace.id]); return json({ ok: true });
    }
    if (path[1] === "switch" && path.length === 2 && method === "POST") {
      const values = await jsonBody(request, z.object({ workspaceId: id }));
      const member = await query("SELECT 1 FROM memberships WHERE workspace_id = $1 AND user_id = $2", [values.workspaceId, session.user.id]);
      if (!member.rowCount) throw new ApiError(404, "This workspace could not be found.");
      await query("UPDATE users SET current_workspace_id = $1 WHERE id = $2", [values.workspaceId, session.user.id]); return json({ ok: true });
    }
  }
  if (path[0] === "projects") {
    if (path.length === 1 && method === "POST") {
      editor(session); const values = await jsonBody(request, projectSchema);
      const project = await transaction(async client => { const result = await query("INSERT INTO projects(id, workspace_id, name, client, description, color, due_date) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *", [randomUUID(), session.workspace.id, values.name, values.client, values.description, values.color, values.dueDate], client); await recordEvent(session.workspace.id, `${session.user.name} created a project`, values.name, client); return presentProject(result.rows[0]); });
      return json(project, 201);
    }
    if (path[1]) {
      const project = await projectAccess(session, uuid(path[1]));
      if (path.length === 2 && method === "PATCH") {
        editor(session); const values = await jsonBody(request, projectUpdateSchema);
        const columns = { name: "name", client: "client", description: "description", color: "color", dueDate: "due_date", archived: "archived" };
        const entries = Object.entries(values) as [keyof typeof columns, unknown][];
        if (!entries.length) throw new ApiError(422, "Choose a project detail to update.");
        const result = await query(`UPDATE projects SET ${entries.map(([key], i) => `${columns[key]} = $${i + 1}`).join(", ")} WHERE id = $${entries.length + 1} AND workspace_id = $${entries.length + 2} RETURNING *`, [...entries.map(([, v]) => v), project.id, session.workspace.id]);
        return json(presentProject(result.rows[0]));
      }
      if (path[2] === "review-links" && path.length === 3) {
        editor(session);
        if (method === "GET") { const links = await query("SELECT id, expires_at, allow_comments, revoked FROM review_links WHERE project_id = $1 ORDER BY created_at DESC LIMIT 50", [project.id]); return json(links.rows.map(l => ({ id: l.id, expiresAt: iso(l.expires_at), allowComments: l.allow_comments, revoked: l.revoked }))); }
        if (method === "POST") { const values = await jsonBody(request, shareSchema), value = token(); await query("INSERT INTO review_links(id, project_id, token_hash, allow_comments, expires_at, created_by) VALUES($1,$2,$3,$4,now() + $5 * interval '1 day',$6)", [randomUUID(), project.id, tokenHash(value), values.allowComments, values.expiresInDays, session.user.id]); return json({ url: `${applicationUrl()}/review/${value}` }, 201); }
      }
    }
  }
  if (path[0] === "review-links" && path.length === 2 && method === "DELETE") {
    editor(session); const result = await query("UPDATE review_links l SET revoked = true FROM projects p WHERE p.id = l.project_id AND p.workspace_id = $1 AND l.id = $2", [session.workspace.id, uuid(path[1])]);
    if (!result.rowCount) throw new ApiError(404, "This review link could not be found."); return json({ ok: true });
  }

  if (path[0] === "uploads") {
    editor(session);
    if (path.length === 1 && method === "POST") {
      const values = await jsonBody(request, uploadSchema); await projectAccess(session, values.projectId); await rateLimit(`uploads:${session.workspace.id}`, 60, 3600);
      const record = await transaction(async client => {
        let assetId = values.assetId;
        if (assetId) { const asset = await query("SELECT id FROM assets WHERE id = $1 AND project_id = $2 FOR UPDATE", [assetId, values.projectId], client); if (!asset.rowCount) throw new ApiError(404, "This file could not be found in this project."); }
        else { assetId = randomUUID(); await query("INSERT INTO assets(id,project_id,name) VALUES($1,$2,$3)", [assetId, values.projectId, values.filename.replace(/\.[^.]+$/, "") || "Untitled design"], client); }
        const number = (await query("SELECT coalesce(max(version_number),0) + 1 AS number FROM asset_versions WHERE asset_id = $1", [assetId], client)).rows[0].number;
        const versionId = randomUUID(); const uploadKey = `staging/${session.workspace.id}/${versionId}`; const storageKey = `workspaces/${session.workspace.id}/assets/${assetId}/${versionId}`;
        const result = await query("INSERT INTO asset_versions(id,asset_id,version_number,storage_key,upload_key,content_type,byte_size,width,height,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *", [versionId, assetId, number, storageKey, uploadKey, values.contentType, values.byteSize, values.width, values.height, session.user.id], client);
        return asUploadRecord({ ...result.rows[0], workspace_id: session.workspace.id });
      });
      return json({ id: record.id, ...await storage.prepare(record) }, 201);
    }
    if (path.length === 3 && path[2] === "complete" && method === "POST") {
      const versionId = uuid(path[1]);
      await transaction(async client => {
        const result = await query(`SELECT v.*, p.workspace_id, p.name AS project_name FROM asset_versions v JOIN assets a ON a.id = v.asset_id JOIN projects p ON p.id = a.project_id
          WHERE v.id = $1 AND p.workspace_id = $2 AND v.created_by = $3 FOR UPDATE OF a, v`, [versionId, session.workspace.id, session.user.id], client);
        const version = result.rows[0]; if (!version) throw new ApiError(404, "This upload could not be found."); if (version.state === "ready") return;
        if (new Date(version.created_at).getTime() < Date.now() - 1800000) throw new ApiError(410, "This upload reservation expired. Please start a fresh upload.");
        const dimensions = await storage.finalize(asUploadRecord(version));
        await query("UPDATE asset_versions SET state = 'ready', width = $2, height = $3 WHERE id = $1", [version.id, dimensions.width, dimensions.height], client);
        await query("UPDATE assets SET current_version_id = $1 WHERE id = $2 AND (current_version_id IS NULL OR (SELECT version_number FROM asset_versions WHERE id = current_version_id) < $3)", [version.id, version.asset_id, version.version_number], client);
        await recordEvent(session.workspace.id, `${session.user.name} uploaded a version`, `${version.project_name} · Version ${version.version_number}`, client);
      });
      return json({ ok: true });
    }
  }
  if (path[0] === "versions" && path[1]) {
    const versionId = uuid(path[1]);
    if (path.length === 3 && path[2] === "preview" && method === "GET") {
      const version = await versionAccess(session, versionId);
      return new Response(null, { status: 307, headers: { Location: await storage.preview(asUploadRecord(version), url.searchParams.get("download") === "1"), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    }
    if (path.length === 3 && path[2] === "comments" && method === "POST") {
      const values = await jsonBody(request, commentSchema);
      return json(await transaction(async client => { const version = await versionAccess(session, versionId, client); return addComment(version, session.user, values, client); }), 201);
    }
    if (path.length === 2 && method === "PATCH") {
      editor(session); const values = await jsonBody(request, decisionSchema);
      await transaction(async client => { const version = await versionAccess(session, versionId, client, true); await setDecision(version, values.decision, session.user.name, client); }); return json({ ok: true });
    }
  }
  if (path[0] === "comments" && path.length === 2 && method === "PATCH") {
    editor(session); const values = await jsonBody(request, z.object({ resolved: z.boolean() }));
    const result = await query(`UPDATE comments c SET resolved = $1 FROM asset_versions v, assets a, projects p
      WHERE c.id = $2 AND c.version_id = v.id AND v.asset_id = a.id AND a.project_id = p.id AND p.workspace_id = $3 AND c.parent_id IS NULL`, [values.resolved, uuid(path[1]), session.workspace.id]);
    if (!result.rowCount) throw new ApiError(404, "This conversation could not be found."); return json({ ok: true });
  }
  if (path[0] === "invites") {
    if (path.length === 1 && method === "POST") {
      owner(session); const values = await jsonBody(request, z.object({ role: z.enum(["editor", "viewer"]) })), value = token();
      await query("INSERT INTO invitations(id, workspace_id, token_hash, role, expires_at, created_by) VALUES($1,$2,$3,$4,now() + interval '7 days',$5)", [randomUUID(), session.workspace.id, tokenHash(value), values.role, session.user.id]);
      return json({ url: `${applicationUrl()}/join/${value}` }, 201);
    }
    if (path.length === 3 && path[2] === "accept" && method === "POST") {
      if (!tokenPattern.test(path[1])) throw new ApiError(404, "This invitation could not be found.");
      await transaction(async client => {
        const result = await query("SELECT * FROM invitations WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE", [tokenHash(path[1])], client);
        const invite = result.rows[0]; if (!invite) throw new ApiError(404, "This invitation has expired or was already used.");
        await query("INSERT INTO memberships(user_id,workspace_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [session.user.id, invite.workspace_id, invite.role], client);
        await query("UPDATE invitations SET used_at = now() WHERE id = $1", [invite.id], client);
        await query("UPDATE users SET current_workspace_id = $1 WHERE id = $2", [invite.workspace_id, session.user.id], client);
        await recordEvent(invite.workspace_id, `${session.user.name} joined the workspace`, "A fresh perspective is always welcome.", client);
      });
      return json({ ok: true });
    }
    if (path.length === 2 && method === "GET") { const invite = await invitation(path[1]); return json({ workspaceName: invite.workspace_name, inviterName: invite.inviter_name, role: invite.role }); }
  }
  throw new ApiError(404, "This page could not be found.");
}
