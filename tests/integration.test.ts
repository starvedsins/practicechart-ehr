import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { sql, eq } from "drizzle-orm";
import { db, pool } from "../src/lib/db";
import { users, sessions, type Staff } from "../src/lib/schema";
import * as s from "../src/lib/service";
import { login, getSession, digest } from "../src/lib/auth";
import { storeFile, readPrivateFile, samplePdf } from "../src/lib/storage";
import { emptyClinical } from "../src/lib/validation";
let doctor: Staff, desk: Staff, patientId: string, doctorId: string;
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
describe('additional independent service paths',()=>{
 it('reads a schedule, availability, dashboard, invoices, and administrative reports',async()=>{expect(await s.schedule(desk,'2032-01-05')).toBeInstanceOf(Array);expect(await s.availability(desk,doctorId,'2032-01-06')).toBeInstanceOf(Array);expect(await s.dashboard(desk)).toHaveProperty('counts');expect(await s.invoiceList(desk)).toBeInstanceOf(Array);expect(await s.reportData(desk,'schedule','2032-01-05')).toHaveProperty('appointments');expect(await s.reportData(desk,'visits','all')).toHaveProperty('counts');});
 it('rejects an invalid availability date and a missing patient',async()=>{await expect(s.availability(desk,doctorId,'bad-date')).rejects.toMatchObject({status:400});await expect(s.patientDetail(doctor,'11111111-1111-4111-8111-111111111111')).rejects.toMatchObject({status:404});});
 it('changes a private account password and revokes its session',async()=>{const u=await s.manageUser(doctor,{username:'password-test',name:'Fictional Password Tester',role:'front_desk',password:'OldPassword!2026'});const l=await login('password-test','OldPassword!2026','password-ip');const staff=(await db.select().from(users).where(eq(users.id,u.id)))[0];await expect(s.changePassword(staff,{currentPassword:'wrong',password:'NewPassword!2026'})).rejects.toMatchObject({status:400});await s.changePassword(staff,{currentPassword:'OldPassword!2026',password:'NewPassword!2026'});expect(await getSession(l.token)).toBeNull();await expect(login('password-test','NewPassword!2026','password-ip')).resolves.toHaveProperty('token');});
 it('protects supplied public demo accounts',async()=>{await db.update(users).set({protected:true}).where(eq(users.id,desk.id));process.env.DEMO_MODE='true';try{await expect(s.manageUser(doctor,{version:desk.version,role:'front_desk',active:false},desk.id)).rejects.toMatchObject({status:403});await expect(s.changePassword({...desk,protected:true},{currentPassword:'DeskDemo!2026',password:'Replacement!2026'})).rejects.toMatchObject({status:403});}finally{process.env.DEMO_MODE='false';await db.update(users).set({protected:false}).where(eq(users.id,desk.id));}});
 it('generates record numbers without truncating a long sequence value',async()=>{await db.execute(sql`CREATE TEMP SEQUENCE long_record_sequence START 1000000`);const result=await s.rows(sql`SELECT next_record_number('PC-','long_record_sequence') AS mrn`);expect(result[0].mrn).toBe('PC-1000000');});
 it('returns clinical outputs only after a final entry',async()=>{const v=await s.startVisit(doctor,{patientId,doctorId});await expect(s.reportData(doctor,'summary',v.id)).rejects.toMatchObject({status:404});await s.saveClinical(doctor,v.id,{...emptyClinical,expectedRevision:0,state:'draft'});await expect(s.reportData(doctor,'summary',v.id)).rejects.toMatchObject({status:400});await s.saveClinical(doctor,v.id,{...emptyClinical,expectedRevision:1,state:'final',diagnosis:'Fictional diagnosis'});for(const kind of ['summary','prescription','certificate'])expect(await s.reportData(doctor,kind,v.id)).toHaveProperty('clinical');expect(await s.reportData(desk,'attendance',v.id)).not.toHaveProperty('clinical');expect(await s.reportData(doctor,'history',patientId)).toHaveProperty('clinical');await expect(s.reportData(doctor,'unknown',patientId)).rejects.toMatchObject({status:404});});
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
    await db
      .insert(sessions)
      .values({
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
    expect(p).not.toHaveProperty("documents");
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
    const u = await s.manageUser(doctor, {
      username: "test-desk",
      name: "Fictional Tester",
      role: "front_desk",
      password: "TestPassword!2026",
    });
    const l = await login("test-desk", "TestPassword!2026", "new-user");
    await s.manageUser(
      doctor,
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
    const [a, b] = await Promise.all([
      s.savePatient(desk, input),
      s.savePatient(desk, input),
    ]);
    expect(a.patient.mrn).not.toBe(b.patient.mrn);
    const c = await s.savePatient(desk, input);
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
      await s.savePatient(doctor, {
        firstName: "Archived",
        lastName: "Fictional",
        dob: "2000-01-01",
        phone: "876-555-0100",
        address: "Sample Road",
      })
    ).patient;
    await s.archivePatient(doctor, p.id, {
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
    const v = await s.startVisit(doctor, { patientId, doctorId });
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
    await s.reconcilePatient(doctor, p.id, {
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
