import "dotenv/config";
import { Pool } from "pg";
import { put, list, del } from "@vercel/blob";
import { mkdir, writeFile } from "node:fs/promises";
import { readPrivateFile } from "../src/lib/storage";
import { pgTool, recoveryKeys, encryptBundle, sha } from "./recovery-lib";
const url = process.env.DATABASE_URL_UNPOOLED!;
if (!new URL(url).pathname.startsWith("/practicechart"))
  throw Error("Backup must use a separate PracticeChart database.");
const pool = new Pool({ connectionString: url });
const c = await pool.connect();
const createdAt = new Date().toISOString();
const fileName = createdAt.replaceAll(":", "-") + ".pcbackup";
try {
  await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const snapshot = (await c.query("SELECT pg_export_snapshot() AS snapshot"))
    .rows[0].snapshot;
  const docs = (
    await c.query("SELECT id,pathname,sha256 FROM documents ORDER BY id")
  ).rows as { id: string; pathname: string; sha256: string }[];
  const tables = (
    await c.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows as { tablename: string }[];
  const counts: Record<string, number> = {};
  const rowHashes: Record<string, string> = {};
  for (const { tablename } of tables) {
    if (!/^[a-z_]+$/.test(tablename)) throw Error("Unknown table name.");
    counts[tablename] = Number(
      (await c.query(`SELECT count(*) FROM ${tablename}`)).rows[0].count,
    );
    const rows = (
      await c.query(
        `SELECT row_to_json(t)::text AS row FROM ${tablename} t ORDER BY row_to_json(t)::text`,
      )
    ).rows;
    rowHashes[tablename] = sha(
      Buffer.from(rows.map((r: { row: string }) => r.row).join("\n")),
    );
  }
  const dump = await pgTool("pg_dump", url, [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    "--snapshot=" + snapshot,
    "--lock-wait-timeout=20s",
  ]);
  const files = [];
  for (const doc of docs) {
    const bytes = await readPrivateFile(doc.pathname);
    if (sha(bytes) !== doc.sha256)
      throw Error("A diagnostic file failed its integrity check.");
    files.push({ ...doc, bytes: bytes.toString("base64") });
  }
  await c.query("COMMIT");
  const payload = Buffer.from(
    JSON.stringify({
      format: "practicechart-full-ehr-v1",
      createdAt,
      database: new URL(url).pathname.slice(1),
      counts,
      rowHashes,
      dumpSha256: sha(dump),
      dump: dump.toString("base64"),
      files,
    }),
  );
  const publicKey = process.env.BACKUP_PUBLIC_KEY
    ? Buffer.from(process.env.BACKUP_PUBLIC_KEY, "base64").toString()
    : await recoveryKeys();
  const encrypted = encryptBundle(payload, publicKey);
  const directory = process.env.BACKUP_DIRECTORY || "backups";
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/${fileName}`, encrypted, { flag: "wx" });
  let pathname = `local:${fileName}`;
  if (process.env.STORAGE_DRIVER === "blob") {
    const r = await put("practicechart/backups/" + fileName, encrypted, {
      access: "private",
      contentType: "application/octet-stream",
      addRandomSuffix: false,
    });
    pathname = r.pathname;
    const older = (await list({ prefix: "practicechart/backups/" })).blobs.sort(
      (a, b) => b.uploadedAt.valueOf() - a.uploadedAt.valueOf(),
    );
    for (const old of older.slice(7)) await del(old.url);
  }
  await pool.query(
    "INSERT INTO backup_runs(status,pathname) VALUES('complete',$1)",
    [pathname],
  );
  console.log(
    JSON.stringify({
      status: "complete",
      kind: "full EHR database and uploaded files",
      file: `${directory}/${fileName}`,
      tables: tables.length,
      documents: files.length,
      encrypted: true,
    }),
  );
} catch (e) {
  await c.query("ROLLBACK").catch(() => {});
  await pool
    .query("INSERT INTO backup_runs(status) VALUES('failed')")
    .catch(() => {});
  throw e;
} finally {
  c.release();
  await pool.end();
}
