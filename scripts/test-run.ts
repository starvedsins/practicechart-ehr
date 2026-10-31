import "dotenv/config";
import { Pool } from "pg";
import { spawnSync } from "node:child_process";
const original = new URL(process.env.DATABASE_URL_UNPOOLED!);
if (!["localhost", "127.0.0.1"].includes(original.hostname))
  throw Error("Tests require a local Docker database.");
const p = new Pool({ connectionString: original.toString() });
await p.query("DROP DATABASE IF EXISTS practicechart_test WITH (FORCE)");
await p.query("CREATE DATABASE practicechart_test");
await p.end();
const owner = new URL(original);
owner.pathname = "/practicechart_test";
const runtime = new URL(process.env.DATABASE_URL!);
runtime.pathname = "/practicechart_test";
const env = {
  ...process.env,
  DATABASE_URL: runtime.toString(),
  DATABASE_URL_UNPOOLED: owner.toString(),
  PRIVATE_STORAGE_DIR: ".private/test-uploads",
  DEMO_MODE: "false",
  STORAGE_DRIVER: "local",
};
for (const args of [
  ["node_modules/tsx/dist/cli.mjs", "scripts/migrate.ts"],
  ["node_modules/tsx/dist/cli.mjs", "scripts/grant-runtime.ts"],
  ["node_modules/tsx/dist/cli.mjs", "scripts/seed.ts"],
  ["node_modules/vitest/vitest.mjs", "run", "--coverage"],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
