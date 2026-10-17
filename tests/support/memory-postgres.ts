import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";

/** PostgreSQL WASM fallback for environments without a database daemon. CI uses a PostgreSQL service. */
export async function memoryPostgres(): Promise<Pool> {
  const db = await PGlite.create();
  let tail = Promise.resolve();
  async function acquire() {
    let unlock!: () => void;
    const previous = tail;
    tail = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    await previous;
    return unlock;
  }
  async function run(sql: string, values: unknown[] = []) {
    const result =
      !values.length && sql.includes(";")
        ? (await db.exec(sql)).at(-1)!
        : await db.query(sql, values);
    return {
      rows: result?.rows ?? [],
      rowCount: result?.rows.length || result?.affectedRows || 0,
      command: "",
      fields: result?.fields ?? [],
      oid: 0,
    };
  }
  return {
    async query(sql: string, values: unknown[] = []) {
      const release = await acquire();
      try {
        return await run(sql, values);
      } finally {
        release();
      }
    },
    async connect() {
      const release = await acquire();
      return { query: run, release };
    },
    async end() {
      await db.close();
    },
    on() {},
  } as unknown as Pool;
}
