import { loadEnvFile } from "node:process";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import pg from "pg";

for (const file of [".env", ".env.local"]) {
  try {
    loadEnvFile(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before running migrations.");
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
const client = await pool.connect();
try {
  await client.query("SELECT pg_advisory_lock(728433100)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum char(64) NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const directory = new URL("../db/migrations/", import.meta.url);
  for (const name of (await readdir(directory)).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = await readFile(new URL(name, directory), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query("SELECT checksum FROM schema_migrations WHERE name = $1", [
      name,
    ]);
    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum)
        throw new Error(
          `Migration ${name} changed after being applied. Add a new migration instead.`,
        );
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(name, checksum) VALUES ($1, $2)", [
        name,
        checksum,
      ]);
      await client.query("COMMIT");
      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  console.log("Database is up to date.");
} finally {
  await client.query("SELECT pg_advisory_unlock(728433100)").catch(() => {});
  client.release();
  await pool.end();
}
