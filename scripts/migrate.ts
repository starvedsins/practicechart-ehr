import "dotenv/config";
import { Pool } from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
});
const target = new URL(
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!,
);
if (!/^practicechart[_a-z0-9]+$/.test(target.pathname.slice(1)))
  throw Error("Migrations require a separate PracticeChart database.");
const c = await pool.connect();
try {
  await c.query("SELECT pg_advisory_lock(4001002)");
  await c.query(
    "CREATE TABLE IF NOT EXISTS migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const file of (await readdir("migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(`migrations/${file}`, "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    const old = await c.query("SELECT sha256 FROM migrations WHERE name=$1", [
      file,
    ]);
    if (old.rowCount) {
      if (old.rows[0].sha256 !== hash)
        throw Error(`Migration changed: ${file}`);
      continue;
    }
    await c.query("BEGIN");
    try {
      await c.query(sql);
      await c.query("INSERT INTO migrations(name,sha256) VALUES($1,$2)", [
        file,
        hash,
      ]);
      await c.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
  }
} finally {
  await c.query("SELECT pg_advisory_unlock(4001002)");
  c.release();
  await pool.end();
}
