import { Pool, type PoolClient, type QueryResultRow } from "pg";

let pool: Pool | undefined;
export function setDatabaseForTesting(value: Pool) {
  if (process.env.NODE_ENV !== "test") throw new Error("Database substitution is available only to tests.");
  pool = value;
}
export function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 10000 });
    pool.on("error", () => console.error("An idle database connection was interrupted."));
  }
  return pool;
}
export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = [], client?: PoolClient) { return (client ?? database()).query<T>(sql, values); }
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect();
  try { await client.query("BEGIN"); const result = await fn(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
export async function closeDatabase() { await pool?.end(); pool = undefined; }
