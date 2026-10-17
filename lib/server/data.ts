import { randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type { Asset, Comment, Project, ReviewData, WorkspaceData } from "../types";
import type { Session } from "./auth";
import { query } from "./db";
import { ApiError, tokenHash, tokenPattern } from "./security";

export function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}
export function presentProject(p: QueryResultRow): Project {
  return {
    id: p.id,
    name: p.name,
    client: p.client,
    description: p.description,
    color: p.color,
    dueDate: p.due_date
      ? p.due_date instanceof Date
        ? p.due_date.toISOString().slice(0, 10)
        : p.due_date
      : null,
    archived: p.archived,
    createdAt: iso(p.created_at),
  };
}
export function presentComment(c: QueryResultRow): Comment {
  return {
    id: c.id,
    versionId: c.version_id,
    authorId: c.author_id,
    authorName: c.author_name,
    body: c.body,
    x: c.x,
    y: c.y,
    parentId: c.parent_id,
    resolved: c.resolved,
    createdAt: iso(c.created_at),
  };
}
export async function recordEvent(
  workspaceId: string,
  title: string,
  detail: string,
  client?: PoolClient,
) {
  await query(
    "INSERT INTO events(id, workspace_id, title, detail) VALUES($1,$2,$3,$4)",
    [randomUUID(), workspaceId, title, detail],
    client,
  );
}
async function filesAndComments(
  workspaceId: string,
  projectId?: string,
  reviewToken?: string,
): Promise<{ assets: Asset[]; comments: Comment[] }> {
  const values = projectId ? [workspaceId, projectId] : [workspaceId];
  const scope = projectId ? "AND p.id = $2" : "";
  const versions = await query(
    `SELECT a.id AS asset_id, a.project_id, a.name, v.* FROM assets a
    JOIN projects p ON p.id = a.project_id JOIN asset_versions v ON v.asset_id = a.id
    WHERE p.workspace_id = $1 AND v.state = 'ready' ${scope} ORDER BY a.created_at DESC, v.version_number ASC`,
    values,
  );
  const assets = new Map<string, Asset>();
  for (const v of versions.rows) {
    if (!assets.has(v.asset_id))
      assets.set(v.asset_id, {
        id: v.asset_id,
        projectId: v.project_id,
        name: v.name,
        versions: [],
      });
    assets.get(v.asset_id)!.versions.push({
      id: v.id,
      number: v.version_number,
      previewUrl: reviewToken
        ? `/api/reviews/${reviewToken}/versions/${v.id}/preview`
        : `/api/versions/${v.id}/preview`,
      width: v.width,
      height: v.height,
      byteSize: v.byte_size,
      contentType: v.content_type,
      createdAt: iso(v.created_at),
      decision: v.decision,
    });
  }
  const comments = await query(
    `SELECT c.* FROM comments c JOIN asset_versions v ON v.id = c.version_id JOIN assets a ON a.id = v.asset_id
    JOIN projects p ON p.id = a.project_id WHERE p.workspace_id = $1 AND v.state = 'ready' ${scope} ORDER BY c.created_at ASC`,
    values,
  );
  return { assets: [...assets.values()], comments: comments.rows.map(presentComment) };
}
export async function loadWorkspace(session: Session): Promise<WorkspaceData> {
  const [projects, members, files, events, available] = await Promise.all([
    query("SELECT * FROM projects WHERE workspace_id = $1 ORDER BY created_at DESC", [
      session.workspace.id,
    ]),
    query(
      "SELECT u.id, u.name, u.email, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = $1 ORDER BY m.role, u.name",
      [session.workspace.id],
    ),
    filesAndComments(session.workspace.id),
    query(
      'SELECT id, title, detail, created_at AS "createdAt" FROM events WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100',
      [session.workspace.id],
    ),
    query(
      "SELECT w.id, w.name, m.role FROM memberships m JOIN workspaces w ON w.id = m.workspace_id WHERE m.user_id = $1 ORDER BY w.created_at",
      [session.user.id],
    ),
  ]);
  return {
    user: session.user,
    workspace: session.workspace,
    workspaces: available.rows as WorkspaceData["workspaces"],
    projects: projects.rows.map(presentProject),
    members: members.rows as WorkspaceData["members"],
    ...files,
    activity: events.rows.map((e) => ({
      ...e,
      createdAt: iso(e.createdAt),
    })) as WorkspaceData["activity"],
  };
}
export async function reviewLink(value: string, client?: PoolClient) {
  if (!tokenPattern.test(value))
    throw new ApiError(404, "This review link is no longer available.");
  const result = await query(
    `SELECT l.*, p.workspace_id, w.name AS workspace_name FROM review_links l JOIN projects p ON p.id = l.project_id JOIN workspaces w ON w.id = p.workspace_id
    WHERE l.token_hash = $1 AND NOT l.revoked AND l.expires_at > now() ${client ? "FOR SHARE OF l" : ""}`,
    [tokenHash(value)],
    client,
  );
  if (!result.rowCount)
    throw new ApiError(
      404,
      "This review link has expired or was revoked. Ask the project owner for a fresh link.",
    );
  return result.rows[0];
}
export async function loadReview(value: string): Promise<ReviewData> {
  const link = await reviewLink(value);
  const project = (await query("SELECT * FROM projects WHERE id = $1", [link.project_id])).rows[0];
  return {
    project: presentProject(project),
    ...(await filesAndComments(link.workspace_id, link.project_id, value)),
    allowComments: link.allow_comments,
    workspaceName: link.workspace_name,
  };
}
export async function invitation(value: string) {
  if (!tokenPattern.test(value)) throw new ApiError(404, "This invitation is no longer available.");
  const result = await query(
    `SELECT i.*, w.name AS workspace_name, u.name AS inviter_name FROM invitations i JOIN workspaces w ON w.id = i.workspace_id JOIN users u ON u.id = i.created_by
    WHERE i.token_hash = $1 AND i.used_at IS NULL AND i.expires_at > now()`,
    [tokenHash(value)],
  );
  if (!result.rowCount)
    throw new ApiError(404, "This invitation has expired or has already been used.");
  return result.rows[0];
}
