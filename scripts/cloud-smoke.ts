import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.argv[2];
if (!base?.startsWith("https://"))
  throw Error("Supply the HTTPS deployment URL.");
let bypass = "";
try {
  if (!process.argv.includes("--public"))
    bypass = (await readFile(".private/preview-bypass", "utf8")).trim();
} catch {}
const browser = await chromium.launch();
const checks = [];
for (const role of ["doctor", "frontdesk"]) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass } : {},
  });
  const page = await context.newPage();
  await page.goto(base + "/login");
  await page.getByLabel("Username", { exact: true }).fill(role);
  await page
    .getByLabel("Password", { exact: true })
    .fill(role === "doctor" ? "DoctorDemo!2026" : "DeskDemo!2026");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/app", { timeout: 60000 });
  await page.getByRole("heading", { name: "Patient worklist" }).waitFor();
  const people = await context.request.get(base + "/api/patients");
  assert.equal(people.status(), 200);
  const list = await people.json();
  assert.ok(list.length >= 12);
  const patient = list.find(
    (p: { firstName: string }) => p.firstName === "Lena",
  );
  assert.ok(patient);
  const detail = await (
    await context.request.get(base + "/api/patients/" + patient.id)
  ).json();
  if (role === "doctor") {
    assert.ok(Array.isArray(detail.clinical));
    const docs = await (
      await context.request.get(base + "/api/documents")
    ).json();
    const d = await context.request.get(base + "/api/documents/" + docs[0].id);
    assert.equal(d.status(), 200);
    assert.equal((await d.body()).subarray(0, 5).toString(), "%PDF-");
    assert.ok(d.headers()["cache-control"].includes("no-store"));
    const sample = await context.request.get(base + "/api/sample-report");
    const bytes = await sample.body();
    const up = await context.request.post(base + "/api/documents", {
      headers: { origin: base },
      multipart: {
        patientId: patient.id,
        title: "Fictional cloud verification report",
        kind: "Lab report",
        file: {
          name: "sample.pdf",
          mimeType: "application/pdf",
          buffer: bytes,
        },
      },
    });
    assert.equal(up.status(), 201);
    const uploaded = await up.json();
    const exact = await context.request.get(
      base + "/api/documents/" + uploaded.id,
    );
    assert.deepEqual(await exact.body(), bytes);
    checks.push(
      "doctor clinical history and exact private cloud file round trip",
    );
  } else {
    assert.equal(detail.clinical, undefined);
    assert.equal(detail.documents, undefined);
    for (const path of [
      "documents",
      "users",
      "audit",
      "reports/history?id=" + patient.id,
    ])
      assert.equal(
        (await context.request.get(base + "/api/" + path)).status(),
        403,
      );
    checks.push(
      "front desk demographic access with denied clinical, file, staff, and audit routes",
    );
  }
  await context.close();
}
await browser.close();
await mkdir("docs/evidence", { recursive: true });
await writeFile(
  process.env.CLOUD_SMOKE_EVIDENCE_PATH ||
    (process.argv.includes("--public")
      ? "docs/evidence/cloud-smoke-production.json"
      : "docs/evidence/cloud-smoke.json"),
  JSON.stringify(
    {
      testedAt: new Date().toISOString(),
      deployment: base,
      access: bypass
        ? "Deployment protection bypass used for preview checks"
        : "Public deployment",
      checks,
      status: "passed",
    },
    null,
    2,
  ),
);
console.log("Cloud browser smoke checks passed for both roles.");
