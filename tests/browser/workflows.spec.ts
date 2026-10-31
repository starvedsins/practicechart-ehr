import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.E2E_BASE_URL || "http://localhost:3000";
async function login(page: Page, role = "doctor") {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(role);
  await page
    .getByLabel("Password", { exact: true })
    .fill(role === "doctor" ? "DoctorDemo!2026" : "DeskDemo!2026");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/app");
  await expect(
    page.getByRole("heading", { name: "Today at the practice" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Patient worklist" }),
  ).toBeVisible();
}
async function screenshot(page: Page, name: string) {
  await mkdir("docs/screenshots", { recursive: true });
  if (name === "patient-registration") {
    await page.getByRole("dialog").screenshot({path: `docs/screenshots/${name}.png`});
    return;
  }
  await page.screenshot({
    path: `docs/screenshots/${name}.png`,
    fullPage: true,
  });
}
function futureDay(offset = 30) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
test("both roles complete registration, booking, clinical correction, filing, and invoice workflows", async ({
  page,
}) => {
  const suffix = Date.now().toString().slice(-7);
  const name = "Demo" + suffix;
  await login(page, "frontdesk");
  await screenshot(page, "front-desk-overview");
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Patients", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Register patient", exact: true })
    .click();
  await page.getByLabel("First name", { exact: true }).fill("Avery");
  await page.getByLabel("Last name", { exact: true }).fill(name);
  await page.getByLabel("Date of birth", { exact: true }).fill("1995-06-15");
  await page.getByLabel("Phone", { exact: true }).fill("876-555-0110");
  await page
    .getByLabel("Address", { exact: true })
    .fill("10 Fictional Lane, Demo Town");
  await screenshot(page, "patient-registration");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Register patient", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Avery " + name, exact: true }).first(),
  ).toBeVisible();
  const patientId = page.url().split("/").at(-1)!;
  await page
    .getByRole("button", { name: "Book appointment", exact: true })
    .first()
    .click();
  const booking = page.getByRole("dialog");
  await booking.getByLabel("Date", { exact: true }).fill(futureDay());
  await expect
    .poll(async () =>
      booking.getByLabel("Available start time").locator("option").count(),
    )
    .toBeGreaterThan(1);
  await booking.getByLabel("Available start time").selectOption({ index: 1 });
  await booking.getByRole("button", { name: "Review appointment" }).click();
  await expect(booking.getByText("Ready to confirm?")).toBeVisible();
  await screenshot(page, "appointment-confirmation");
  await booking.getByRole("button", { name: "Confirm appointment" }).click();
  await expect(booking).not.toBeVisible();
  await page
    .getByRole("button", { name: "Start walk-in visit", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Start visit", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("tab", { name: "Visits", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "File visit", exact: true }),
  ).toHaveCount(0);
  await page.context().clearCookies();
  await login(page);
  await page.goto("/app/patients/" + patientId);
  await page.getByRole("tab", { name: "Clinical record", exact: true }).click();
  await page
    .getByLabel("Symptoms and concerns")
    .fill("Fictional concern for a course test.");
  await page
    .getByLabel("Consultation notes")
    .fill("Fictional consultation note.");
  await page
    .getByLabel("Diagnosis", { exact: true })
    .fill("Fictional diagnosis entered by the doctor.");
  await page.getByLabel("Treatment record").fill("Fictional treatment record.");
  await page.getByRole("button", { name: "Add medicine" }).click();
  for (const [label, value] of Object.entries({
    Medication: "Sample medicine",
    Dosage: "Sample dose",
    Route: "Sample route",
    Frequency: "Sample frequency",
    Duration: "Sample duration",
    Quantity: "Sample quantity",
  }))
    await page.getByLabel(label, { exact: true }).fill(value);
  await page
    .getByLabel("Medical certificate text (optional)")
    .fill("This is a fictional certificate for a course test.");
  await page.getByLabel("Entry state").selectOption("final");
  await page.getByRole("button", { name: "Save clinical entry" }).click();
  await expect(
    page.getByRole("button", { name: "Save final correction" }),
  ).toBeVisible();
  await screenshot(page, "doctor-clinical-record");
  await page
    .getByLabel("Diagnosis", { exact: true })
    .fill("Corrected fictional diagnosis.");
  await page
    .getByLabel("Correction reason", { exact: true })
    .fill("Corrected a typing error in the fictional entry.");
  await page.getByRole("button", { name: "Save final correction" }).click();
  await expect(page.getByText("Revision 2", { exact: true })).toBeVisible();
  await expect(page.getByText("Revision 1", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Visits", exact: true }).click();
  const reportPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Prescription", exact: true }).click();
  const report = await reportPromise;
  await expect(
    report.getByRole("heading", { name: "Doctor-entered prescription" }),
  ).toBeVisible();
  await expect(
    report.getByRole("cell", { name: "Sample medicine", exact: true }),
  ).toBeVisible();
  await screenshot(report, "prescription");
  await report.close();
  await page.context().clearCookies();
  await login(page, "frontdesk");
  await page.goto("/app/patients/" + patientId);
  await expect(
    page.getByRole("tab", { name: "Clinical record", exact: true }),
  ).toHaveCount(0);
  const response = await page.request.get("/api/patients/" + patientId);
  const safe = await response.json();
  expect(safe).not.toHaveProperty("clinical");
  expect(safe).not.toHaveProperty("documents");
  await page.getByRole("tab", { name: "Visits", exact: true }).click();
  await page.getByRole("button", { name: "File visit", exact: true }).click();
  await expect(page.getByText("filed", { exact: true }).first()).toBeVisible();
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Create invoice", exact: true })
    .click();
  await page
    .getByLabel("Service 1", { exact: true })
    .fill("Fictional consultation");
  await page
    .getByLabel("Unit charge (JMD)", { exact: true })
    .first()
    .fill("100.25");
  await page.getByRole("button", { name: "Create invoice draft" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/app/invoices");
  const row = page.getByRole("row").filter({ hasText: "Avery " + name });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Issue", exact: true }).click();
  await expect(row.getByText("issued", { exact: true })).toBeVisible();
  await screenshot(page, "manual-invoices");
});
test("doctor retrieves a private report and front desk is denied direct clinical URLs", async ({
  page,
}) => {
  await login(page);
  await page.goto("/app/documents");
  await expect(
    page
      .getByRole("heading", { name: "Fictional lab report", exact: true })
      .first(),
  ).toBeVisible();
  const docs = await (await page.request.get("/api/documents")).json();
  const file = await page.request.get("/api/documents/" + docs[0].id);
  expect(file.status()).toBe(200);
  expect(file.headers()["cache-control"]).toContain("no-store");
  expect((await file.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await screenshot(page, "private-diagnostic-documents");
  await page.context().clearCookies();
  await login(page, "frontdesk");
  for (const path of [
    "documents",
    "documents/" + docs[0].id,
    "users",
    "audit",
    "reports/history?id=" + docs[0].patientId,
  ])
    expect((await page.request.get("/api/" + path)).status()).toBe(403);
  const denied = await page.request.post(
    "/api/visits/" + docs[0].patientId + "/clinical",
    { headers: { origin: base }, data: {} },
  );
  expect(denied.status()).toBe(403);
  await page.context().clearCookies();
  expect(
    (await page.request.get("/api/documents/" + docs[0].id)).status(),
  ).toBe(401);
});
test("doctor uploads a sample report and retrieves the exact bytes", async ({
  page,
}) => {
  await login(page);
  const docs = await (await page.request.get("/api/documents")).json();
  const p = docs[0].patientId;
  await page.goto("/app/patients/" + p);
  await page.getByRole("tab", { name: "Documents", exact: true }).click();
  await page.getByRole("button", { name: "Add report", exact: true }).click();
  await page
    .getByLabel("Report title", { exact: true })
    .fill("Fictional browser upload");
  const sample = await page.request.get("/api/sample-report");
  const bytes = await sample.body();
  await page.getByLabel("Report file", { exact: true }).setInputFiles({
    name: "fictional-report.pdf",
    mimeType: "application/pdf",
    buffer: bytes,
  });
  await page.getByRole("button", { name: "Store private report" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("tab", { name: "Documents", exact: true }).click();
  await expect(
    page
      .getByRole("heading", { name: "Fictional browser upload", exact: true })
      .first(),
  ).toBeVisible();
});
test("appointment can be rescheduled and cancelled with browser forms", async ({
  page,
}) => {
  await login(page, "frontdesk");
  const patientResponse = await page.request.post("/api/patients", {
    headers: { origin: base },
    data: {
      firstName: "Fictional",
      lastName: "ZZBooking" + Date.now(),
      dob: "1990-05-10",
      gender: "Not stated",
      phone: "876-555-0111",
      address: "Fictional Test Lane",
    },
  });
  expect(patientResponse.ok()).toBe(true);
  const { patient } = await patientResponse.json();
  await page.goto("/app/appointments");
  await expect(page.getByText("Loading practice records...")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Book appointment", exact: true })
    .first()
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Find patient by name or MRN").fill(patient.mrn);
  await dialog.getByLabel("Patient", { exact: true }).selectOption(patient.id);
  await dialog.getByLabel("Date", { exact: true }).fill(futureDay(45));
  await expect
    .poll(async () =>
      dialog.getByLabel("Available start time").locator("option").count(),
    )
    .toBeGreaterThan(1);
  await dialog.getByLabel("Available start time").selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "Review appointment" }).click();
  await dialog.getByRole("button", { name: "Confirm appointment" }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto("/app/appointments");
  await page.getByLabel("Schedule date").fill(futureDay(45));
  await page
    .getByRole("row")
    .filter({ hasText: patient.mrn })
    .getByRole("button", { name: /Manage appointment/ })
    .click();
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Date", { exact: true }).fill(futureDay(46));
  await expect
    .poll(async () =>
      dialog.getByLabel("Available start time").locator("option").count(),
    )
    .toBeGreaterThan(1);
  await dialog.getByLabel("Available start time").selectOption({ index: 2 });
  await dialog.getByRole("button", { name: "Review appointment" }).click();
  await dialog.getByRole("button", { name: "Confirm appointment" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel("Schedule date").fill(futureDay(46));
  await page
    .getByRole("row")
    .filter({ hasText: patient.mrn })
    .getByRole("button", { name: /Manage appointment/ })
    .click();
  await page
    .getByRole("button", { name: "Cancel appointment", exact: true })
    .click();
  await expect(
    page.getByText("cancelled", { exact: true }).first(),
  ).toBeVisible();
});
test("keyboard forms and desktop pages pass axe checks", async ({ page }) => {
  await page.goto("/login");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await page.getByLabel("Username", { exact: true }).fill("doctor");
  await page.getByLabel("Password", { exact: true }).fill("DoctorDemo!2026");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/app");
  await expect(
    page.getByRole("heading", { name: "Today at the practice" }),
  ).toBeVisible();
  const results = [];
  for (const path of [
    "/app",
    "/app/patients",
    "/app/appointments",
    "/app/documents",
    "/app/invoices",
    "/app/reports",
    "/app/accounts",
    "/app/audit",
    "/app/settings",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Loading practice records...")).toHaveCount(0);
    const a = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    results.push({
      path,
      violations: a.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => n.target),
      })),
    });
  }
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    "docs/evidence/axe-desktop.json",
    JSON.stringify(results, null, 2),
  );
  expect(results.flatMap((r) => r.violations)).toEqual([]);
});
test("phone layout, navigation, and reduced motion remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await login(page, "frontdesk");
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await screenshot(page, "phone-overview");
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Patients", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Patient directory" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Register patient", exact: true })
    .click();
  await page.getByLabel("First name", { exact: true }).fill("Fictional");
  await expect(page.getByLabel("First name", { exact: true })).toHaveCSS(
    "font-size",
    "16px",
  );
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const a = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await writeFile(
    "docs/evidence/axe-phone.json",
    JSON.stringify(
      {
        viewport: { width: 390, height: 844 },
        emulated: true,
        realDeviceTested: false,
        violations: a.violations,
      },
      null,
      2,
    ),
  );
  expect(a.violations).toEqual([]);
  await screenshot(page, "phone-patient-directory");
});
test("rejects forged origins and does not expose a public upload folder", async ({
  page,
}) => {
  await login(page);
  const denied = await page.request.post("/api/patients", {
    headers: { origin: "https://untrusted.invalid" },
    data: {},
  });
  expect(denied.status()).toBe(403);
  expect((await page.request.get("/.private/uploads")).status()).toBe(404);
  expect((await page.request.get("/api/cron")).status()).toBe(401);
});

test("a delayed earlier patient response cannot replace the selected patient", async ({
  page,
}) => {
  await login(page);
  const patients = await (await page.request.get("/api/patients")).json();
  const a = patients[0],
    b = patients[1];
  const response = await (
    await page.request.get("/api/patients/" + a.id)
  ).text();
  await page.route("**/api/patients/" + a.id, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1800));
    await route
      .fulfill({ status: 200, contentType: "application/json", body: response })
      .catch(() => {});
  });
  await page.goto("/app/patients");
  await page
    .getByRole("link", { name: new RegExp(a.firstName + " " + a.lastName) })
    .first()
    .click();
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Patients", exact: true })
    .click();
  await page
    .getByRole("link", { name: new RegExp(b.firstName + " " + b.lastName) })
    .first()
    .click();
  await expect(
    page
      .getByRole("heading", {
        name: b.firstName + " " + b.lastName,
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await page.waitForTimeout(2000);
  await expect(
    page
      .getByRole("heading", {
        name: b.firstName + " " + b.lastName,
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 768, height: 1000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
