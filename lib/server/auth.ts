import type { PoolClient } from "pg";
import type { Role, User } from "../types";
import { query } from "./db";
import { ApiError, tokenHash, tokenPattern } from "./security";

export type Session = {
  user: User;
  workspace: { id: string; name: string; role: Role };
  tokenHash: string;
};
export async function getSession(value?: string): Promise<Session | null> {
  if (!value || !tokenPattern.test(value)) return null;
  const result = await query(
    `SELECT u.id, u.name, u.email, w.id AS workspace_id, w.name AS workspace_name, m.role
    FROM sessions s JOIN users u ON u.id = s.user_id
    JOIN workspaces w ON w.id = u.current_workspace_id JOIN memberships m ON m.workspace_id = w.id AND m.user_id = u.id
    WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash(value)],
  );
  const row = result.rows[0];
  return row
    ? {
        user: { id: row.id, name: row.name, email: row.email },
        workspace: { id: row.workspace_id, name: row.workspace_name, role: row.role },
        tokenHash: tokenHash(value),
      }
    : null;
}
export function editor(session: Session) {
  if (session.workspace.role === "viewer")
    throw new ApiError(403, "An editor can make this change. You have view and comment access.");
}
export function owner(session: Session) {
  if (session.workspace.role !== "owner")
    throw new ApiError(403, "Only the workspace owner can make this change.");
}
export async function projectAccess(session: Session, id: string, client?: PoolClient) {
  const result = await query(
    "SELECT * FROM projects WHERE id = $1 AND workspace_id = $2",
    [id, session.workspace.id],
    client,
  );
  if (!result.rowCount) throw new ApiError(404, "This project could not be found.");
  return result.rows[0];
}
export async function versionAccess(
  session: Session,
  id: string,
  client?: PoolClient,
  lock = false,
) {
  const result = await query(
    `SELECT v.*, a.project_id, a.current_version_id, p.workspace_id, p.name AS project_name FROM asset_versions v
    JOIN assets a ON a.id = v.asset_id JOIN projects p ON p.id = a.project_id
    WHERE v.id = $1 AND p.workspace_id = $2 AND v.state = 'ready' ${lock ? "FOR UPDATE OF a" : ""}`,
    [id, session.workspace.id],
    client,
  );
  if (!result.rowCount) throw new ApiError(404, "This version could not be found.");
  return result.rows[0];
}
