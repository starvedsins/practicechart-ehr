import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const base = process.argv[2];
if (!base?.startsWith("https://"))
  throw Error("Supply the HTTPS deployment URL.");
const bypass = process.argv.includes("--public")
  ? ""
  : (await readFile(".private/preview-bypass", "utf8")).trim();
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass } : {},
  });
  const page = await context.newPage();
  await page.goto(base + "/register");
  await page
    .getByRole("button", { name: "Use fictional example", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Send appointment/ }).check();
  await page.getByRole("checkbox", { name: /I agree/ }).check();
  const response = page.waitForResponse(
    (r) =>
      r.url() === base + "/api/public-registration" &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Send registration form", exact: true })
    .click();
  const intakeResponse = await response;
  assert.equal(intakeResponse.status(), 201);
  const { reference } = await intakeResponse.json();
  await page
    .getByRole("heading", { name: "Form received", exact: true })
    .waitFor();
  await page.goto(base + "/login");
  await page.getByLabel("Username", { exact: true }).fill("frontdesk");
  await page.getByLabel("Password", { exact: true }).fill("DeskDemo!2026");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/app");
  const req = context.request;
  const headers = { origin: base };
  const candidates = await (
    await req.get(base + "/api/patients?q=Mira%20Demo")
  ).json();
  let patient;
  if (candidates.length) {
    patient = candidates[0];
    assert.equal(
      (
        await req.post(base + "/api/intakes/" + reference, {
          headers,
          data: {
            version: 1,
            action: "reject",
            reason: "Existing fictional patient file found",
          },
        })
      ).status(),
      200,
    );
  } else {
    const accepted = await req.post(base + "/api/intakes/" + reference, {
      headers,
      data: { version: 1, action: "accept" },
    });
    assert.equal(accepted.status(), 200);
    patient = (await accepted.json()).patient;
  }
  const detail = await (
    await req.get(base + "/api/patients/" + patient.id)
  ).json();
  assert.equal(
    (
      await req.post(base + "/api/patients/" + patient.id, {
        headers,
        data: {
          ...detail.patient,
          email: "patient@example.test",
          emailOptIn: true,
        },
      })
    ).status(),
    200,
  );
  const [doctor] = await (await req.get(base + "/api/doctors")).json();
  let slot;
  for (let offset = 0; offset < 5 && !slot; offset++) {
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Jamaica",
    }).format(new Date(Date.now() + offset * 86400000));
    const available = await (
      await req.get(
        base +
          `/api/availability?doctorId=${doctor.id}&patientId=${patient.id}&date=${day}&duration=30`,
      )
    ).json();
    slot = available.find(
      (s: { startAt: string }) => Date.parse(s.startAt) > Date.now() + 120000,
    );
  }
  assert.ok(slot, "No appointment slot is available for the release check.");
  const appointment = await req.post(base + "/api/appointments", {
    headers,
    data: {
      patientId: patient.id,
      doctorId: doctor.id,
      startAt: new Date(slot.startAt).toISOString(),
      endAt: new Date(slot.endAt).toISOString(),
    },
  });
  assert.equal(appointment.status(), 200,appointment.ok()?"":await appointment.text());
  const saved = await appointment.json();
  const reminderExpected = Date.parse(slot.startAt) < Date.now() + 86400000;
  let notifications: {
    kind: string;
    status: string;
    mrn: string;
    lastError: string;
  }[] = [];
  for (let attempt = 0; attempt < 25; attempt++) {
    notifications = (
      await (await req.get(base + "/api/notifications")).json()
    ).filter((n: { mrn: string }) => n.mrn === patient.mrn);
    if (
      notifications.some(
        (n) => n.kind === "confirmation" && n.status === "sent",
      ) &&
      (!reminderExpected ||
        notifications.some((n) => n.kind === "reminder" && n.status === "sent"))
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  assert.ok(
    notifications.some((n) => n.kind === "confirmation" && n.status === "sent"),
    JSON.stringify(notifications),
  );
  if (reminderExpected)
    assert.ok(
      notifications.some((n) => n.kind === "reminder" && n.status === "sent"),
      JSON.stringify(notifications),
    );
  await page.goto(base + "/app/notifications");
  await page
    .getByRole("heading", { name: "Appointment email status", exact: true })
    .waitFor();
  await page.screenshot({
    path: "docs/screenshots/email-status.png",
    fullPage: true,
  });
  await writeFile(
    process.env.INTAKE_MAIL_EVIDENCE_PATH ||
      "docs/evidence/intake-mail-cloud.json",
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        deployment: base,
        status: "passed",
        checks: [
          "public fictional form accepted without staff login",
          "receptionist review before MRN creation, or existing record reused",
          "email consent recorded",
          "booking confirmation accepted by the provider",
          ...(reminderExpected
            ? ["appointment reminder accepted by the provider"]
            : []),
        ],
        destination: "Provider test inbox only",
        reminderExpected,
      },
      null,
      2,
    ),
  );
  await writeFile(
    ".private/mail-check-appointment.json",
    JSON.stringify({ appointmentId: saved.id }),
  );
  console.log("Patient intake and real provider mail checks passed.");
} finally {
  await browser.close();
}
