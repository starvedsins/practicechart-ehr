import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, type Executor } from "./db";
import {
  users,
  patients,
  appointments,
  visits,
  clinicalRevisions,
  documents,
  invoices,
  auditEvents,
  sessions,
  type Staff,
} from "./schema";
import { AppError, requireRole, hashPassword, digest } from "./auth";
import {
  patientInput,
  appointmentInput,
  clinicalInput,
  invoiceInput,
  invoiceTotal,
  userInput,
  idSchema,
} from "./validation";
type Row = Record<string, unknown>;
export async function rows(q: SQL, ex: Executor = db) {
  return (await ex.execute(q)).rows;
}
export async function event(
  ex: Executor,
  actor: Staff,
  action: string,
  entity: string,
  id = "",
  metadata: Row = {},
) {
  await ex
    .insert(auditEvents)
    .values({ actorId: actor.id, action, entity, entityId: id, metadata });
}
async function found<T>(list: T[], message = "The record was not found.") {
  if (!list.length) throw new AppError(404, message);
  return list[0];
}
export async function patientList(actor: Staff, search = "") {
  const term = `%${search.trim().slice(0, 100).replace(/[%_]/g, "")}%`;
  return db.transaction(async (tx) => {
    await event(tx, actor, "search", "patient");
    return rows(
      sql`SELECT id,mrn,first_name,last_name,dob,phone,address,gender,provisional_reason,merged_into,archived,version FROM patients WHERE (mrn ILIKE ${term} OR first_name ILIKE ${term} OR last_name ILIKE ${term} OR (first_name||' '||last_name) ILIKE ${term}) ORDER BY last_name,first_name LIMIT 100`,
      tx,
    );
  });
}
export async function patientDetail(actor: Staff, id: string) {
  idSchema.parse(id);
  return db.transaction(async (tx) => {
    const p = await found(
      await tx.select().from(patients).where(eq(patients.id, id)),
    );
    await event(tx, actor, "view", "patient", id);
    const visitList = await rows(
      sql`SELECT v.id,v.patient_id,v.doctor_id,v.status,v.revision,v.visit_at,v.filed_at,u.name AS doctor_name FROM visits v JOIN users u ON u.id=v.doctor_id WHERE patient_id=${id} ORDER BY visit_at DESC`,
      tx,
    );
    const appointmentList = await rows(
      sql`SELECT a.*,u.name AS doctor_name FROM appointments a JOIN users u ON u.id=a.doctor_id WHERE patient_id=${id} ORDER BY start_at DESC`,
      tx,
    );
    if (actor.role !== "doctor")
      return { patient: p, visits: visitList, appointments: appointmentList };
    const clinical = await rows(
      sql`SELECT c.*,u.name AS author_name FROM clinical_revisions c JOIN users u ON u.id=c.author_id JOIN visits v ON v.id=c.visit_id WHERE v.patient_id=${id} ORDER BY c.created_at DESC,c.revision DESC`,
      tx,
    );
    const files = await tx
      .select({
        id: documents.id,
        title: documents.title,
        kind: documents.kind,
        mime: documents.mime,
        size: documents.size,
        createdAt: documents.createdAt,
        replacesId: documents.replacesId,
      })
      .from(documents)
      .where(eq(documents.patientId, id));
    return {
      patient: p,
      visits: visitList,
      appointments: appointmentList,
      clinical,
      documents: files,
    };
  });
}
export async function savePatient(actor: Staff, input: unknown, id?: string) {
  const data = patientInput.parse(input);
  return db.transaction(async (tx) => {
    if (id) {
      idSchema.parse(id);
      const version = z
        .object({ version: z.number().int().positive() })
        .parse(input).version;
      const [p] = await tx
        .update(patients)
        .set({ ...data, version: version + 1 })
        .where(and(eq(patients.id, id), eq(patients.version, version)))
        .returning();
      if (!p)
        throw new AppError(
          409,
          "This patient changed. Reload the record before you save.",
        );
      await event(tx, actor, "update", "patient", id, { version });
      return { patient: p };
    }
    const duplicates = await rows(
      sql`SELECT id,mrn FROM patients WHERE lower(first_name)=lower(${data.firstName}) AND lower(last_name)=lower(${data.lastName}) AND dob=${data.dob}::date LIMIT 5`,
      tx,
    );
    const [p] = await tx
      .insert(patients)
      .values({ ...data, mrn: sql`DEFAULT` })
      .returning();
    await event(tx, actor, "create", "patient", p.id);
    return { patient: p, duplicates };
  });
}
export async function archivePatient(actor: Staff, id: string, input: unknown) {
  await requireRole(actor);
  const { version, archived } = z
    .object({ version: z.number().int(), archived: z.boolean() })
    .parse(input);
  return db.transaction(async (tx) => {
    const [p] = await tx
      .update(patients)
      .set({ archived, version: version + 1 })
      .where(
        and(eq(patients.id, idSchema.parse(id)), eq(patients.version, version)),
      )
      .returning();
    if (!p) throw new AppError(409, "This record changed. Reload it.");
    await event(tx, actor, archived ? "archive" : "restore", "patient", id);
    return p;
  });
}
export async function reconcilePatient(
  actor: Staff,
  id: string,
  input: unknown,
) {
  await requireRole(actor);
  const { targetId, reason } = z
    .object({ targetId: idSchema, reason: z.string().trim().min(3).max(500) })
    .parse(input);
  idSchema.parse(id);
  if (id === targetId) throw new AppError(400, "Choose a different patient.");
  return db.transaction(async (tx) => {
    const list = await rows(
      sql`SELECT * FROM patients WHERE id IN(${id}::uuid,${targetId}::uuid) ORDER BY id FOR UPDATE`,
      tx,
    );
    if (list.length !== 2) throw new AppError(404, "Both patients must exist.");
    const source = list.find((p) => p.id === id);
    const target = list.find((p) => p.id === targetId);
    if (
      !source?.provisional_reason ||
      source.merged_into ||
      target?.merged_into
    )
      throw new AppError(
        400,
        "Use an unresolved provisional record and an active primary record.",
      );
    await tx
      .update(patients)
      .set({
        mergedInto: targetId,
        archived: true,
        version: Number(source.version) + 1,
      })
      .where(eq(patients.id, id));
    await event(tx, actor, "reconcile", "patient", id, { targetId, reason });
    return { targetId };
  });
}
export async function schedule(actor: Staff, date?: string) {
  const day =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Jamaica",
        }).format(new Date());
  return db.transaction(async (tx) => {
    await event(tx, actor, "view", "schedule");
    return rows(
      sql`SELECT a.*,p.mrn,p.first_name,p.last_name,u.name AS doctor_name FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN users u ON u.id=a.doctor_id WHERE (a.start_at AT TIME ZONE 'America/Jamaica')::date=${day}::date ORDER BY a.start_at`,
      tx,
    );
  });
}
export async function availability(
  actor: Staff,
  doctorId: string,
  date: string,
) {
  idSchema.parse(doctorId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new AppError(400, "Choose a valid date.");
  await event(db, actor, "view", "availability");
  return rows(
    sql`SELECT slot AS start_at,slot+interval '30 minutes' AS end_at FROM doctor_hours h CROSS JOIN LATERAL generate_series((${date}::date+make_interval(mins=>h.start_min)) AT TIME ZONE 'America/Jamaica',(${date}::date+make_interval(mins=>h.end_min-30)) AT TIME ZONE 'America/Jamaica',interval '30 minutes') slot WHERE h.doctor_id=${doctorId}::uuid AND h.weekday=extract(isodow FROM ${date}::date) AND slot>now() AND NOT EXISTS(SELECT 1 FROM appointments a WHERE a.doctor_id=h.doctor_id AND a.status IN('confirmed','arrived','in_consultation') AND tstzrange(a.start_at,a.end_at,'[)') && tstzrange(slot,slot+interval '30 minutes','[)')) AND NOT EXISTS(SELECT 1 FROM schedule_blocks b WHERE b.doctor_id=h.doctor_id AND tstzrange(b.start_at,b.end_at,'[)') && tstzrange(slot,slot+interval '30 minutes','[)'))`,
  );
}
export async function bookAppointment(
  actor: Staff,
  input: unknown,
  id?: string,
) {
  const data = appointmentInput.parse(input);
  return db.transaction(async (tx) => {
    const p = await found(
      await tx.select().from(patients).where(eq(patients.id, data.patientId)),
    );
    if (p.archived || p.mergedInto)
      throw new AppError(400, "Choose an active patient record.");
    if (id) {
      idSchema.parse(id);
      const { version } = z
        .object({ version: z.number().int().positive() })
        .parse(input);
      const [a] = await tx
        .update(appointments)
        .set({
          ...data,
          startAt: new Date(data.startAt),
          endAt: new Date(data.endAt),
          version: version + 1,
        })
        .where(
          and(
            eq(appointments.id, id),
            eq(appointments.version, version),
            eq(appointments.status, "confirmed"),
          ),
        )
        .returning();
      if (!a)
        throw new AppError(
          409,
          "This appointment changed or has started. Reload the schedule.",
        );
      await event(tx, actor, "reschedule", "appointment", id, { version });
      return a;
    }
    const [a] = await tx
      .insert(appointments)
      .values({
        ...data,
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
      })
      .returning();
    await event(tx, actor, "confirm", "appointment", a.id);
    return a;
  });
}
export async function appointmentStatus(
  actor: Staff,
  id: string,
  input: unknown,
) {
  const { version, status } = z
    .object({
      version: z.number().int(),
      status: z.enum(["cancelled", "arrived"]),
    })
    .parse(input);
  return db.transaction(async (tx) => {
    const [a] = await tx
      .update(appointments)
      .set({ status, version: version + 1 })
      .where(
        and(
          eq(appointments.id, idSchema.parse(id)),
          eq(appointments.version, version),
          eq(appointments.status, "confirmed"),
        ),
      )
      .returning();
    if (!a)
      throw new AppError(
        409,
        "This appointment changed or cannot enter that state.",
      );
    await event(tx, actor, status, "appointment", id);
    return a;
  });
}
export async function startVisit(actor: Staff, input: unknown) {
  const data = z
    .object({
      patientId: idSchema,
      doctorId: idSchema,
      appointmentId: idSchema.optional(),
    })
    .parse(input);
  return db.transaction(async (tx) => {
    const p = await found(
      await tx.select().from(patients).where(eq(patients.id, data.patientId)),
    );
    if (p.archived) throw new AppError(400, "This patient record is archived.");
    await found(
      await rows(
        sql`SELECT id FROM users WHERE id=${data.doctorId}::uuid AND active AND role='doctor'`,
        tx,
      ),
      "Choose an active doctor.",
    );
    if (data.appointmentId) {
      const a = await found(
        await rows(
          sql`SELECT * FROM appointments WHERE id=${data.appointmentId}::uuid FOR UPDATE`,
          tx,
        ),
      );
      if (
        a.patient_id !== data.patientId ||
        a.doctor_id !== data.doctorId ||
        !["confirmed", "arrived"].includes(String(a.status))
      )
        throw new AppError(
          400,
          "Use a matching confirmed or arrived appointment.",
        );
      await tx
        .update(appointments)
        .set({ status: "in_consultation", version: Number(a.version) + 1 })
        .where(eq(appointments.id, data.appointmentId));
    }
    const [v] = await tx.insert(visits).values(data).returning();
    await event(tx, actor, "start", "visit", v.id);
    return v;
  });
}
export async function saveClinical(actor: Staff, id: string, input: unknown) {
  await requireRole(actor);
  idSchema.parse(id);
  const data = clinicalInput.parse(input);
  return db.transaction(async (tx) => {
    const v = await found(
      await rows(sql`SELECT * FROM visits WHERE id=${id}::uuid FOR UPDATE`, tx),
    );
    if (Number(v.revision) !== data.expectedRevision)
      throw new AppError(
        409,
        "Another doctor saved a revision. Reload this visit.",
      );
    const previous = await rows(
      sql`SELECT state FROM clinical_revisions WHERE visit_id=${id}::uuid ORDER BY revision DESC LIMIT 1`,
      tx,
    );
    if (
      previous[0]?.state === "final" &&
      (!data.reason || data.state !== "final")
    )
      throw new AppError(
        400,
        "Add a correction reason and save a final correction.",
      );
    const { expectedRevision, state, reason, ...content } = data;
    const revision = expectedRevision + 1;
    const [r] = await tx
      .insert(clinicalRevisions)
      .values({
        visitId: id,
        revision,
        authorId: actor.id,
        state,
        reason,
        content,
      })
      .returning();
    await tx
      .update(visits)
      .set({
        revision,
        status:
          v.status === "filed" ? "filed" : state === "final" ? "ready" : "open",
      })
      .where(eq(visits.id, id));
    if (state === "final")
      for (const medication of content.medications)
        await tx.execute(
          sql`INSERT INTO prescriptions(visit_id,revision_id,patient_id,content) VALUES(${id},${r.id},${v.patient_id}::uuid,${JSON.stringify(medication)}::jsonb)`,
        );
    await event(
      tx,
      actor,
      previous[0]?.state === "final" ? "correct" : "save_revision",
      "visit",
      id,
      { revision, state, reason },
    );
    return r;
  });
}
export async function fileVisit(actor: Staff, id: string, input: unknown) {
  const { expectedRevision } = z
    .object({ expectedRevision: z.number().int().positive() })
    .parse(input);
  return db.transaction(async (tx) => {
    const v = await found(
      await rows(
        sql`SELECT * FROM visits WHERE id=${idSchema.parse(id)}::uuid FOR UPDATE`,
        tx,
      ),
    );
    const c = await rows(
      sql`SELECT content,state FROM clinical_revisions WHERE visit_id=${id}::uuid AND revision=${expectedRevision}`,
      tx,
    );
    if (
      v.status !== "ready" ||
      Number(v.revision) !== expectedRevision ||
      c[0]?.state !== "final" ||
      !(c[0].content as Row)?.diagnosis
    )
      throw new AppError(
        409,
        "The doctor must complete the diagnosis before this visit can be filed.",
      );
    await tx
      .update(visits)
      .set({ status: "filed", filedAt: new Date() })
      .where(eq(visits.id, id));
    if (v.appointment_id)
      await tx.execute(
        sql`UPDATE appointments SET status='completed',version=version+1 WHERE id=${v.appointment_id}::uuid`,
      );
    await event(tx, actor, "file", "visit", id);
    return { filed: true };
  });
}
export async function saveInvoice(actor: Staff, input: unknown) {
  const data = invoiceInput.parse(input);
  const totalCents = invoiceTotal(data.lines);
  return db.transaction(async (tx) => {
    await found(
      await tx
        .select({ id: patients.id })
        .from(patients)
        .where(eq(patients.id, data.patientId)),
    );
    const [i] = await tx
      .insert(invoices)
      .values({ ...data, totalCents, number: sql`DEFAULT` })
      .returning();
    await event(tx, actor, "create", "invoice", i.id);
    return i;
  });
}
export async function setInvoiceStatus(
  actor: Staff,
  id: string,
  input: unknown,
) {
  const { version, status, reason } = z
    .object({
      version: z.number().int(),
      status: z.enum(["issued", "void"]),
      reason: z.string().trim().max(500).default(""),
    })
    .parse(input);
  if (status === "void" && !reason)
    throw new AppError(400, "Enter a reason to void the invoice.");
  return db.transaction(async (tx) => {
    const [i] = await tx
      .update(invoices)
      .set({ status, reason, version: version + 1 })
      .where(
        and(
          eq(invoices.id, idSchema.parse(id)),
          eq(invoices.version, version),
          eq(invoices.status, status === "issued" ? "draft" : "issued"),
        ),
      )
      .returning();
    if (!i)
      throw new AppError(
        409,
        "This invoice changed or cannot enter that state.",
      );
    await event(tx, actor, status, "invoice", id, { reason });
    return i;
  });
}
export async function invoiceList(actor: Staff) {
  await event(db, actor, "view", "invoice_list");
  return rows(
    sql`SELECT i.*,p.first_name,p.last_name,p.mrn FROM invoices i JOIN patients p ON p.id=i.patient_id ORDER BY i.created_at DESC LIMIT 100`,
  );
}
export async function manageUser(actor: Staff, input: unknown, id?: string) {
  await requireRole(actor);
  if (!id) {
    const d = userInput.parse(input);
    const passwordHash = await hashPassword(d.password);
    return db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          username: d.username,
          name: d.name,
          role: d.role,
          passwordHash,
        })
        .returning({ id: users.id });
      if (d.role === "doctor")
        await tx.execute(
          sql`INSERT INTO doctor_hours(doctor_id,weekday,start_min,end_min) SELECT ${u.id}::uuid,n,480,1020 FROM generate_series(1,5)n`,
        );
      await event(tx, actor, "create", "user", u.id);
      return u;
    });
  }
  const d = z
    .object({
      role: z.enum(["doctor", "front_desk"]),
      active: z.boolean(),
      version: z.number().int(),
      password: z.string().min(12).max(128).optional(),
    })
    .parse(input);
  const passwordHash = d.password ? await hashPassword(d.password) : undefined;
  return db.transaction(async (tx) => {
    const old = await found(
      await tx
        .select()
        .from(users)
        .where(eq(users.id, idSchema.parse(id))),
    );
    if (old.protected && process.env.DEMO_MODE === "true")
      throw new AppError(403, "The supplied demo accounts cannot be changed.");
    const [u] = await tx
      .update(users)
      .set({
        role: d.role,
        active: d.active,
        version: d.version + 1,
        ...(passwordHash ? { passwordHash } : {}),
      })
      .where(and(eq(users.id, id), eq(users.version, d.version)))
      .returning({ id: users.id });
    if (!u) throw new AppError(409, "This account changed. Reload the list.");
    if (d.role === "doctor")
      await tx.execute(
        sql`INSERT INTO doctor_hours(doctor_id,weekday,start_min,end_min) SELECT ${id}::uuid,n,480,1020 FROM generate_series(1,5)n ON CONFLICT DO NOTHING`,
      );
    await tx.delete(sessions).where(eq(sessions.userId, id));
    await event(tx, actor, "update", "user", id);
    return u;
  });
}
export async function changePassword(actor: Staff, input: unknown) {
  const { currentPassword, password } = z
    .object({
      currentPassword: z.string().max(128),
      password: z.string().min(12).max(128),
    })
    .parse(input);
  if (actor.protected && process.env.DEMO_MODE === "true")
    throw new AppError(403, "The supplied demo password cannot be changed.");
  const [u] = await db.select().from(users).where(eq(users.id, actor.id));
  const { verify } = await import("@node-rs/argon2");
  if (!(await verify(u.passwordHash, currentPassword)))
    throw new AppError(400, "The current password is incorrect.");
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, version: u.version + 1 })
      .where(eq(users.id, actor.id));
    await tx.delete(sessions).where(eq(sessions.userId, actor.id));
    await event(tx, actor, "password_change", "user", actor.id);
  });
  return { logout: true };
}
export async function dashboard(actor: Staff) {
  return db.transaction(async (tx) => {
    await event(tx, actor, "view", "dashboard");
    const counts = await rows(
      sql`SELECT (SELECT count(*) FROM patients WHERE NOT archived) AS patients,(SELECT count(*) FROM appointments WHERE status IN('confirmed','arrived','in_consultation') AND (start_at AT TIME ZONE 'America/Jamaica')::date=(now() AT TIME ZONE 'America/Jamaica')::date) AS appointments,(SELECT count(*) FROM visits WHERE status='ready') AS ready,(SELECT count(*) FROM visits WHERE status='filed') AS filed`,
      tx,
    );
    const ready = await rows(
      sql`SELECT v.id,v.revision,v.status,v.patient_id,p.first_name,p.last_name,p.mrn FROM visits v JOIN patients p ON p.id=v.patient_id WHERE v.status='ready' ORDER BY v.visit_at LIMIT 10`,
      tx,
    );
    const reminders = await rows(
      sql`SELECT r.id,a.start_at,p.first_name,p.last_name,p.mrn FROM reminders r JOIN appointments a ON a.id=r.appointment_id JOIN patients p ON p.id=a.patient_id WHERE r.due_date >= (now() AT TIME ZONE 'America/Jamaica')::date AND a.status='confirmed' ORDER BY a.start_at LIMIT 10`,
      tx,
    );
    return { counts: counts[0], ready, reminders };
  });
}
export async function reportData(actor: Staff, type: string, id: string) {
  if (
    ![
      "schedule",
      "attendance",
      "invoice",
      "history",
      "prescription",
      "certificate",
      "summary",
      "visits",
    ].includes(type)
  )
    throw new AppError(404, "The report was not found.");
  if (["history", "prescription", "certificate", "summary"].includes(type))
    await requireRole(actor);
  if (type === "schedule")
    return { type, appointments: await schedule(actor, id) };
  if (type === "visits") {
    await event(db, actor, "export", "visit_counts");
    return {
      type,
      counts: await rows(
        sql`SELECT (visit_at AT TIME ZONE 'America/Jamaica')::date AS day,count(*) AS visits,count(*) FILTER(WHERE status='filed') AS filed FROM visits GROUP BY day ORDER BY day DESC LIMIT 30`,
      ),
    };
  }
  idSchema.parse(id);
  await event(db, actor, "export", type, id);
  if (type === "invoice")
    return {
      type,
      invoice: await found(
        await rows(
          sql`SELECT i.*,p.first_name,p.last_name,p.mrn,p.address FROM invoices i JOIN patients p ON p.id=i.patient_id WHERE i.id=${id}::uuid`,
        ),
      ),
    };
  if (type === "history") return { type, ...(await patientDetail(actor, id)) };
  const v = await found(
    await rows(
      sql`SELECT v.*,p.first_name,p.last_name,p.mrn,u.name AS doctor_name FROM visits v JOIN patients p ON p.id=v.patient_id JOIN users u ON u.id=v.doctor_id WHERE v.id=${id}::uuid`,
    ),
  );
  if (type === "attendance")
    return {
      type,
      visit: {
        id: v.id,
        mrn: v.mrn,
        first_name: v.first_name,
        last_name: v.last_name,
        visit_at: v.visit_at,
        doctor_name: v.doctor_name,
        status: v.status,
      },
    };
  const c = await found(
    await rows(
      sql`SELECT content,state,revision,created_at FROM clinical_revisions WHERE visit_id=${id}::uuid ORDER BY revision DESC LIMIT 1`,
    ),
    "No clinical entry is available.",
  );
  if (c.state !== "final")
    throw new AppError(
      400,
      "Complete the clinical entry before you print this document.",
    );
  return { type, visit: v, clinical: c };
}
