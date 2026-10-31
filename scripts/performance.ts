import "dotenv/config";
import { Pool } from "pg";
import { chromium } from "@playwright/test";
import { cpus, totalmem, platform, release } from "node:os";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { hashPassword } from "../src/lib/auth";
const base = process.env.PERF_BASE_URL || "http://localhost:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("The load test requires a local presentation server.");
const duration = Number(process.env.PERF_SECONDS || 30);
if (duration < 10 || duration > 300)
  throw Error("Use a duration from 10 to 300 seconds per load.");
const owner = new URL(process.env.DATABASE_URL_UNPOOLED!);
if (!["localhost", "127.0.0.1"].includes(owner.hostname))
  throw Error("The load fixture script requires a local database.");
const pool = new Pool({ connectionString: owner.toString() });
const hash = await hashPassword("LoadDemo!2026");
await pool.query(
  "INSERT INTO users(username,name,role,password_hash) SELECT 'load_'||lpad(n::text,2,'0'),'Fictional Load Tester '||n,'doctor',$1 FROM generate_series(1,50)n ON CONFLICT(username) DO NOTHING",
  [hash],
);
await pool.query(
  "INSERT INTO patients(first_name,last_name,dob,phone,address) SELECT 'Load','Fictional '||lpad(n::text,4,'0'),'1990-01-01','876-555-0100','Fictional load test address' FROM generate_series(1,1000)n WHERE NOT EXISTS(SELECT 1 FROM patients WHERE first_name='Load')",
);
const dataset = {
  patients: Number(
    (await pool.query("SELECT count(*) FROM patients")).rows[0].count,
  ),
  clinicalRevisions: Number(
    (await pool.query("SELECT count(*) FROM clinical_revisions")).rows[0].count,
  ),
};
const version = (await pool.query("SELECT version()")).rows[0].version;
const target = (
  await pool.query(
    "SELECT id,first_name,last_name FROM patients WHERE first_name='Lena' LIMIT 1",
  )
).rows[0];
await pool.end();
const browser = await chromium.launch();
const results = [];
function summary(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    samples: values.length,
    minMs: Number((sorted[0] || 0).toFixed(2)),
    p50Ms: Number((sorted[Math.floor(sorted.length * 0.5)] || 0).toFixed(2)),
    p95Ms: Number(
      (
        sorted[
          Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)
        ] || 0
      ).toFixed(2),
    ),
    maxMs: Number((sorted.at(-1) || 0).toFixed(2)),
  };
}
for (const concurrent of [1, 10, 50]) {
  const cookies: string[] = [];
  for (let i = 1; i < concurrent; i++) {
    const r = await fetch(base + "/api/login", {
      method: "POST",
      headers: { origin: base, "content-type": "application/json" },
      body: JSON.stringify({
        username: "load_" + String(i).padStart(2, "0"),
        password: "LoadDemo!2026",
      }),
    });
    if (!r.ok) throw Error("Load account login failed.");
    cookies.push(r.headers.get("set-cookie")!.split(";")[0]);
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto(base + "/login");
  await page
    .getByLabel("Username", { exact: true })
    .fill("load_" + String(concurrent).padStart(2, "0"));
  await page.getByLabel("Password", { exact: true }).fill("LoadDemo!2026");
  const apiTimes: number[] = [],
    uiTimes: number[] = [];
  let errors = 0;
  const until = performance.now() + duration * 1000;
  let requests = 0;
  const workers = cookies.map(async (cookie) => {
    while (performance.now() < until) {
      for (const endpoint of [
        "/api/patients?q=Lena",
        "/api/patients/" + target.id,
      ]) {
        const start = performance.now();
        try {
          const r = await fetch(base + endpoint, { headers: { cookie } });
          await r.arrayBuffer();
          requests++;
          if (!r.ok) errors++;
          apiTimes.push(performance.now() - start);
        } catch {
          errors++;
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  });
  const start = performance.now();
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/app");
  await page.getByRole("heading", { name: "Patient worklist" }).waitFor();
  const uiLoginMs = performance.now() - start;
  let first = true;
  let coldRecordMs = 0;
  while (performance.now() < until) {
    const start = performance.now();
    try {
      await page.goto(base + "/app/patients/" + target.id);
      await page
        .getByRole("heading", {
          name: target.first_name + " " + target.last_name,
          exact: true,
        })
        .first()
        .waitFor();
      await page.getByText("Medical record number", { exact: true }).waitFor();
      const elapsed = performance.now() - start;
      if (first) {
        coldRecordMs = elapsed;
        first = false;
      } else uiTimes.push(elapsed);
    } catch {
      errors++;
    }
    await page.waitForTimeout(1000);
  }
  await Promise.all(workers);
  results.push({
    concurrentSessions: concurrent,
    durationSeconds: duration,
    backgroundPattern:
      "Each background session requests patient search and patient detail, then waits 1 second.",
    uiPattern:
      "One authenticated browser opens the complete patient overview, then waits 1 second.",
    uiLoginMs: Number(uiLoginMs.toFixed(2)),
    firstRecordMs: Number(coldRecordMs.toFixed(2)),
    warmRecordDisplay: summary(uiTimes),
    api: summary(apiTimes),
    apiRequests: requests,
    errors,
    loginWithin3000ms: uiLoginMs < 3000,
    warmDisplaysWithin2000ms: uiTimes.filter((v) => v < 2000).length,
    totalWarmDisplays: uiTimes.length,
  });
  await context.close();
  console.log(`Measured ${concurrent} sessions. Errors: ${errors}.`);
}
await browser.close();
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const report = {
  testedAt: new Date().toISOString(),
  environment: {
    target: base,
    server: "Local Next.js production build",
    platform: platform(),
    osRelease: release(),
    cpu: cpus()[0].model,
    logicalCpuCount: cpus().length,
    memoryGiB: Number((totalmem() / 1024 ** 3).toFixed(1)),
    node: process.version,
    next: pkg.dependencies.next,
    postgres: version,
    driver: "pg through Drizzle; maximum 5 connections per process",
    network: "Same Windows host; PostgreSQL 18 in Docker Desktop via localhost",
    dataset,
  },
  results,
  limits: [
    "This is a local test, not a cloud capacity guarantee.",
    "First record request is reported separately from later requests.",
    "A browser sample includes rendering. API timings do not.",
    "Only one browser login is measured at each load.",
    "This short test does not prove 99 percent availability.",
  ],
};
await mkdir("docs/evidence", { recursive: true });
await writeFile(
  "docs/evidence/performance.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
