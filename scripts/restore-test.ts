import "dotenv/config";
import { Pool } from "pg";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { decryptBundle, pgTool, sha } from "./recovery-lib";
type Bundle = {
  format: string;
  createdAt: string;
  counts: Record<string, number>;
  rowHashes: Record<string, string>;
  dumpSha256: string;
  dump: string;
  files: { id: string; pathname: string; sha256: string; bytes: string }[];
};
const directory = process.env.BACKUP_DIRECTORY || "backups";
const source =
  process.argv[2] ||
  `${directory}/${(await readdir(directory))
    .filter((n) => n.endsWith(".pcbackup"))
    .sort()
    .at(-1)}`;
const privateKey = await readFile(
  process.env.BACKUP_PRIVATE_KEY_FILE || ".private/recovery.key",
  "utf8",
);
const payload = JSON.parse(
  decryptBundle(await readFile(source), privateKey).toString(),
) as Bundle;
assert.equal(payload.format, "practicechart-full-ehr-v1");
const owner = new URL(
  process.env.RESTORE_ADMIN_URL ||
    "postgresql://practicechart:local-owner-password@localhost:5438/practicechart_ehr",
);
if (!["localhost", "127.0.0.1"].includes(owner.hostname))
  throw Error("Restore tests must use an isolated local database.");
const name = "practicechart_restore_" + Date.now();
const admin = new Pool({ connectionString: owner.toString() });
await admin.query(`CREATE DATABASE ${name}`);
const target = new URL(owner);
target.pathname = "/" + name;
const start = performance.now();
const dump = Buffer.from(payload.dump, "base64");
assert.equal(sha(dump), payload.dumpSha256);
await pgTool(
  "pg_restore",
  target.toString(),
  ["--no-owner", "--no-privileges", "--exit-on-error", "--single-transaction"],
  dump,
);
const restored = new Pool({ connectionString: target.toString() });
try {
  for (const [t, count] of Object.entries(payload.counts)) {
    if (!/^[a-z_]+$/.test(t)) throw Error("Invalid manifest table.");
    assert.equal(
      Number((await restored.query(`SELECT count(*) FROM ${t}`)).rows[0].count),
      count,
      `Row count: ${t}`,
    );
    const rows = (
      await restored.query(
        `SELECT row_to_json(t)::text AS row FROM ${t} t ORDER BY row_to_json(t)::text`,
      )
    ).rows;
    assert.equal(
      sha(Buffer.from(rows.map((r: { row: string }) => r.row).join("\n"))),
      payload.rowHashes[t],
      `All restored values: ${t}`,
    );
  }
  const root = path.resolve(".private/restore-test", name);
  for (const f of payload.files) {
    assert.match(
      f.pathname,
      /^practicechart\/(records|preview)\/[a-f0-9-]{36}$/,
    );
    const b = Buffer.from(f.bytes, "base64");
    assert.equal(sha(b), f.sha256);
    await mkdir(path.dirname(path.join(root, f.pathname)), { recursive: true });
    await writeFile(path.join(root, f.pathname), b);
    assert.equal(sha(await readFile(path.join(root, f.pathname))), f.sha256);
  }
  await assert.rejects(
    restored.query("UPDATE clinical_revisions SET reason='overwrite test'"),
  );
  await assert.rejects(restored.query("DELETE FROM audit_events"));
  const a = (
    await restored.query(
      "SELECT * FROM appointments WHERE status IN('confirmed','arrived','in_consultation') LIMIT 1",
    )
  ).rows[0];
  if (a)
    await assert.rejects(
      restored.query(
        "INSERT INTO appointments(patient_id,doctor_id,start_at,end_at) VALUES($1,$2,$3,$4)",
        [a.patient_id, a.doctor_id, a.start_at, a.end_at],
      ),
    );
  const maximum = Number(
    (
      await restored.query(
        "SELECT coalesce(max(substring(mrn FROM 4)::bigint),0) AS n FROM patients",
      )
    ).rows[0].n,
  );
  const next = Number(
    (await restored.query("SELECT nextval('mrn_seq') AS n")).rows[0].n,
  );
  assert.ok(next > maximum, "MRN sequence remains ahead of existing records");
  const invoiceMaximum = Number(
    (
      await restored.query(
        "SELECT coalesce(max(substring(number FROM 5)::bigint),0) AS n FROM invoices",
      )
    ).rows[0].n,
  );
  const invoiceNext = Number(
    (await restored.query("SELECT nextval('invoice_seq') AS n")).rows[0].n,
  );
  assert.ok(
    invoiceNext > invoiceMaximum,
    "Invoice sequence remains ahead of existing records",
  );
  const result = {
    status: "passed",
    testedAt: new Date().toISOString(),
    sourceCreatedAt: payload.createdAt,
    kind: "Full EHR database and uploaded files",
    restoreTarget: "isolated local PostgreSQL 18 database",
    durationSeconds: Number(((performance.now() - start) / 1000).toFixed(3)),
    tablesCompared: Object.keys(payload.counts).length,
    documentsVerified: payload.files.length,
    checks: [
      "table row counts",
      "all restored row values, including MRNs and clinical revisions",
      "uploaded file hashes and bytes",
      "clinical history protection",
      "audit history protection",
      "overlapping appointment rejection",
      "MRN sequence",
      "invoice sequence",
    ],
    retainedLocalDatabase: name,
  };
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    "docs/evidence/restore-result.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await restored.end();
  await admin.end();
}
