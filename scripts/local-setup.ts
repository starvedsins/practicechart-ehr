import { existsSync, copyFileSync } from "node:fs";
import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";
if (!existsSync(".env")) copyFileSync(".env.example", ".env");
config({ quiet: true });
const owner = new URL(process.env.DATABASE_URL_UNPOOLED!);
if (!["localhost", "127.0.0.1"].includes(owner.hostname))
  throw Error("Local setup requires a local database URL.");
const docker = spawnSync("docker", ["compose", "up", "-d", "--wait"], {
  stdio: "inherit",
  windowsHide: true,
});
if (docker.status !== 0) process.exit(docker.status ?? 1);
const pool = new Pool({ connectionString: owner.toString() });
const exists = await pool.query(
  "SELECT 1 FROM pg_roles WHERE rolname='practicechart_app'",
);
if (!exists.rowCount) {
  const password = decodeURIComponent(
    new URL(process.env.DATABASE_URL!).password,
  ).replaceAll("'", "''");
  await pool.query(
    `CREATE ROLE practicechart_app LOGIN PASSWORD '${password}'`,
  );
}
await pool.end();
for (const script of ["migrate", "grant-runtime", "seed"]) {
  const r = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", `scripts/${script}.ts`],
    { stdio: "inherit", windowsHide: true },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log("Local practice is ready. Run npm run dev.");
