import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const result = JSON.parse(
  await readFile("docs/evidence/restore-result.json", "utf8"),
);
assert.match(result.retainedLocalDatabase, /^practicechart_restore_[0-9]+$/);
const owner = new URL(process.env.DATABASE_URL_UNPOOLED),
  runtime = new URL(process.env.DATABASE_URL);
assert.equal(owner.hostname, "localhost");
owner.pathname = "/" + result.retainedLocalDatabase;
runtime.pathname = owner.pathname;
const base = "http://localhost:3006";
const env = {
  ...process.env,
  DATABASE_URL_UNPOOLED: owner.toString(),
  DATABASE_URL: runtime.toString(),
  EHR_DATABASE_URL: runtime.toString(),
  PRIVATE_STORAGE_DIR: ".private/restore-test/" + result.retainedLocalDatabase,
  APP_URL: base,
};
const grant = spawnSync(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "scripts/grant-runtime.ts"],
  { env, stdio: "ignore" },
);
assert.equal(grant.status, 0);
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", "3006"],
  { env, stdio: "ignore", windowsHide: true },
);
const browser = await chromium.launch();
try {
  for (let i = 0; i < 30; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const page = await browser.newPage();
  await page.goto(base + "/login");
  await page.getByLabel("Username", { exact: true }).fill("doctor");
  await page.getByLabel("Password", { exact: true }).fill("DoctorDemo!2026");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/app");
  const people = await (
    await page.request.get(base + "/api/patients?q=Lena")
  ).json();
  assert.ok(people.length);
  const detail = await (
    await page.request.get(base + "/api/patients/" + people[0].id)
  ).json();
  assert.ok(detail.clinical.length);
  const docs = await (await page.request.get(base + "/api/documents")).json();
  assert.ok(docs.length);
  const file = await page.request.get(base + "/api/documents/" + docs[0].id);
  assert.equal(file.status(), 200);
  assert.equal((await file.body()).subarray(0, 5).toString(), "%PDF-");
  await page.context().clearCookies();
  await page.goto(base + "/login");
  await page.getByLabel("Username", { exact: true }).fill("frontdesk");
  await page.getByLabel("Password", { exact: true }).fill("DeskDemo!2026");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/app");
  assert.equal((await page.request.get(base + "/api/intakes")).status(), 200);
  assert.equal(
    (await page.request.get(base + "/api/documents/" + docs[0].id)).status(),
    403,
  );
  await writeFile(
    "docs/evidence/recovery-browser.json",
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        status: "passed",
        target: "isolated restored local database and file folder",
        checks: [
          "restored doctor login",
          "patient search",
          "clinical history",
          "private restored file bytes",
          "restored receptionist login",
          "restored registration intake table",
          "receptionist private-file denial",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Restored application browser check passed.");
} finally {
  await browser.close();
  server.kill();
}
