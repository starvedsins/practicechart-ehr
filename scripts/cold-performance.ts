import "dotenv/config";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const results = [];
const target = new URL(
  process.env.EHR_DATABASE_URL || process.env.DATABASE_URL!,
);
if (!["localhost", "127.0.0.1"].includes(target.hostname))
  throw Error("The process-cold test requires a local fictional database.");
for (let run = 0; run < 3; run++) {
  const port = 3002 + run;
  const base = `http://localhost:${port}`;
  const boot = performance.now();
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", String(port)],
    {
      env: { ...process.env, APP_URL: base },
      stdio: "ignore",
      windowsHide: true,
    },
  );
  const browser = await chromium.launch();
  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      ready = await fetch(base + "/api/health")
        .then((r) => r.ok)
        .catch(() => false);
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!ready) throw Error("The cold test server did not start.");
    const startupMs = performance.now() - boot;
    const page = await browser.newPage();
    await page.goto(base + "/login");
    await page.getByLabel("Username", { exact: true }).fill("doctor");
    await page.getByLabel("Password", { exact: true }).fill("DoctorDemo!2026");
    let start = performance.now();
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL("**/app");
    await page.getByRole("heading", { name: "Patient worklist" }).waitFor();
    const loginMs = performance.now() - start;
    const list = await (
      await page.request.get(base + "/api/patients?q=Lena")
    ).json();
    const patient = list.find(
      (p: { firstName: string }) => p.firstName === "Lena",
    );
    if (!patient) throw Error("The fictional benchmark patient was not found.");
    const records = [];
    for (let visit = 0; visit < 2; visit++) {
      if (visit) await page.goto(base + "/app/patients");
      start = performance.now();
      await page.goto(base + "/app/patients/" + patient.id);
      await page
        .getByRole("heading", {
          name: patient.firstName + " " + patient.lastName,
          exact: true,
        })
        .first()
        .waitFor();
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      records.push(Number((performance.now() - start).toFixed(2)));
    }
    results.push({
      run: run + 1,
      startupMs: Number(startupMs.toFixed(2)),
      loginMs: Number(loginMs.toFixed(2)),
      firstPatientDisplayMs: records[0],
      warmPatientDisplayMs: records[1],
    });
  } finally {
    await browser.close();
    server.kill();
  }
}
const evidence = {
  testedAt: new Date().toISOString(),
  method:
    "Three fresh local production Node processes and fresh Chromium sessions. A health probe precedes login. Each process shows one first patient display and one repeat display.",
  limits:
    "Process-cold measurements. PostgreSQL and operating system caches remain warm. This is not a Vercel cold start or a cold database test. Three samples do not establish a percentile guarantee.",
  environmentSource: "performance.json",
  results,
};
await writeFile(
  "docs/evidence/cold-performance.json",
  JSON.stringify(evidence, null, 2),
);
console.log(JSON.stringify(evidence, null, 2));
