import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { demoIntake } from "../src/lib/demo-intake";
import { submitIntake, intakeList, reviewIntake } from "../src/lib/intake";
import {
  appointmentMessage,
  queueEmailReminders,
  deliverQueuedEmails,
  notificationList,
} from "../src/lib/notifications";
import { sql, eq } from "drizzle-orm";
import { db, pool } from "../src/lib/db";
import { users, sessions, type Staff } from "../src/lib/schema";
import * as s from "../src/lib/service";
import { login, getSession, digest } from "../src/lib/auth";
import { storeFile, readPrivateFile, samplePdf } from "../src/lib/storage";
import { emptyClinical } from "../src/lib/validation";
let doctor: Staff,
  desk: Staff,
  operatorActor: Staff,
  patientId: string,
  doctorId: string;
let minute = 0;
function booking(patient = patientId, start = 0, duration = 30) {
  const d = new Date("2032-01-05T08:00:00-05:00");
  d.setMinutes(d.getMinutes() + start);
  return {
    patientId: patient,
    doctorId,
    startAt: d.toISOString(),
    endAt: new Date(d.valueOf() + duration * 60000).toISOString(),
  };
}
beforeAll(async () => {
  doctor = (
    await db.select().from(users).where(eq(users.username, "doctor"))
  )[0];
  desk = (
    await db.select().from(users).where(eq(users.username, "frontdesk"))
  )[0];
  doctorId = doctor.id;
  // Trusted operator context for test fixture provisioning, never a persisted login role.
  operatorActor = { ...doctor, role: "operator" } as unknown as Staff;
  patientId = (
    await s.savePatient(desk, {
      firstName: "Service",
      lastName: "Fictional",
      dob: "2000-01-01",
      phone: "876-555-0100",
      address: "Sample Road",
    })
  ).patient.id;
});
afterAll(async () => {
  await pool.end();
});
describe("additional independent service paths", () => {
  it("checks the full appointment length at closing and rejects excessive availability durations", async () => {
    const slots = await s.availability(desk, doctorId, "2032-01-06", {
      duration: 120,
      patientId,
    });
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(
        Date.parse(String(slot.end_at)) - Date.parse(String(slot.start_at)),
      ).toBe(120 * 60000);
      expect(
        new Date(String(slot.start_at)).toISOString().slice(11, 16) <= "20:00",
      ).toBe(true);
    }
    await expect(
      s.availability(desk, doctorId, "2032-01-06", { duration: 241 }),
    ).rejects.toThrow();
  });
  it("excludes the current reschedule row and checks patient conflicts across doctors", async () => {
    const start = "2032-01-07T08:00:00-05:00";
    const a = await s.bookAppointment(desk, {
      patientId,
      doctorId,
      startAt: start,
      endAt: "2032-01-07T09:00:00-05:00",
    });
    const atStart = (rows: Record<string, unknown>[]) =>
      rows.some((r) => Date.parse(String(r.start_at)) === Date.parse(start));
    expect(
      atStart(
        await s.availability(desk, doctorId, "2032-01-07", {
          duration: 60,
          patientId,
        }),
      ),
    ).toBe(false);
    expect(
      atStart(
        await s.availability(desk, doctorId, "2032-01-07", {
          duration: 60,
          patientId,
          excludeId: a.id,
        }),
      ),
    ).toBe(true);
    const other = await s.manageUser(operatorActor, {
      username: "availability-doctor",
      name: "Fictional Availability Doctor",
      role: "doctor",
      password: "Availability!2026",
    });
    expect(
      atStart(
        await s.availability(desk, other.id, "2032-01-07", {
          duration: 60,
          patientId,
        }),
      ),
    ).toBe(false);
    expect(
      atStart(
        await s.availability(desk, other.id, "2032-01-07", { duration: 60 }),
      ),
    ).toBe(true);
    await s.manageUser(
      operatorActor,
      { version: 1, role: "doctor", active: false },
      other.id,
    );
  });
  it("reads a schedule, availability, dashboard, invoices, and administrative reports", async () => {
    expect(await s.schedule(desk, "2032-01-05")).toBeInstanceOf(Array);
    expect(await s.availability(desk, doctorId, "2032-01-06")).toBeInstanceOf(
      Array,
    );
    expect(await s.dashboard(desk)).toHaveProperty("counts");
    expect(await s.invoiceList(desk)).toBeInstanceOf(Array);
    expect(await s.reportData(desk, "schedule", "2032-01-05")).toHaveProperty(
      "appointments",
    );
    expect(await s.reportData(desk, "visits", "all")).toHaveProperty("counts");
  });
  it("rejects an invalid availability date and a missing patient", async () => {
    await expect(
      s.availability(desk, doctorId, "bad-date"),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      s.patientDetail(doctor, "11111111-1111-4111-8111-111111111111"),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("changes a private account password and revokes its session", async () => {
    const u = await s.manageUser(operatorActor, {
      username: "password-test",
      name: "Fictional Password Tester",
      role: "front_desk",
      password: "OldPassword!2026",
    });
    const l = await login("password-test", "OldPassword!2026", "password-ip");
    const staff = (await db.select().from(users).where(eq(users.id, u.id)))[0];
    await expect(
      s.changePassword(staff, {
        currentPassword: "wrong",
        password: "NewPassword!2026",
      }),
    ).rejects.toMatchObject({ status: 400 });
    await s.changePassword(staff, {
      currentPassword: "OldPassword!2026",
      password: "NewPassword!2026",
    });
    expect(await getSession(l.token)).toBeNull();
    await expect(
      login("password-test", "NewPassword!2026", "password-ip"),
    ).resolves.toHaveProperty("token");
  });
  it("protects supplied public demo accounts", async () => {
    await db
      .update(users)
      .set({ protected: true })
      .where(eq(users.id, desk.id));
    process.env.DEMO_MODE = "true";
    try {
      await expect(
        s.manageUser(
          operatorActor,
          { version: desk.version, role: "front_desk", active: false },
          desk.id,
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        s.changePassword(
          { ...desk, protected: true },
          { currentPassword: "DeskDemo!2026", password: "Replacement!2026" },
        ),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      process.env.DEMO_MODE = "false";
      await db
        .update(users)
        .set({ protected: false })
        .where(eq(users.id, desk.id));
    }
  });
  it("generates record numbers without truncating a long sequence value", async () => {
    await db.execute(
      sql`CREATE TEMP SEQUENCE long_record_sequence START 1000000`,
    );
    const result = await s.rows(
      sql`SELECT next_record_number('PC-','long_record_sequence') AS mrn`,
    );
    expect(result[0].mrn).toBe("PC-1000000");
  });
  it("returns clinical outputs only after a final entry", async () => {
    const v = await s.startVisit(desk, { patientId, doctorId });
    await expect(s.reportData(doctor, "summary", v.id)).rejects.toMatchObject({
      status: 404,
    });
    await s.saveClinical(doctor, v.id, {
      ...emptyClinical,
      expectedRevision: 0,
      state: "draft",
    });
    await expect(s.reportData(doctor, "summary", v.id)).rejects.toMatchObject({
      status: 400,
    });
    await s.saveClinical(doctor, v.id, {
      ...emptyClinical,
      expectedRevision: 1,
      state: "final",
      diagnosis: "Fictional diagnosis",
    });
    for (const kind of ["summary", "prescription", "certificate"])
      expect(await s.reportData(doctor, kind, v.id)).toHaveProperty("clinical");
    expect(await s.reportData(desk, "attendance", v.id)).not.toHaveProperty(
      "clinical",
    );
    expect(await s.reportData(doctor, "history", patientId)).toHaveProperty(
      "clinical",
    );
    await expect(
      s.reportData(doctor, "unknown", patientId),
    ).rejects.toMatchObject({ status: 404 });
  });
});
describe("role separation from the group diagram", () => {
  it("denies doctor administrative mutations before input validation", async () => {
    for (const action of [
      () => s.manageUser(doctor, {}),
      () => s.savePatient(doctor, {}),
      () => s.bookAppointment(doctor, {}),
      () => s.startVisit(doctor, {}),
      () => s.fileVisit(doctor, patientId, {}),
      () => s.saveInvoice(doctor, {}),
      () => s.archivePatient(doctor, patientId, {}),
      () => s.reconcilePatient(doctor, patientId, {}),
    ])
      await expect(action()).rejects.toMatchObject({ status: 403 });
  });
  it("denies doctor invoice data and administrative report exports", async () => {
    expect((await s.dashboard(doctor)).counts).not.toHaveProperty("filed");
    await expect(s.invoiceList(doctor)).rejects.toMatchObject({ status: 403 });
    for (const kind of ["invoice", "attendance", "visits"])
      await expect(s.reportData(doctor, kind, patientId)).rejects.toMatchObject(
        { status: 403 },
      );
  });
});
describe("authentication and role enforcement", () => {
  it("rejects wrong and missing accounts with the same error", async () => {
    for (const username of ["doctor", "missing-account"])
      await expect(login(username, "wrong", "test-ip")).rejects.toMatchObject({
        status: 401,
        message: "The username or password is incorrect.",
      });
  });
  it("logs in and stores only a token hash", async () => {
    const result = await login("doctor", "DoctorDemo!2026", "login-test");
    expect(await getSession(result.token)).toMatchObject({ role: "doctor" });
    const rows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, result.token));
    expect(rows).toHaveLength(0);
    await db.delete(sessions).where(eq(sessions.id, digest(result.token)));
    expect(await getSession(result.token)).toBeNull();
  });
  it("rejects an expired session", async () => {
    await db.insert(sessions).values({
      id: digest("expired"),
      userId: doctor.id,
      expiresAt: new Date(0),
    });
    expect(await getSession("expired")).toBeNull();
  });
  it("enforces the login attempt limit", async () => {
    for (let i = 0; i < 8; i++)
      await expect(login("limited", "wrong", "limit-ip")).rejects.toMatchObject(
        { status: 401 },
      );
    await expect(login("limited", "wrong", "limit-ip")).rejects.toMatchObject({
      status: 429,
    });
  });
  it("denies front desk account creation", async () => {
    await expect(s.manageUser(desk, {})).rejects.toMatchObject({ status: 403 });
  });
  it("denies front desk clinical changes and clinical report export", async () => {
    await expect(s.saveClinical(desk, patientId, {})).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      s.reportData(desk, "history", patientId),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("does not include clinical fields in front desk patient responses", async () => {
    const p = await s.patientDetail(desk, patientId);
    expect(p).not.toHaveProperty("clinical");
    expect(p.documents).toBeInstanceOf(Array);
  });
  it("prevents all doctors from being disabled", async () => {
    await expect(
      db.execute(
        sql`UPDATE users SET active=false WHERE role='doctor' AND active`,
      ),
    ).rejects.toThrow();
    expect(
      (await db.select().from(users).where(eq(users.id, doctorId)))[0].active,
    ).toBe(true);
  });
  it("creates an account, changes access, and revokes its session", async () => {
    const u = await s.manageUser(operatorActor, {
      username: "test-desk",
      name: "Fictional Tester",
      role: "front_desk",
      password: "TestPassword!2026",
    });
    const l = await login("test-desk", "TestPassword!2026", "new-user");
    await s.manageUser(
      operatorActor,
      { version: 1, role: "front_desk", active: false },
      u.id,
    );
    expect(await getSession(l.token)).toBeNull();
    await expect(
      login("test-desk", "TestPassword!2026", "new-user"),
    ).rejects.toMatchObject({ status: 401 });
  });
});
describe("patient changes and appointment concurrency", () => {
  it("preserves distinct MRNs and warns on possible duplicate people", async () => {
    const input = {
      firstName: "Same",
      lastName: "Fictional",
      dob: "2000-01-01",
      phone: "876-555-0100",
      address: "Sample Road",
    };
    const outcomes = await Promise.allSettled([
      s.savePatient(desk, input),
      s.savePatient(desk, input),
    ]);
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);
    const c = await s.savePatient(desk, {
      ...input,
      duplicateReason: "Confirmed separate fictional patient",
    });
    expect(c.duplicates!.length).toBeGreaterThan(0);
  });
  it("permits one of two stale demographic changes", async () => {
    const p = await s.patientDetail(desk, patientId);
    const input = {
      ...p.patient,
      firstName: "Changed",
      version: p.patient.version,
    };
    const r = await Promise.allSettled([
      s.savePatient(desk, input, patientId),
      s.savePatient(desk, input, patientId),
    ]);
    expect(r.filter((v) => v.status === "fulfilled")).toHaveLength(1);
  });
  it("permits adjacent appointments and rejects an overlap", async () => {
    await s.bookAppointment(desk, booking(patientId, 0));
    await s.bookAppointment(desk, booking(patientId, 30));
    await expect(
      s.bookAppointment(desk, booking(patientId, 15)),
    ).rejects.toThrow();
  });
  it("allows exactly one simultaneous booking for one doctor", async () => {
    const p = (await s.patientList(desk)).find((p) => p.id !== patientId)!;
    const r = await Promise.allSettled([
      s.bookAppointment(desk, booking(patientId, 90)),
      s.bookAppointment(desk, booking(String(p.id), 90)),
    ]);
    expect(r.filter((v) => v.status === "fulfilled")).toHaveLength(1);
  });
  it("rejects booking outside hours and at the end boundary", async () => {
    await expect(
      s.bookAppointment(desk, booking(patientId, -1, 1)),
    ).rejects.toThrow();
    await expect(
      s.bookAppointment(desk, booking(patientId, 540, 30)),
    ).rejects.toThrow();
    await expect(
      s.bookAppointment(desk, booking(patientId, 510, 30)),
    ).resolves.toHaveProperty("id");
  });
  it("keeps the original booking when a reschedule conflicts", async () => {
    const a = await s.bookAppointment(desk, booking(patientId, 180));
    await expect(
      s.bookAppointment(
        desk,
        { ...booking(patientId, 0), version: a.version },
        a.id,
      ),
    ).rejects.toThrow();
    const r = await s.rows(
      sql`SELECT start_at FROM appointments WHERE id=${a.id}`,
    );
    expect(new Date(String(r[0].start_at)).toISOString()).toBe(
      a.startAt.toISOString(),
    );
  });
  it("releases a cancelled slot and retains its history", async () => {
    const a = await s.bookAppointment(desk, booking(patientId, 240));
    await s.appointmentStatus(desk, a.id, {
      status: "cancelled",
      version: a.version,
    });
    await expect(
      s.bookAppointment(desk, booking(patientId, 240)),
    ).resolves.toHaveProperty("id");
    expect(
      (await s.rows(sql`SELECT status FROM appointments WHERE id=${a.id}`))[0]
        .status,
    ).toBe("cancelled");
  });
  it("rejects a booking during a blocked interval", async () => {
    await db.execute(
      sql`INSERT INTO schedule_blocks(doctor_id,start_at,end_at) VALUES(${doctorId},'2032-01-05T15:00:00-05:00','2032-01-05T15:30:00-05:00')`,
    );
    await expect(
      s.bookAppointment(desk, booking(patientId, 420)),
    ).rejects.toThrow();
  });
  it("does not return an archived patient as bookable", async () => {
    const p = (
      await s.savePatient(desk, {
        firstName: "Archived",
        lastName: "Fictional",
        dob: "2000-01-01",
        phone: "876-555-0100",
        address: "Sample Road",
      })
    ).patient;
    await s.archivePatient(desk, p.id, {
      version: p.version,
      archived: true,
    });
    await expect(
      s.bookAppointment(desk, booking(p.id, 330)),
    ).rejects.toMatchObject({ status: 400 });
  });
});
describe("clinical corrections, filing, documents, and invoices", () => {
  it("preserves revisions, requires a final diagnosis and correction reason, and prevents overwriting", async () => {
    const v = await s.startVisit(desk, { patientId, doctorId });
    await expect(
      s.fileVisit(desk, v.id, { expectedRevision: 1 }),
    ).rejects.toThrow();
    await s.saveClinical(doctor, v.id, {
      ...emptyClinical,
      expectedRevision: 0,
      state: "draft",
      notes: "First fictional draft.",
    });
    await expect(
      s.saveClinical(doctor, v.id, {
        ...emptyClinical,
        expectedRevision: 0,
        state: "draft",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await s.saveClinical(doctor, v.id, {
      ...emptyClinical,
      expectedRevision: 1,
      state: "final",
      diagnosis: "Fictional diagnosis",
      treatment: "Doctor-entered sample",
    });
    await expect(
      s.saveClinical(doctor, v.id, {
        ...emptyClinical,
        expectedRevision: 2,
        state: "final",
        diagnosis: "Corrected",
      }),
    ).rejects.toMatchObject({ status: 400 });
    await s.saveClinical(doctor, v.id, {
      ...emptyClinical,
      expectedRevision: 2,
      state: "final",
      diagnosis: "Corrected fictional diagnosis",
      reason: "Corrected a typing error.",
    });
    const entries = await s.rows(
      sql`SELECT * FROM clinical_revisions WHERE visit_id=${v.id}`,
    );
    expect(entries).toHaveLength(3);
    await expect(
      db.execute(
        sql`UPDATE clinical_revisions SET reason='overwritten' WHERE visit_id=${v.id}`,
      ),
    ).rejects.toThrow();
    await s.fileVisit(desk, v.id, { expectedRevision: 3 });
    expect(
      (await s.rows(sql`SELECT status FROM visits WHERE id=${v.id}`))[0].status,
    ).toBe("filed");
  });
  it("writes only medication details supplied by the doctor", async () => {
    const v = await s.startVisit(desk, { patientId, doctorId });
    const medication = {
      medication: "Fictional medicine",
      dosage: "Sample dose",
      route: "Sample route",
      frequency: "Sample frequency",
      duration: "Sample duration",
      quantity: "Sample quantity",
      instructions: "For demonstration only",
    };
    await s.saveClinical(doctor, v.id, {
      ...emptyClinical,
      expectedRevision: 0,
      state: "final",
      diagnosis: "Sample",
      medications: [medication],
    });
    const rows = await s.rows(
      sql`SELECT content FROM prescriptions WHERE visit_id=${v.id}`,
    );
    expect(rows[0].content).toEqual(medication);
  });
  it("keeps linked provisional records and their MRNs", async () => {
    const p = (
      await s.savePatient(desk, {
        firstName: "Provisional",
        lastName: "Fictional",
        dob: "2000-01-01",
        phone: "876-555-0100",
        address: "Sample Road",
        provisionalReason: "Primary record needs review",
      })
    ).patient;
    await expect(
      s.reconcilePatient(desk, p.id, {
        targetId: patientId,
        reason: "Link primary",
      }),
    ).rejects.toThrow("doctor must review");
    await s.reviewProvisional(doctor, p.id, {
      version: p.version,
      reason: "Checked the provisional record",
    });
    await s.reconcilePatient(desk, p.id, {
      targetId: patientId,
      reason: "Identity checked in fictional test",
    });
    const result = await s.patientDetail(doctor, p.id);
    expect(result.patient.mrn).toBe(p.mrn);
    expect(result.patient.mergedInto).toBe(patientId);
  });
  it("checks file signatures, MIME type, size boundaries, private paths, and missing files", async () => {
    await expect(
      storeFile(Buffer.alloc(0), "application/pdf"),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      storeFile(Buffer.alloc(4194305), "application/pdf"),
    ).rejects.toMatchObject({ status: 400 });
    await expect(storeFile(samplePdf, "image/png")).rejects.toMatchObject({
      status: 400,
    });
    const data = await storeFile(samplePdf, "application/pdf");
    expect(await readPrivateFile(data.pathname)).toEqual(samplePdf);
    await expect(readPrivateFile("../.env")).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      readPrivateFile(
        "practicechart/records/11111111-1111-4111-8111-111111111111",
      ),
    ).rejects.toMatchObject({ status: 404 });
    const max = Buffer.alloc(4194304);
    samplePdf.copy(max);
    await expect(storeFile(max, "application/pdf")).resolves.toHaveProperty(
      "size",
      4194304,
    );
  });
  it("restricts public demo files to the supplied sample", async () => {
    process.env.DEMO_MODE = "true";
    try {
      await expect(
        storeFile(Buffer.from("%PDF-changed"), "application/pdf"),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        storeFile(samplePdf, "application/pdf"),
      ).resolves.toHaveProperty("pathname");
    } finally {
      process.env.DEMO_MODE = "false";
    }
  });
  it("issues and voids invoices without recording a payment", async () => {
    const i = await s.saveInvoice(desk, {
      patientId,
      lines: [{ description: "Sample service", quantity: 2, unitCents: 10001 }],
    });
    expect(i.totalCents).toBe(20002);
    await s.setInvoiceStatus(desk, i.id, { version: 1, status: "issued" });
    await expect(
      s.setInvoiceStatus(desk, i.id, { version: 2, status: "void" }),
    ).rejects.toThrow();
    const v = await s.setInvoiceStatus(desk, i.id, {
      version: 2,
      status: "void",
      reason: "Duplicate service line",
    });
    expect(v.status).toBe("void");
  });
  it("keeps audit history append only", async () => {
    await expect(db.execute(sql`DELETE FROM audit_events`)).rejects.toThrow();
    expect(
      (await s.rows(sql`SELECT count(*) FROM audit_events`))[0].count,
    ).not.toBe("0");
  });
});
describe("patient intake, linked history, visit files, and email", () => {
  it("accepts only the fixed fictional intake in public demo mode", async () => {
    const old = process.env.DEMO_MODE;
    process.env.DEMO_MODE = "true";
    try {
      await expect(
        submitIntake(
          {
            ...demoIntake,
            firstName: "Unapproved",
            submissionId: randomUUID(),
            consent: true,
          },
          "192.0.2.5",
        ),
      ).rejects.toThrow("fictional example");
      await expect(
        submitIntake(
          { ...demoIntake, submissionId: randomUUID(), consent: true },
          "192.0.2.5",
        ),
      ).resolves.toHaveProperty("reference");
    } finally {
      process.env.DEMO_MODE = old;
    }
  });
  const details = {
    firstName: "Intake",
    lastName: "Fictional",
    dob: "2001-01-01",
    phone: "876-555-0199",
    address: "Fictional Intake Road",
    email: "patient@example.test",
    emailOptIn: true,
  };
  it("accepts a public form without creating an MRN and deduplicates retries", async () => {
    const submissionId = randomUUID();
    const before = (await s.rows(sql`SELECT count(*) FROM patients`))[0].count;
    await submitIntake(
      {
        ...details,
        submissionId,
        consent: true,
        provisionalReason: "Cannot set this publicly",
      },
      "192.0.2.1",
    );
    await submitIntake(
      { ...details, submissionId, consent: true },
      "192.0.2.1",
    );
    expect((await s.rows(sql`SELECT count(*) FROM patients`))[0].count).toBe(
      before,
    );
    const forms = await intakeList(desk);
    const row = forms.find((r) => r.id === submissionId)!;
    expect((row.payload as Record<string, unknown>).provisionalReason).toBe("");
    await expect(intakeList(doctor)).rejects.toThrow("cannot use");
    const accepted = await Promise.allSettled([
      reviewIntake(desk, submissionId, { version: 1, action: "accept" }),
      reviewIntake(desk, submissionId, { version: 1, action: "accept" }),
    ]);
    expect(accepted.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(accepted.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("rejects bad consent, invalid fields, spam traps, and excessive forms", async () => {
    await expect(
      submitIntake(
        { ...details, submissionId: randomUUID(), consent: false },
        "192.0.2.2",
      ),
    ).rejects.toThrow();
    await expect(
      submitIntake(
        {
          ...details,
          dob: "2050-01-01",
          submissionId: randomUUID(),
          consent: true,
        },
        "192.0.2.2",
      ),
    ).rejects.toThrow();
    await expect(
      submitIntake(
        {
          ...details,
          website: "bot",
          submissionId: randomUUID(),
          consent: true,
        },
        "192.0.2.2",
      ),
    ).rejects.toThrow();
    for (let i = 0; i < 10; i++)
      await submitIntake(
        { ...details, submissionId: randomUUID(), consent: true },
        "192.0.2.3",
      );
    await expect(
      submitIntake(
        { ...details, submissionId: randomUUID(), consent: true },
        "192.0.2.3",
      ),
    ).rejects.toThrow("Too many");
  });
  it("reviews duplicates before acceptance and requires a reason for rejection", async () => {
    const id = randomUUID();
    await submitIntake(
      { ...details, submissionId: id, consent: true },
      "192.0.2.4",
    );
    await expect(
      reviewIntake(doctor, id, { version: 1, action: "accept" }),
    ).rejects.toThrow();
    await expect(
      reviewIntake(desk, id, { version: 1, action: "accept" }),
    ).rejects.toThrow("matching name");
    expect(
      (
        await s.rows(
          sql`SELECT status FROM registration_intakes WHERE id=${id}::uuid`,
        )
      )[0].status,
    ).toBe("pending");
    await expect(
      reviewIntake(desk, id, { version: 1, action: "reject" }),
    ).rejects.toThrow("reason");
    await reviewIntake(desk, id, {
      version: 1,
      action: "reject",
      reason: "Existing patient file located",
    });
  });
  it("shows linked clinical histories without overwriting the source MRN", async () => {
    const p = (
      await s.savePatient(desk, {
        ...details,
        firstName: "Interim",
        provisionalReason: "File unavailable at reception",
      })
    ).patient;
    const v = await s.startVisit(desk, { patientId: p.id, doctorId });
    await s.saveClinical(doctor, v.id, {
      ...emptyClinical,
      expectedRevision: 0,
      state: "final",
      diagnosis: "Fictional history entry",
    });
    await s.reviewProvisional(doctor, p.id, {
      version: p.version,
      reason: "Clinical identity reviewed",
    });
    await s.reconcilePatient(desk, p.id, {
      targetId: patientId,
      reason: "Primary file found",
    });
    const primary = await s.patientDetail(doctor, patientId);
    expect(primary.clinical?.some((c) => c.visit_id === v.id)).toBe(true);
    expect((await s.patientDetail(desk, p.id)).patient.mrn).toBe(p.mrn);
    expect(await s.patientDetail(desk, patientId)).not.toHaveProperty(
      "clinical",
    );
  });
  it("rejects document links to a different patient's visit", async () => {
    const v = await s.startVisit(desk, { patientId, doctorId });
    const other = (
      await s.savePatient(desk, { ...details, firstName: "File Boundary" })
    ).patient;
    const f = await storeFile(samplePdf, "application/pdf");
    await expect(
      db.execute(
        sql`INSERT INTO documents(patient_id,visit_id,title,kind,pathname,mime,size,sha256,author_id) VALUES(${other.id}::uuid,${v.id}::uuid,'Fictional lab','Lab report',${f.pathname},${f.mime},${f.size},${f.sha256},${desk.id}::uuid)`,
      ),
    ).rejects.toThrow();
    await db.execute(
      sql`INSERT INTO documents(patient_id,visit_id,title,kind,pathname,mime,size,sha256,author_id) VALUES(${patientId}::uuid,${v.id}::uuid,'Fictional lab','Lab report',${f.pathname},${f.mime},${f.size},${f.sha256},${desk.id}::uuid)`,
    );
    expect(
      (await s.patientDetail(doctor, patientId)).documents.some(
        (d) => d.visitId === v.id,
      ),
    ).toBe(true);
  });
  it("queues each booking event atomically and skips cancelled bookings", async () => {
    await db.execute(sql`DELETE FROM notification_outbox`);
    const p = (
      await s.savePatient(desk, { ...details, firstName: "Email Queue" })
    ).patient;
    const a = await s.bookAppointment(desk, {
      ...booking(p.id, 0),
      startAt: "2033-01-03T08:00:00-05:00",
      endAt: "2033-01-03T08:30:00-05:00",
    });
    expect(
      await s.rows(
        sql`SELECT * FROM notification_outbox WHERE appointment_id=${a.id}::uuid`,
      ),
    ).toHaveLength(1);
    await s.appointmentStatus(desk, a.id, {
      version: a.version,
      status: "cancelled",
    });
    const fetcher = vi.fn();
    await deliverQueuedEmails(fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      (
        await s.rows(
          sql`SELECT status FROM notification_outbox WHERE appointment_id=${a.id}::uuid`,
        )
      )[0].status,
    ).toBe("skipped");
    await expect(notificationList(doctor)).rejects.toThrow();
  });
  it("sends minimal messages, retries failures with the same key, and isolates demo recipients", async () => {
    await db.execute(sql`DELETE FROM notification_outbox`);
    const p = (
      await s.savePatient(desk, { ...details, firstName: "Email Retry" })
    ).patient;
    const a = await s.bookAppointment(desk, {
      ...booking(p.id, 30),
      startAt: "2033-01-03T09:00:00-05:00",
      endAt: "2033-01-03T09:30:00-05:00",
    });
    const oldKey = process.env.RESEND_API_KEY,
      oldFrom = process.env.EMAIL_FROM,
      oldDemo = process.env.DEMO_MODE;
    process.env.RESEND_API_KEY = "test-only-key";
    process.env.EMAIL_FROM = "PracticeChart <test@example.test>";
    process.env.DEMO_MODE = "true";
    const requests: RequestInit[] = [];
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      requests.push(init!);
      return requests.length === 1
        ? new Response("Unavailable", { status: 503 })
        : Response.json({ id: "fictional-provider-id" });
    }) as typeof fetch;
    try {
      expect((await deliverQueuedEmails(fetcher)).failed).toBe(1);
      await db.execute(
        sql`UPDATE notification_outbox SET next_attempt_at=now() WHERE appointment_id=${a.id}::uuid`,
      );
      expect((await deliverQueuedEmails(fetcher)).sent).toBe(1);
      expect(new Headers(requests[0].headers).get("Idempotency-Key")).toBe(
        new Headers(requests[1].headers).get("Idempotency-Key"),
      );
      expect(JSON.parse(String(requests[1].body)).to).toEqual([
        "delivered@resend.dev",
      ]);
      expect(String(requests[1].body)).not.toContain("diagnosis");
      expect((await deliverQueuedEmails(fetcher)).sent).toBe(0);
    } finally {
      if (oldKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = oldKey;
      if (oldFrom === undefined) delete process.env.EMAIL_FROM;
      else process.env.EMAIL_FROM = oldFrom;
      process.env.DEMO_MODE = oldDemo;
    }
  });
  it("creates one reminder per confirmed appointment version within 24 hours", async () => {
    const p = (
      await s.savePatient(desk, { ...details, firstName: "Email Reminder" })
    ).patient;
    const at = new Date(Date.now() + 12 * 3600000),
      end = new Date(at.valueOf() + 1800000);
    // A separate active doctor with all-day hours makes the relative date valid.
    const u = await s.manageUser(operatorActor, {
      username: "reminder-doctor",
      name: "Fictional Reminder Doctor",
      role: "doctor",
      password: "ReminderTest!2026",
    });
    await db.execute(
      sql`INSERT INTO doctor_hours(doctor_id,weekday,start_min,end_min) SELECT ${u.id}::uuid,n,0,1440 FROM generate_series(1,7)n ON CONFLICT(doctor_id,weekday) DO UPDATE SET start_min=0,end_min=1440`,
    );
    const a = await s.bookAppointment(desk, {
      patientId: p.id,
      doctorId: u.id,
      startAt: at.toISOString(),
      endAt: end.toISOString(),
    });
    await queueEmailReminders();
    await queueEmailReminders();
    expect(
      await s.rows(
        sql`SELECT * FROM notification_outbox WHERE appointment_id=${a.id}::uuid AND kind='reminder'`,
      ),
    ).toHaveLength(1);
    expect(appointmentMessage("reminder", at).subject).toContain("reminder");
  });
});
