import { loadEnvFile } from "node:process";
import pg from "pg";
for (const file of [".env", ".env.local"]) {
  try {
    loadEnvFile(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before running maintenance.");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("DELETE FROM sessions WHERE expires_at < now()");
  await client.query("DELETE FROM rate_limits WHERE resets_at < now() - interval '1 day'");
  await client.query("DELETE FROM invitations WHERE expires_at < now() - interval '30 days'");
  await client.query("DELETE FROM review_links WHERE expires_at < now() - interval '30 days'");
  await client.query(
    "DELETE FROM asset_versions WHERE state = 'uploading' AND created_at < now() - interval '1 day'",
  );
  await client.query(
    "DELETE FROM assets WHERE current_version_id IS NULL AND NOT EXISTS (SELECT 1 FROM asset_versions v WHERE v.asset_id = assets.id)",
  );
  await client.query("COMMIT");
  console.log("Expired sessions, limits, links, invitations, and abandoned reservations removed.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
