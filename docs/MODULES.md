# Processing narratives and pseudocode

Generated from the current application source. The source listing remains the detailed programme reference. SQL and library internals are represented as calls. Transaction callbacks are expanded. Array callbacks stay within their library operation. The graphs cover explicit application branches, short-circuit conditions, conditional expressions, and loops. A try block includes an explicit I/O failure branch. External library internals are not counted.

## patientList

Search demographic records with parameters and record the search event.

Source: src/lib/service.ts. Graph: [patientList](diagrams/cfg/patientList.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START patientList
  GO TO L3
L2: END PROCEDURE
L3: const term = `%${search.trim().slice(0, 100).replace(/[%_]/g, "")}%`;
  GO TO L4
L4: BEGIN transaction
  GO TO L6
L5: COMMIT transaction
  GO TO L2
L6: await event(tx, actor, "search", "patient");
  GO TO L7
L7: RETURN rows( sql`SELECT id,mrn,first_name,last_name,dob,phone,address,gender,provisional_reason,merged_into,archived,version FROM patients WHERE (mrn
  GO TO L5
```

## patientDetail

Read a patient and visits. Return document metadata to staff and clinical history only to a doctor.

Source: src/lib/service.ts. Graph: [patientDetail](diagrams/cfg/patientDetail.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START patientDetail
  GO TO L3
L2: END PROCEDURE
L3: idSchema.parse(id);
  GO TO L4
L4: BEGIN transaction
  GO TO L6
L5: COMMIT transaction
  GO TO L2
L6: const p = await found( await tx.select().from(patients).where(eq(patients.id, id)), );
  GO TO L7
L7: await event(tx, actor, "view", "patient", id);
  GO TO L8
L8: const family = ( await rows( sql`WITH RECURSIVE edges(a,b) AS (SELECT id,merged_into FROM patients WHERE merged_into IS NOT NULL UNION SELECT merged_i
  GO TO L9
L9: const ids = sql.join( family.map((p) => sql`${p}::uuid`), sql`, `, );
  GO TO L10
L10: const visitList = await rows( sql`SELECT v.id,v.patient_id,v.doctor_id,v.status,v.revision,v.visit_at,v.filed_at,u.name AS doctor_name FROM visits v J
  GO TO L11
L11: const appointmentList = await rows( sql`SELECT a.*,u.name AS doctor_name FROM appointments a JOIN users u ON u.id=a.doctor_id WHERE patient_id IN (${i
  GO TO L12
L12: const files = await tx .select({ id: documents.id, title: documents.title, kind: documents.kind, mime: documents.mime, size: documents.size, createdAt
  GO TO L13
L13: IF actor.role !== "doctor"
  THEN GO TO L14
  ELSE GO TO L15
L14: RETURN { patient: p, visits: visitList, appointments: appointmentList, documents: files, }
  GO TO L5
L15: const clinical = await rows( sql`SELECT c.*,u.name AS author_name FROM clinical_revisions c JOIN users u ON u.id=c.author_id JOIN visits v ON v.id=c.v
  GO TO L16
L16: RETURN { patient: p, visits: visitList, appointments: appointmentList, clinical, documents: files, }
  GO TO L5
```

## savePatient

Validate demographics. Create an MRN or update the expected record version. Warn about possible duplicates.

Source: src/lib/service.ts. Graph: [savePatient](diagrams/cfg/savePatient.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START savePatient
  GO TO L3
L2: END PROCEDURE
L3: await requireRole(actor, "front_desk");
  GO TO L4
L4: const data = patientInput.parse(input);
  GO TO L5
L5: BEGIN transaction
  GO TO L7
L6: COMMIT transaction
  GO TO L2
L7: IF id
  THEN GO TO L8
  ELSE GO TO L15
L8: idSchema.parse(id);
  GO TO L9
L9: const version = z .object({ version: z.number().int().positive() }) .parse(input).version;
  GO TO L10
L10: const [p] = await tx .update(patients) .set({ ...data, reviewedBy: null, reviewedAt: null, reviewReason: "", version: version + 1, }) .where(and(eq(pa
  GO TO L11
L11: IF p
  THEN GO TO L13
  ELSE GO TO L12
L12: RAISE new AppError( 409, "This patient changed. Reload the record before you save.", )
  GO TO L2
L13: await event(tx, actor, "update", "patient", id, { version });
  GO TO L14
L14: RETURN { patient: p, duplicates: [] as Record<string, unknown>[] }
  GO TO L6
L15: RETURN insertPatient(tx, actor, data, input)
  GO TO L6
```

## duplicatePatients

Require reception access. Check matching names and birth dates before a new record is saved.

Source: src/lib/service.ts. Graph: [duplicatePatients](diagrams/cfg/duplicatePatients.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START duplicatePatients
  GO TO L3
L2: END PROCEDURE
L3: await requireRole(actor, "front_desk");
  GO TO L4
L4: const data = patientInput.parse(input);
  GO TO L5
L5: await event(db, actor, "search", "patient_duplicates");
  GO TO L6
L6: RETURN rows( sql`SELECT id,mrn,first_name,last_name,dob FROM patients WHERE lower(first_name)=lower(${data.firstName}) AND lower(last_name)=lower(${da
  GO TO L2
```

## insertPatient

Serialize matching registrations. Require a reason for a separate matching person. Create the MRN and audit event in the caller's transaction.

Source: src/lib/service.ts. Graph: [insertPatient](diagrams/cfg/insertPatient.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START insertPatient
  GO TO L3
L2: END PROCEDURE
L3: await tx.execute( sql`SELECT pg_advisory_xact_lock(hashtextextended(lower(${data.firstName})||':'||lower(${data.lastName})||':'||${data.dob},0))`, );
  GO TO L4
L4: const duplicates = await rows( sql`SELECT id,mrn FROM patients WHERE lower(first_name)=lower(${data.firstName}) AND lower(last_name)=lower(${data.last
  GO TO L5
L5: const { duplicateReason } = z .object({ duplicateReason: z.string().trim().max(500).default("") }) .parse(input);
  GO TO L6
L6: IF duplicates.length
  THEN GO TO L7
  ELSE GO TO L9
L7: IF duplicateReason.length < 3
  THEN GO TO L8
  ELSE GO TO L9
L8: RAISE new AppError( 409, "A matching name and birth date already exist. Review the existing record, or enter a reason to create a separate record.", )
  GO TO L2
L9: const [p] = await tx .insert(patients) .values({ ...data, mrn: sql`DEFAULT` }) .returning();
  GO TO L10
L10: IF duplicates.length
  THEN GO TO L11
  ELSE GO TO L13
L11: await event(tx, actor, "create", "patient", p.id, { ...(duplicates.length ? { duplicateReason } : {}), });
  GO TO L12
L12: RETURN { patient: p, duplicates }
  GO TO L2
L13: Follow False branch
  GO TO L11
```

## archivePatient

Require a receptionist and the current version before changing patient archive status.

Source: src/lib/service.ts. Graph: [archivePatient](diagrams/cfg/archivePatient.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START archivePatient
  GO TO L3
L2: END PROCEDURE
L3: await requireRole(actor, "front_desk");
  GO TO L4
L4: const { version, archived } = z .object({ version: z.number().int(), archived: z.boolean() }) .parse(input);
  GO TO L5
L5: BEGIN transaction
  GO TO L7
L6: COMMIT transaction
  GO TO L2
L7: const [p] = await tx .update(patients) .set({ archived, version: version + 1 }) .where( and(eq(patients.id, idSchema.parse(id)), eq(patients.version,
  GO TO L8
L8: IF p
  THEN GO TO L10
  ELSE GO TO L9
L9: RAISE new AppError(409, "This record changed. Reload it.")
  GO TO L2
L10: IF archived
  THEN GO TO L11
  ELSE GO TO L13
L11: await event(tx, actor, archived ? "archive" : "restore", "patient", id);
  GO TO L12
L12: RETURN p
  GO TO L6
L13: Follow False branch
  GO TO L11
```

## reconcilePatient

Require a receptionist. Lock both records and link an unresolved provisional record to its primary record.

Source: src/lib/service.ts. Graph: [reconcilePatient](diagrams/cfg/reconcilePatient.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START reconcilePatient
  GO TO L3
L2: END PROCEDURE
L3: await requireRole(actor, "front_desk");
  GO TO L4
L4: const { targetId, reason } = z .object({ targetId: idSchema, reason: z.string().trim().min(3).max(500) }) .parse(input);
  GO TO L5
L5: idSchema.parse(id);
  GO TO L6
L6: IF id === targetId
  THEN GO TO L7
  ELSE GO TO L8
L7: RAISE new AppError(400, "Choose a different patient.")
  GO TO L2
L8: BEGIN transaction
  GO TO L10
L9: COMMIT transaction
  GO TO L2
L10: const list = await rows( sql`SELECT * FROM patients WHERE id IN(${id}::uuid,${targetId}::uuid) ORDER BY id FOR UPDATE`, tx, );
  GO TO L11
L11: IF list.length !== 2
  THEN GO TO L12
  ELSE GO TO L13
L12: RAISE new AppError(404, "Both patients must exist.")
  GO TO L2
L13: const source = list.find((p) => p.id === id);
  GO TO L14
L14: const target = list.find((p) => p.id === targetId);
  GO TO L15
L15: IF source?.provisional_reason
  THEN GO TO L16
  ELSE GO TO L19
L16: IF source.merged_into
  THEN GO TO L19
  ELSE GO TO L17
L17: IF target?.merged_into
  THEN GO TO L19
  ELSE GO TO L18
L18: IF target?.archived
  THEN GO TO L19
  ELSE GO TO L20
L19: RAISE new AppError( 400, "Use an unresolved provisional record and an active primary record.", )
  GO TO L2
L20: IF source.reviewed_at
  THEN GO TO L22
  ELSE GO TO L21
L21: RAISE new AppError( 400, "A doctor must review the provisional record before it can be linked.", )
  GO TO L2
L22: await tx .update(patients) .set({ mergedInto: targetId, archived: true, version: Number(source.version) + 1, }) .where(eq(patients.id, id));
  GO TO L23
L23: await event(tx, actor, "reconcile", "patient", id, { targetId, reason });
  GO TO L24
L24: RETURN { targetId }
  GO TO L9
```

## reviewProvisional

Require a doctor and the current version. Record the review reason before reception links an interim record.

Source: src/lib/service.ts. Graph: [reviewProvisional](diagrams/cfg/reviewProvisional.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START reviewProvisional
  GO TO L3
L2: END PROCEDURE
L3: await requireRole(actor);
  GO TO L4
L4: const { reason, version } = z .object({ reason: z.string().trim().min(3).max(500), version: z.number().int().positive(), }) .parse(input);
  GO TO L5
L5: BEGIN transaction
  GO TO L7
L6: COMMIT transaction
  GO TO L2
L7: const result = await rows( sql`UPDATE patients SET reviewed_by=${actor.id}::uuid,reviewed_at=now(),review_reason=${reason},version=version+1 WHERE id=
  GO TO L8
L8: IF result.length
  THEN GO TO L10
  ELSE GO TO L9
L9: RAISE new AppError(409, "This provisional record changed. Reload it.")
  GO TO L2
L10: await event(tx, actor, "review", "provisional_patient", id, { reason });
  GO TO L11
L11: RETURN result[0]
  GO TO L6
```

## schedule

Read the appointments for one Jamaica calendar day and record the view.

Source: src/lib/service.ts. Graph: [schedule](diagrams/cfg/schedule.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START schedule
  GO TO L3
L2: END PROCEDURE
L3: IF date
  THEN GO TO L4
  ELSE GO TO L5
L4: IF /^\d{4}-\d{2}-\d{2}$/.test(date)
  THEN GO TO L5
  ELSE GO TO L10
L5: const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Jamaica", }).format(new Date());
  GO TO L6
L6: BEGIN transaction
  GO TO L8
L7: COMMIT transaction
  GO TO L2
L8: await event(tx, actor, "view", "schedule");
  GO TO L9
L9: RETURN rows( sql`SELECT a.*,p.mrn,p.first_name,p.last_name,u.name AS doctor_name FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN users u
  GO TO L7
L10: Follow False branch
  GO TO L5
```

## availability

Find half-hour start times for the full selected visit length. Exclude doctor and patient conflicts and blocked periods. Ignore the current appointment during rescheduling.

Source: src/lib/service.ts. Graph: [availability](diagrams/cfg/availability.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START availability
  GO TO L3
L2: END PROCEDURE
L3: idSchema.parse(doctorId);
  GO TO L4
L4: IF /^\d{4}-\d{2}-\d{2}$/.test(date)
  THEN GO TO L6
  ELSE GO TO L5
L5: RAISE new AppError(400, "Choose a valid date.")
  GO TO L2
L6: await event(db, actor, "view", "availability");
  GO TO L7
L7: const { duration, patientId, excludeId } = z .object({ duration: z.number().int().min(1).max(240).default(30), patientId: idSchema.optional(), exclude
  GO TO L8
L8: IF patientId is not null
  THEN GO TO L9
  ELSE GO TO L12
L9: IF excludeId is not null
  THEN GO TO L10
  ELSE GO TO L13
L10: IF excludeId is not null
  THEN GO TO L11
  ELSE GO TO L14
L11: RETURN rows( sql`SELECT slot AS start_at,slot+make_interval(mins=>${duration}) AS end_at FROM doctor_hours h CROSS JOIN LATERAL generate_series((${dat
  GO TO L2
L12: Follow False branch
  GO TO L9
L13: Follow False branch
  GO TO L10
L14: Follow False branch
  GO TO L11
```

## bookAppointment

Validate the interval and active patient. Insert a confirmed booking or update a current confirmed booking. Audit only a committed change.

Source: src/lib/service.ts. Graph: [bookAppointment](diagrams/cfg/bookAppointment.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START bookAppointment
  GO TO L3
L2: END PROCEDURE
L3: await requireRole(actor, "front_desk");
  GO TO L4
L4: const data = appointmentInput.parse(input);
  GO TO L5
L5: BEGIN transaction
  GO TO L7
L6: COMMIT transaction
  GO TO L2
L7: const p = await found( await tx.select().from(patients).where(eq(patients.id, data.patientId)), );
  GO TO L8
L8: IF p.archived
  THEN GO TO L10
  ELSE GO TO L9
L9: IF p.mergedInto
  THEN GO TO L10
  ELSE GO TO L11
L10: RAISE new AppError(400, "Choose an active patient record.")
  GO TO L2
L11: IF id
  THEN GO TO L12
  ELSE GO TO L19
L12: idSchema.parse(id);
  GO TO L13
L13: const { version } = z .object({ version: z.number().int().positive() }) .parse(input);
  GO TO L14
L14: const [a] = await tx .update(appointments) .set({ ...data, startAt: new Date(data.startAt), endAt: new Date(data.endAt), version: version + 1, }) .whe
  GO TO L15
L15: IF a
  THEN GO TO L17
  ELSE GO TO L16
L16: RAISE new AppError( 409, "This appointment changed or has started. Reload the schedule.", )
  GO TO L2
L17: await event(tx, actor, "reschedule", "appointment", id, { version });
  GO TO L18
L18: RETURN a
  GO TO L6
L19: const [a] = await tx .insert(appointments) .values({ ...data, startAt: new Date(data.startAt), endAt: new Date(data.endAt), }) .returning();
  GO TO L20
L20: await event(tx, actor, "confirm", "appointment", a.id);
  GO TO L21
L21: RETURN a
  GO TO L6
```

## appointmentStatus

Change a current confirmed appointment to arrived or cancelled. Preserve the booking record.

Source: src/lib/service.ts. Graph: [appointmentStatus](diagrams/cfg/appointmentStatus.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START appointmentStatus
  GO TO L3
L2: END PROCEDURE
L3: await requireRole(actor, "front_desk");
  GO TO L4
L4: const { version, status } = z .object({ version: z.number().int(), status: z.enum(["cancelled", "arrived"]), }) .parse(input);
  GO TO L5
L5: BEGIN transaction
  GO TO L7
L6: COMMIT transaction
  GO TO L2
L7: const [a] = await tx .update(appointments) .set({ status, version: version + 1 }) .where( and( eq(appointments.id, idSchema.parse(id)), eq(appointment
  GO TO L8
L8: IF a
  THEN GO TO L10
  ELSE GO TO L9
L9: RAISE new AppError( 409, "This appointment changed or cannot enter that state.", )
  GO TO L2
L10: await event(tx, actor, status, "appointment", id);
  GO TO L11
L11: RETURN a
  GO TO L6
```

## startVisit

Create a walk-in visit or start a matching appointment. Keep its doctor and patient association.

Source: src/lib/service.ts. Graph: [startVisit](diagrams/cfg/startVisit.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START startVisit
  GO TO L3
L2: END PROCEDURE
L3: await requireRole(actor, "front_desk");
  GO TO L4
L4: const data = z .object({ patientId: idSchema, doctorId: idSchema, appointmentId: idSchema.optional(), }) .parse(input);
  GO TO L5
L5: BEGIN transaction
  GO TO L7
L6: COMMIT transaction
  GO TO L2
L7: const p = await found( await tx.select().from(patients).where(eq(patients.id, data.patientId)), );
  GO TO L8
L8: IF p.archived
  THEN GO TO L9
  ELSE GO TO L10
L9: RAISE new AppError(400, "This patient record is archived.")
  GO TO L2
L10: await found( await rows( sql`SELECT id FROM users WHERE id=${data.doctorId}::uuid AND active AND role='doctor'`, tx, ), "Choose an active doctor.", );
  GO TO L11
L11: IF data.appointmentId
  THEN GO TO L12
  ELSE GO TO L18
L12: const a = await found( await rows( sql`SELECT * FROM appointments WHERE id=${data.appointmentId}::uuid FOR UPDATE`, tx, ), );
  GO TO L13
L13: IF a.patient_id !== data.patientId
  THEN GO TO L16
  ELSE GO TO L14
L14: IF a.doctor_id !== data.doctorId
  THEN GO TO L16
  ELSE GO TO L15
L15: IF ["confirmed", "arrived"].includes(String(a.status))
  THEN GO TO L17
  ELSE GO TO L16
L16: RAISE new AppError( 400, "Use a matching confirmed or arrived appointment.", )
  GO TO L2
L17: await tx .update(appointments) .set({ status: "in_consultation", version: Number(a.version) + 1 }) .where(eq(appointments.id, data.appointmentId));
  GO TO L18
L18: const [v] = await tx.insert(visits).values(data).returning();
  GO TO L19
L19: await event(tx, actor, "start", "visit", v.id);
  GO TO L20
L20: RETURN v
  GO TO L6
```

## saveClinical

Require doctor access. Lock the visit, check its revision, and append a draft, final entry, or reasoned final correction.

Source: src/lib/service.ts. Graph: [saveClinical](diagrams/cfg/saveClinical.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START saveClinical
  GO TO L3
L2: END PROCEDURE
L3: await requireRole(actor);
  GO TO L4
L4: idSchema.parse(id);
  GO TO L5
L5: const data = clinicalInput.parse(input);
  GO TO L6
L6: BEGIN transaction
  GO TO L8
L7: COMMIT transaction
  GO TO L2
L8: const v = await found( await rows(sql`SELECT * FROM visits WHERE id=${id}::uuid FOR UPDATE`, tx), );
  GO TO L9
L9: IF Number(v.revision) !== data.expectedRevision
  THEN GO TO L10
  ELSE GO TO L11
L10: RAISE new AppError( 409, "Another doctor saved a revision. Reload this visit.", )
  GO TO L2
L11: const previous = await rows( sql`SELECT state FROM clinical_revisions WHERE visit_id=${id}::uuid ORDER BY revision DESC LIMIT 1`, tx, );
  GO TO L12
L12: IF previous[0]?.state === "final"
  THEN GO TO L13
  ELSE GO TO L16
L13: IF data.reason
  THEN GO TO L14
  ELSE GO TO L15
L14: IF data.state !== "final"
  THEN GO TO L15
  ELSE GO TO L16
L15: RAISE new AppError( 400, "Add a correction reason and save a final correction.", )
  GO TO L2
L16: const { expectedRevision, state, reason, ...content } = data;
  GO TO L17
L17: const revision = expectedRevision + 1;
  GO TO L18
L18: const [r] = await tx .insert(clinicalRevisions) .values({ visitId: id, revision, authorId: actor.id, state, reason, content, }) .returning();
  GO TO L19
L19: IF v.status === "filed"
  THEN GO TO L21
  ELSE GO TO L20
L20: IF state === "final"
  THEN GO TO L21
  ELSE GO TO L28
L21: await tx .update(visits) .set({ revision, status: v.status === "filed" ? "filed" : state === "final" ? "ready" : "open", }) .where(eq(visits.id, id));
  GO TO L22
L22: IF state === "final"
  THEN GO TO L23
  ELSE GO TO L25
L23: IF More items in content.medications
  THEN GO TO L24
  ELSE GO TO L25
L24: await tx.execute( sql`INSERT INTO prescriptions(visit_id,revision_id,patient_id,content) VALUES(${id},${r.id},${v.patient_id}::uuid,${JSON.stringify(m
  GO TO L23
L25: IF previous[0]?.state === "final"
  THEN GO TO L26
  ELSE GO TO L29
L26: await event( tx, actor, previous[0]?.state === "final" ? "correct" : "save_revision", "visit", id, { revision, state, reason }, );
  GO TO L27
L27: RETURN r
  GO TO L7
L28: Follow False branch
  GO TO L21
L29: Follow False branch
  GO TO L26
```

## fileVisit

Lock the visit. Require the current final diagnosis. File the visit and complete its appointment.

Source: src/lib/service.ts. Graph: [fileVisit](diagrams/cfg/fileVisit.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START fileVisit
  GO TO L3
L2: END PROCEDURE
L3: await requireRole(actor, "front_desk");
  GO TO L4
L4: const { expectedRevision } = z .object({ expectedRevision: z.number().int().positive() }) .parse(input);
  GO TO L5
L5: BEGIN transaction
  GO TO L7
L6: COMMIT transaction
  GO TO L2
L7: const v = await found( await rows( sql`SELECT * FROM visits WHERE id=${idSchema.parse(id)}::uuid FOR UPDATE`, tx, ), );
  GO TO L8
L8: const c = await rows( sql`SELECT content,state FROM clinical_revisions WHERE visit_id=${id}::uuid AND revision=${expectedRevision}`, tx, );
  GO TO L9
L9: IF v.status !== "ready"
  THEN GO TO L13
  ELSE GO TO L10
L10: IF Number(v.revision) !== expectedRevision
  THEN GO TO L13
  ELSE GO TO L11
L11: IF c[0]?.state !== "final"
  THEN GO TO L13
  ELSE GO TO L12
L12: IF (c[0].content as Row)?.diagnosis
  THEN GO TO L14
  ELSE GO TO L13
L13: RAISE new AppError( 409, "The doctor must complete the diagnosis before this visit can be filed.", )
  GO TO L2
L14: await tx .update(visits) .set({ status: "filed", filedAt: new Date() }) .where(eq(visits.id, id));
  GO TO L15
L15: IF v.appointment_id
  THEN GO TO L16
  ELSE GO TO L17
L16: await tx.execute( sql`UPDATE appointments SET status='completed',version=version+1 WHERE id=${v.appointment_id}::uuid`, );
  GO TO L17
L17: await event(tx, actor, "file", "visit", id);
  GO TO L18
L18: RETURN { filed: true }
  GO TO L6
```

## saveInvoice

Validate service lines and calculate integer-cent totals before creating an invoice draft.

Source: src/lib/service.ts. Graph: [saveInvoice](diagrams/cfg/saveInvoice.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START saveInvoice
  GO TO L3
L2: END PROCEDURE
L3: await requireRole(actor, "front_desk");
  GO TO L4
L4: const data = invoiceInput.parse(input);
  GO TO L5
L5: const totalCents = invoiceTotal(data.lines);
  GO TO L6
L6: BEGIN transaction
  GO TO L8
L7: COMMIT transaction
  GO TO L2
L8: await found( await tx .select({ id: patients.id }) .from(patients) .where(eq(patients.id, data.patientId)), );
  GO TO L9
L9: const [i] = await tx .insert(invoices) .values({ ...data, totalCents, number: sql`DEFAULT` }) .returning();
  GO TO L10
L10: await event(tx, actor, "create", "invoice", i.id);
  GO TO L11
L11: RETURN i
  GO TO L7
```

## setInvoiceStatus

Issue a draft or void an issued invoice with a reason. Reject stale versions.

Source: src/lib/service.ts. Graph: [setInvoiceStatus](diagrams/cfg/setInvoiceStatus.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START setInvoiceStatus
  GO TO L3
L2: END PROCEDURE
L3: await requireRole(actor, "front_desk");
  GO TO L4
L4: const { version, status, reason } = z .object({ version: z.number().int(), status: z.enum(["issued", "void"]), reason: z.string().trim().max(500).defa
  GO TO L5
L5: IF status === "void"
  THEN GO TO L6
  ELSE GO TO L8
L6: IF reason
  THEN GO TO L8
  ELSE GO TO L7
L7: RAISE new AppError(400, "Enter a reason to void the invoice.")
  GO TO L2
L8: BEGIN transaction
  GO TO L10
L9: COMMIT transaction
  GO TO L2
L10: IF status === "issued"
  THEN GO TO L11
  ELSE GO TO L16
L11: const [i] = await tx .update(invoices) .set({ status, reason, version: version + 1 }) .where( and( eq(invoices.id, idSchema.parse(id)), eq(invoices.ve
  GO TO L12
L12: IF i
  THEN GO TO L14
  ELSE GO TO L13
L13: RAISE new AppError( 409, "This invoice changed or cannot enter that state.", )
  GO TO L2
L14: await event(tx, actor, status, "invoice", id, { reason });
  GO TO L15
L15: RETURN i
  GO TO L9
L16: Follow False branch
  GO TO L11
```

## invoiceList

Read administrative invoice data and record the view.

Source: src/lib/service.ts. Graph: [invoiceList](diagrams/cfg/invoiceList.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START invoiceList
  GO TO L3
L2: END PROCEDURE
L3: await requireRole(actor, "front_desk");
  GO TO L4
L4: await event(db, actor, "view", "invoice_list");
  GO TO L5
L5: RETURN rows( sql`SELECT i.*,p.first_name,p.last_name,p.mrn FROM invoices i JOIN patients p ON p.id=i.patient_id ORDER BY i.created_at DESC LIMIT 100`,
  GO TO L2
```

## manageUser

Require a trusted operator context, not an employee login. Create or change an account. Protect demo accounts, keep a doctor active, and revoke changed sessions.

Source: src/lib/service.ts. Graph: [manageUser](diagrams/cfg/manageUser.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START manageUser
  GO TO L3
L2: END PROCEDURE
L3: await requireRole(actor, "operator");
  GO TO L4
L4: IF id
  THEN GO TO L14
  ELSE GO TO L5
L5: const d = userInput.parse(input);
  GO TO L6
L6: const passwordHash = await hashPassword(d.password);
  GO TO L7
L7: BEGIN transaction
  GO TO L9
L8: COMMIT transaction
  GO TO L2
L9: const [u] = await tx .insert(users) .values({ username: d.username, name: d.name, role: d.role, passwordHash, }) .returning({ id: users.id });
  GO TO L10
L10: IF d.role === "doctor"
  THEN GO TO L11
  ELSE GO TO L12
L11: await tx.execute( sql`INSERT INTO doctor_hours(doctor_id,weekday,start_min,end_min) SELECT ${u.id}::uuid,n,480,1020 FROM generate_series(1,5)n`, );
  GO TO L12
L12: await event(tx, actor, "create", "user", u.id);
  GO TO L13
L13: RETURN u
  GO TO L8
L14: const d = z .object({ role: z.enum(["doctor", "front_desk"]), active: z.boolean(), version: z.number().int(), password: z.string().min(12).max(128).op
  GO TO L15
L15: IF d.password
  THEN GO TO L16
  ELSE GO TO L32
L16: const passwordHash = d.password ? await hashPassword(d.password) : undefined;
  GO TO L17
L17: BEGIN transaction
  GO TO L19
L18: COMMIT transaction
  GO TO L2
L19: const old = await found( await tx .select() .from(users) .where(eq(users.id, idSchema.parse(id))), );
  GO TO L20
L20: IF old.protected
  THEN GO TO L21
  ELSE GO TO L23
L21: IF process.env.DEMO_MODE === "true"
  THEN GO TO L22
  ELSE GO TO L23
L22: RAISE new AppError(403, "The supplied demo accounts cannot be changed.")
  GO TO L2
L23: IF passwordHash
  THEN GO TO L24
  ELSE GO TO L33
L24: const [u] = await tx .update(users) .set({ role: d.role, active: d.active, version: d.version + 1, ...(passwordHash ? { passwordHash } : {}), }) .wher
  GO TO L25
L25: IF u
  THEN GO TO L27
  ELSE GO TO L26
L26: RAISE new AppError(409, "This account changed. Reload the list.")
  GO TO L2
L27: IF d.role === "doctor"
  THEN GO TO L28
  ELSE GO TO L29
L28: await tx.execute( sql`INSERT INTO doctor_hours(doctor_id,weekday,start_min,end_min) SELECT ${id}::uuid,n,480,1020 FROM generate_series(1,5)n ON CONFLI
  GO TO L29
L29: await tx.delete(sessions).where(eq(sessions.userId, id));
  GO TO L30
L30: await event(tx, actor, "update", "user", id);
  GO TO L31
L31: RETURN u
  GO TO L18
L32: Follow False branch
  GO TO L16
L33: Follow False branch
  GO TO L24
```

## changePassword

Verify the current password, hash the replacement, and revoke existing sessions.

Source: src/lib/service.ts. Graph: [changePassword](diagrams/cfg/changePassword.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START changePassword
  GO TO L3
L2: END PROCEDURE
L3: const { currentPassword, password } = z .object({ currentPassword: z.string().max(128), password: z.string().min(12).max(128), }) .parse(input);
  GO TO L4
L4: IF actor.protected
  THEN GO TO L5
  ELSE GO TO L7
L5: IF process.env.DEMO_MODE === "true"
  THEN GO TO L6
  ELSE GO TO L7
L6: RAISE new AppError(403, "The supplied demo password cannot be changed.")
  GO TO L2
L7: const [u] = await db.select().from(users).where(eq(users.id, actor.id));
  GO TO L8
L8: const { verify } = await import("@node-rs/argon2");
  GO TO L9
L9: IF await verify(u.passwordHash, currentPassword)
  THEN GO TO L11
  ELSE GO TO L10
L10: RAISE new AppError(400, "The current password is incorrect.")
  GO TO L2
L11: const passwordHash = await hashPassword(password);
  GO TO L12
L12: BEGIN transaction
  GO TO L14
L13: COMMIT transaction
  GO TO L17
L14: await tx .update(users) .set({ passwordHash, version: u.version + 1 }) .where(eq(users.id, actor.id));
  GO TO L15
L15: await tx.delete(sessions).where(eq(sessions.userId, actor.id));
  GO TO L16
L16: await event(tx, actor, "password_change", "user", actor.id);
  GO TO L13
L17: RETURN { logout: true }
  GO TO L2
```

## dashboard

Read practice counts, ready visits, and in-app reminders without clinical note bodies.

Source: src/lib/service.ts. Graph: [dashboard](diagrams/cfg/dashboard.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START dashboard
  GO TO L3
L2: END PROCEDURE
L3: BEGIN transaction
  GO TO L5
L4: COMMIT transaction
  GO TO L2
L5: await event(tx, actor, "view", "dashboard");
  GO TO L6
L6: const counts = await rows( sql`SELECT (SELECT count(*) FROM patients WHERE NOT archived) AS patients,(SELECT count(*) FROM appointments WHERE status I
  GO TO L7
L7: const ready = await rows( sql`SELECT v.id,v.revision,v.status,v.patient_id,p.first_name,p.last_name,p.mrn FROM visits v JOIN patients p ON p.id=v.pati
  GO TO L8
L8: const reminders = await rows( sql`SELECT r.id,a.start_at,p.first_name,p.last_name,p.mrn FROM reminders r JOIN appointments a ON a.id=r.appointment_id
  GO TO L9
L9: IF actor.role === "doctor"
  THEN GO TO L10
  ELSE GO TO L11
L10: RETURN { counts: actor.role === "doctor" ? { appointments: counts[0].appointments } : counts[0], ready, reminders, }
  GO TO L4
L11: Follow False branch
  GO TO L10
```

## reportData

Select the report type, require clinical permission where needed, and record an export event.

Source: src/lib/service.ts. Graph: [reportData](diagrams/cfg/reportData.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START reportData
  GO TO L3
L2: END PROCEDURE
L3: IF [ "schedule", "attendance", "invoice", "history", "prescription", "certificate", "summary", "visits", ].includes(type)
  THEN GO TO L5
  ELSE GO TO L4
L4: RAISE new AppError(404, "The report was not found.")
  GO TO L2
L5: IF ["history", "prescription", "certificate", "summary"].includes(type)
  THEN GO TO L6
  ELSE GO TO L7
L6: await requireRole(actor);
  GO TO L7
L7: IF type === "schedule"
  THEN GO TO L8
  ELSE GO TO L9
L8: RETURN { type, appointments: await schedule(actor, id) }
  GO TO L2
L9: IF type === "visits"
  THEN GO TO L10
  ELSE GO TO L13
L10: await requireRole(actor, "front_desk");
  GO TO L11
L11: await event(db, actor, "export", "visit_counts");
  GO TO L12
L12: RETURN { type, counts: await rows( sql`SELECT (visit_at AT TIME ZONE 'America/Jamaica')::date AS day,count(*) AS visits,count(*) FILTER(WHERE status='
  GO TO L2
L13: IF ["invoice", "attendance", "visits"].includes(type)
  THEN GO TO L14
  ELSE GO TO L15
L14: await requireRole(actor, "front_desk");
  GO TO L15
L15: idSchema.parse(id);
  GO TO L16
L16: await event(db, actor, "export", type, id);
  GO TO L17
L17: IF type === "invoice"
  THEN GO TO L18
  ELSE GO TO L19
L18: RETURN { type, invoice: await found( await rows( sql`SELECT i.*,p.first_name,p.last_name,p.mrn,p.address FROM invoices i JOIN patients p ON p.id=i.pat
  GO TO L2
L19: IF type === "history"
  THEN GO TO L20
  ELSE GO TO L21
L20: RETURN { type, ...(await patientDetail(actor, id)) }
  GO TO L2
L21: const v = await found( await rows( sql`SELECT v.*,p.first_name,p.last_name,p.mrn,u.name AS doctor_name FROM visits v JOIN patients p ON p.id=v.patient
  GO TO L22
L22: IF type === "attendance"
  THEN GO TO L23
  ELSE GO TO L24
L23: RETURN { type, visit: { id: v.id, mrn: v.mrn, first_name: v.first_name, last_name: v.last_name, visit_at: v.visit_at, doctor_name: v.doctor_name, stat
  GO TO L2
L24: const c = await found( await rows( sql`SELECT content,state,revision,created_at FROM clinical_revisions WHERE visit_id=${id}::uuid ORDER BY revision D
  GO TO L25
L25: IF c.state !== "final"
  THEN GO TO L26
  ELSE GO TO L27
L26: RAISE new AppError( 400, "Complete the clinical entry before you print this document.", )
  GO TO L2
L27: RETURN { type, visit: v, clinical: c }
  GO TO L2
```

## requireRole

Check the server account role and audit denied access.

Source: src/lib/auth.ts. Graph: [requireRole](diagrams/cfg/requireRole.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START requireRole
  GO TO L3
L2: END PROCEDURE
L3: IF actor.role !== role
  THEN GO TO L4
  ELSE GO TO L2
L4: await auditDenied(actor, "clinical_or_admin");
  GO TO L5
L5: RAISE new AppError(403, "Your account cannot use this function.")
  GO TO L2
```

## getSession

Hash the cookie token and find an unexpired session for an active account.

Source: src/lib/auth.ts. Graph: [getSession](diagrams/cfg/getSession.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START getSession
  GO TO L3
L2: END PROCEDURE
L3: IF token
  THEN GO TO L5
  ELSE GO TO L4
L4: RETURN null
  GO TO L2
L5: const rows = await db .select({ id: users.id, username: users.username, name: users.name, role: users.role, protected: users.protected, version: users
  GO TO L6
L6: IF rows[0] is not null
  THEN GO TO L7
  ELSE GO TO L8
L7: RETURN rows[0] ?? null
  GO TO L2
L8: Follow False branch
  GO TO L7
```

## login

Limit attempts, verify a password hash, create a random hashed session, and record the result.

Source: src/lib/auth.ts. Graph: [login](diagrams/cfg/login.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START login
  GO TO L3
L2: END PROCEDURE
L3: const key = digest(username.toLowerCase().trim() + ":" + ip);
  GO TO L4
L4: const attempt = await db.execute( sql`INSERT INTO login_attempts(key,count,expires_at) VALUES(${key},1,now()+interval '15 minutes') ON CONFLICT(key) D
  GO TO L5
L5: IF Number(attempt.rows[0].count) > 8
  THEN GO TO L6
  ELSE GO TO L7
L6: RAISE new AppError( 429, "Too many login attempts. Try again in 15 minutes.", )
  GO TO L2
L7: const [u] = await db .select() .from(users) .where(eq(users.username, username.toLowerCase().trim())) .limit(1);
  GO TO L8
L8: dummy ??= hashPassword(randomBytes(32).toString("hex"));
  GO TO L9
L9: IF u?.passwordHash is not null
  THEN GO TO L10
  ELSE GO TO L23
L10: const valid = await verify(u?.passwordHash ?? (await dummy), password).catch( () => false, );
  GO TO L11
L11: IF u
  THEN GO TO L12
  ELSE GO TO L14
L12: IF u.active
  THEN GO TO L13
  ELSE GO TO L14
L13: IF valid
  THEN GO TO L16
  ELSE GO TO L14
L14: await db .insert(auditEvents) .values({ action: "login_failed", entity: "session" });
  GO TO L15
L15: RAISE new AppError(401, "The username or password is incorrect.")
  GO TO L2
L16: const token = randomBytes(32).toString("hex");
  GO TO L17
L17: BEGIN transaction
  GO TO L19
L18: COMMIT transaction
  GO TO L22
L19: await tx .insert(sessions) .values({ id: digest(token), userId: u.id, expiresAt: new Date(Date.now() + 8 * 3600000), });
  GO TO L20
L20: await tx.execute(sql`DELETE FROM login_attempts WHERE key=${key}`);
  GO TO L21
L21: await tx .insert(auditEvents) .values({ actorId: u.id, action: "login", entity: "session" });
  GO TO L18
L22: RETURN { token, user: { id: u.id, name: u.name, role: u.role, username: u.username }, }
  GO TO L2
L23: Follow False branch
  GO TO L10
```

## storeFile

Validate length, signature, and public demo sample rules before writing an immutable private object.

Source: src/lib/storage.ts. Graph: [storeFile](diagrams/cfg/storeFile.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START storeFile
  GO TO L3
L2: END PROCEDURE
L3: IF bytes.length < 1
  THEN GO TO L5
  ELSE GO TO L4
L4: IF bytes.length > 4194304
  THEN GO TO L5
  ELSE GO TO L6
L5: RAISE new AppError(400, "Use a file from 1 byte to 4 MiB.")
  GO TO L2
L6: const mime = fileMime(bytes);
  GO TO L7
L7: IF mime
  THEN GO TO L8
  ELSE GO TO L9
L8: IF mime !== claimedMime
  THEN GO TO L9
  ELSE GO TO L10
L9: RAISE new AppError( 400, "Use a PDF, PNG, or JPEG file with a matching file type.", )
  GO TO L2
L10: IF process.env.DEMO_MODE === "true"
  THEN GO TO L11
  ELSE GO TO L13
L11: IF bytes.equals(samplePdf)
  THEN GO TO L13
  ELSE GO TO L12
L12: RAISE new AppError( 400, "The public demo accepts only the supplied sample report.", )
  GO TO L2
L13: IF process.env.VERCEL_ENV === "preview"
  THEN GO TO L14
  ELSE GO TO L22
L14: const pathname = `practicechart/${process.env.VERCEL_ENV === "preview" ? "preview" : "records"}/${randomUUID()}`;
  GO TO L15
L15: IF process.env.STORAGE_DRIVER === "blob"
  THEN GO TO L16
  ELSE GO TO L17
L16: await put(pathname, bytes, { access: "private", contentType: mime, addRandomSuffix: false, });
  GO TO L21
L17: IF process.env.PRIVATE_STORAGE_DIR
  THEN GO TO L18
  ELSE GO TO L23
L18: const root = path.resolve( /* turbopackIgnore: true */ process.env.PRIVATE_STORAGE_DIR || ".private/uploads", );
  GO TO L19
L19: await mkdir(path.dirname(path.join(root, pathname)), { recursive: true });
  GO TO L20
L20: await writeFile(path.join(root, pathname), bytes, { flag: "wx" });
  GO TO L21
L21: RETURN { pathname, mime, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), }
  GO TO L2
L22: Follow False branch
  GO TO L14
L23: Follow False branch
  GO TO L18
```

## readPrivateFile

Reject unsafe paths and retrieve a private object. Return a clear missing-file error.

Source: src/lib/storage.ts. Graph: [readPrivateFile](diagrams/cfg/readPrivateFile.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START readPrivateFile
  GO TO L3
L2: END PROCEDURE
L3: IF /^practicechart\/(records|preview)\/[a-f0-9-]{36}$/.test(pathname)
  THEN GO TO L5
  ELSE GO TO L4
L4: RAISE new AppError(404, "The file was not found.")
  GO TO L2
L5: IF I/O operation succeeds
  THEN GO TO L7
  ELSE GO TO L6
L6: Handle I/O failure
  GO TO L15
L7: IF process.env.STORAGE_DRIVER === "blob"
  THEN GO TO L8
  ELSE GO TO L13
L8: const r = await get(pathname, { access: "private" });
  GO TO L9
L9: IF r
  THEN GO TO L10
  ELSE GO TO L11
L10: IF r.statusCode !== 200
  THEN GO TO L11
  ELSE GO TO L12
L11: RAISE new Error("Missing")
  GO TO L6
L12: RETURN Buffer.from(await new Response(r.stream).arrayBuffer())
  GO TO L2
L13: IF process.env.PRIVATE_STORAGE_DIR
  THEN GO TO L14
  ELSE GO TO L16
L14: RETURN await readFile( /* turbopackIgnore: true */ path.join( path.resolve( /* turbopackIgnore: true */ process.env.PRIVATE_STORAGE_DIR || ".private/u
  GO TO L2
L15: RAISE new AppError( 404, "The stored file is not available. Contact the practice operator.", )
  GO TO L2
L16: Follow False branch
  GO TO L14
```

## invoiceTotal

Sum integer quantity times unit cents and reject unsafe or excessive totals.

Source: src/lib/validation.ts. Graph: [invoiceTotal](diagrams/cfg/invoiceTotal.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START invoiceTotal
  GO TO L3
L2: END PROCEDURE
L3: const total = lines.reduce((n, l) => n + l.quantity * l.unitCents, 0);
  GO TO L4
L4: IF Number.isSafeInteger(total)
  THEN GO TO L5
  ELSE GO TO L6
L5: IF total > 2000000000
  THEN GO TO L6
  ELSE GO TO L7
L6: RAISE new Error("Invoice total is too large.")
  GO TO L2
L7: RETURN total
  GO TO L2
```

## fileMime

Classify only PDF, PNG, or JPEG file signatures.

Source: src/lib/validation.ts. Graph: [fileMime](diagrams/cfg/fileMime.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START fileMime
  GO TO L3
L2: END PROCEDURE
L3: IF bytes.subarray(0, 5).toString() === "%PDF-"
  THEN GO TO L4
  ELSE GO TO L5
L4: RETURN "application/pdf"
  GO TO L2
L5: IF bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  THEN GO TO L6
  ELSE GO TO L7
L6: RETURN "image/png"
  GO TO L2
L7: IF bytes[0] === 255
  THEN GO TO L8
  ELSE GO TO L11
L8: IF bytes[1] === 216
  THEN GO TO L9
  ELSE GO TO L11
L9: IF bytes[2] === 255
  THEN GO TO L10
  ELSE GO TO L11
L10: RETURN "image/jpeg"
  GO TO L2
L11: RETURN null
  GO TO L2
```

## submitIntake

Validate a public registration form and consent. Limit submissions, keep an idempotent reference, and store a pending intake without creating a patient MRN.

Source: src/lib/intake.ts. Graph: [submitIntake](diagrams/cfg/submitIntake.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START submitIntake
  GO TO L3
L2: END PROCEDURE
L3: const parsed = z .object({ submissionId: idSchema, consent: z.literal(true), website: z.literal("").default(""), }) .parse(input);
  GO TO L4
L4: const payload = patientInput.parse({ ...(input as object), provisionalReason: "", });
  GO TO L5
L5: IF process.env.DEMO_MODE === "true"
  THEN GO TO L6
  ELSE GO TO L8
L6: IF Object.entries(demoIntake).some( ([k, v]) => payload[k as keyof typeof payload] !== v, )
  THEN GO TO L7
  ELSE GO TO L8
L7: RAISE new AppError( 400, "The public demo accepts only the supplied fictional example. Select Use fictional example and try again.", )
  GO TO L2
L8: BEGIN transaction
  GO TO L10
L9: COMMIT transaction
  GO TO L2
L10: const bucket = digest(address + ":" + Math.floor(Date.now() / 3600000));
  GO TO L11
L11: const limit = await rows( sql`INSERT INTO public_form_limits(bucket,attempts,expires_at) VALUES(${bucket},1,now()+interval '2 hours') ON CONFLICT(buck
  GO TO L12
L12: IF Number(limit[0].attempts) > 10
  THEN GO TO L13
  ELSE GO TO L14
L13: RAISE new AppError( 429, "Too many forms were sent. Try again later or contact reception.", )
  GO TO L2
L14: await tx.execute( sql`INSERT INTO registration_intakes(id,payload) VALUES(${parsed.submissionId},${JSON.stringify(payload)}::jsonb) ON CONFLICT(id) DO
  GO TO L15
L15: await tx.execute( sql`INSERT INTO audit_events(action,entity,entity_id) VALUES('submit','registration_intake',${parsed.submissionId})`, );
  GO TO L16
L16: RETURN { reference: parsed.submissionId, message: "Your form was received. Reception will check it. This does not confirm an appointment.", }
  GO TO L9
```

## intakeList

Require reception access and audit the pending registration form list.

Source: src/lib/intake.ts. Graph: [intakeList](diagrams/cfg/intakeList.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START intakeList
  GO TO L3
L2: END PROCEDURE
L3: await requireRole(actor, "front_desk");
  GO TO L4
L4: BEGIN transaction
  GO TO L6
L5: COMMIT transaction
  GO TO L2
L6: await event(tx, actor, "view", "registration_intakes");
  GO TO L7
L7: RETURN rows( sql`SELECT id,payload,status,version,created_at FROM registration_intakes WHERE status='pending' ORDER BY created_at LIMIT 100`, tx, )
  GO TO L5
```

## reviewIntake

Lock a pending form and check its version. Accept it with duplicate review or reject it with a reason. Commit the patient and review state together.

Source: src/lib/intake.ts. Graph: [reviewIntake](diagrams/cfg/reviewIntake.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START reviewIntake
  GO TO L3
L2: END PROCEDURE
L3: await requireRole(actor, "front_desk");
  GO TO L4
L4: const d = z .object({ version: z.number().int().positive(), action: z.enum(["accept", "reject"]), reason: z.string().trim().max(500).default(""), dupl
  GO TO L5
L5: BEGIN transaction
  GO TO L7
L6: COMMIT transaction
  GO TO L2
L7: const [intake] = await rows( sql`SELECT * FROM registration_intakes WHERE id=${idSchema.parse(id)}::uuid FOR UPDATE`, tx, );
  GO TO L8
L8: IF intake
  THEN GO TO L9
  ELSE GO TO L11
L9: IF intake.status !== "pending"
  THEN GO TO L11
  ELSE GO TO L10
L10: IF intake.version !== d.version
  THEN GO TO L11
  ELSE GO TO L12
L11: RAISE new AppError( 409, "This form was already reviewed or changed. Reload the list.", )
  GO TO L2
L12: IF d.action === "reject"
  THEN GO TO L13
  ELSE GO TO L15
L13: IF d.reason.length < 3
  THEN GO TO L14
  ELSE GO TO L15
L14: RAISE new AppError(400, "Enter a reason to reject the form.")
  GO TO L2
L15: IF d.action === "accept"
  THEN GO TO L16
  ELSE GO TO L23
L16: const result = d.action === "accept" ? await insertPatient(tx, actor, patientInput.parse(intake.payload), d) : null;
  GO TO L17
L17: IF d.action === "accept"
  THEN GO TO L18
  ELSE GO TO L24
L18: IF result?.patient.id
  THEN GO TO L19
  ELSE GO TO L25
L19: await tx.execute( sql`UPDATE registration_intakes SET status=${d.action === "accept" ? "accepted" : "rejected"},patient_id=${result?.patient.id || nul
  GO TO L20
L20: await event(tx, actor, d.action, "registration_intake", id);
  GO TO L21
L21: IF result?.patient
  THEN GO TO L22
  ELSE GO TO L26
L22: RETURN { patient: result?.patient || null }
  GO TO L6
L23: Follow False branch
  GO TO L16
L24: Follow False branch
  GO TO L18
L25: Follow False branch
  GO TO L19
L26: Follow False branch
  GO TO L22
```

## appointmentMessage

Format a plain appointment message in Jamaica time without clinical details.

Source: src/lib/notifications.ts. Graph: [appointmentMessage](diagrams/cfg/appointmentMessage.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START appointmentMessage
  GO TO L3
L2: END PROCEDURE
L3: const date = new Intl.DateTimeFormat("en-JM", { dateStyle: "full", timeStyle: "short", timeZone: "America/Jamaica", }).format(start);
  GO TO L4
L4: IF kind === "reminder"
  THEN GO TO L5
  ELSE GO TO L7
L5: IF kind === "reminder"
  THEN GO TO L6
  ELSE GO TO L8
L6: RETURN { subject: kind === "reminder" ? "PracticeChart appointment reminder" : "PracticeChart appointment confirmation", text: `Your appointment is ${
  GO TO L2
L7: Follow False branch
  GO TO L5
L8: Follow False branch
  GO TO L6
```

## queueEmailReminders

Queue one reminder per confirmed appointment version due within 24 hours.

Source: src/lib/notifications.ts. Graph: [queueEmailReminders](diagrams/cfg/queueEmailReminders.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START queueEmailReminders
  GO TO L3
L2: END PROCEDURE
L3: await db.execute( sql`INSERT INTO notification_outbox(appointment_id,appointment_version,kind) SELECT id,version,'reminder' FROM appointments WHERE st
  GO TO L2
```

## notificationList

Require reception access and return administrative mail status without credentials or clinical text.

Source: src/lib/notifications.ts. Graph: [notificationList](diagrams/cfg/notificationList.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START notificationList
  GO TO L3
L2: END PROCEDURE
L3: await requireRole(actor, "front_desk");
  GO TO L4
L4: await event(db, actor, "view", "notification_outbox");
  GO TO L5
L5: RETURN rows( sql`SELECT n.id,n.kind,n.status,n.attempts,n.last_error,n.created_at,n.sent_at,p.mrn,p.first_name,p.last_name,a.start_at FROM notificatio
  GO TO L2
```

## deliverQueuedEmails

Claim due messages with locks. Skip ineligible bookings. Preserve the provider request and idempotency key across retries. Record acceptance or a safe failure.

Source: src/lib/notifications.ts. Graph: [deliverQueuedEmails](diagrams/cfg/deliverQueuedEmails.svg).

The following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.

```text
L1: START deliverQueuedEmails
  GO TO L3
L2: END PROCEDURE
L3: const claimed = await db.transaction(async (tx) => rows( sql`UPDATE notification_outbox SET status='sending',attempts=attempts+1,next_attempt_at=now()
  GO TO L4
L4: let sent = 0, failed = 0, skipped = 0;
  GO TO L5
L5: IF More items in claimed
  THEN GO TO L6
  ELSE GO TO L41
L6: const [a] = await rows( sql`SELECT a.*,p.email,p.email_opt_in FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE a.id=${String(item.appoin
  GO TO L7
L7: IF a
  THEN GO TO L8
  ELSE GO TO L13
L8: IF a.status !== "confirmed"
  THEN GO TO L13
  ELSE GO TO L9
L9: IF Number(a.version) !== Number(item.appointment_version)
  THEN GO TO L13
  ELSE GO TO L10
L10: IF a.email_opt_in
  THEN GO TO L11
  ELSE GO TO L13
L11: IF a.email
  THEN GO TO L12
  ELSE GO TO L13
L12: IF new Date(String(a.start_at)).valueOf() <= Date.now()
  THEN GO TO L13
  ELSE GO TO L16
L13: await db.execute( sql`UPDATE notification_outbox SET status='skipped',last_error='Not eligible: changed booking, no consent, or no email.' WHERE id=${
  GO TO L14
L14: skipped++;
  GO TO L15
L15: continue;
  GO TO L16
L16: IF I/O operation succeeds
  THEN GO TO L18
  ELSE GO TO L17
L17: Handle I/O failure
  GO TO L36
L18: IF process.env.RESEND_API_KEY
  THEN GO TO L19
  ELSE GO TO L20
L19: IF process.env.EMAIL_FROM
  THEN GO TO L21
  ELSE GO TO L20
L20: RAISE new Error("Email provider is not configured.")
  GO TO L17
L21: IF process.env.DEMO_MODE === "true"
  THEN GO TO L22
  ELSE GO TO L44
L22: const to = process.env.DEMO_MODE === "true" ? "delivered@resend.dev" : String(a.email);
  GO TO L23
L23: const message = appointmentMessage( String(item.kind), new Date(String(a.start_at)), );
  GO TO L24
L24: const [snapshot]=await rows(sql`UPDATE notification_outbox SET delivery_payload=coalesce(delivery_payload,${JSON.stringify({from:process.env.EMAIL_FRO
  GO TO L25
L25: const response = await send("https://api.resend.com/emails", { method: "POST", signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer $
  GO TO L26
L26: IF response.ok
  THEN GO TO L28
  ELSE GO TO L27
L27: RAISE new Error(`Email provider returned ${response.status}.`)
  GO TO L17
L28: const result = (await response.json()) as { id: string };
  GO TO L29
L29: IF result.id
  THEN GO TO L31
  ELSE GO TO L30
L30: RAISE new Error("Email provider gave no receipt.")
  GO TO L17
L31: BEGIN transaction
  GO TO L33
L32: COMMIT transaction
  GO TO L35
L33: await tx.execute( sql`UPDATE notification_outbox SET status='sent',provider_id=${result.id},sent_at=now(),last_error='' WHERE id=${String(item.id)}::u
  GO TO L34
L34: await tx.execute( sql`INSERT INTO audit_events(action,entity,entity_id) VALUES('email_accepted','notification',${String(item.id)})`, );
  GO TO L32
L35: sent++;
  GO TO L5
L36: IF e instanceof Error
  THEN GO TO L37
  ELSE GO TO L38
L37: IF /^(Email provider|The operation was aborted)/.test(e.message)
  THEN GO TO L38
  ELSE GO TO L45
L38: const message = e instanceof Error && /^(Email provider|The operation was aborted)/.test(e.message) ? e.message : "Email delivery failed. Retry is sch
  GO TO L39
L39: await db.execute( sql`UPDATE notification_outbox SET status='failed',last_error=${message},next_attempt_at=now()+make_interval(mins=>least(60,power(2,
  GO TO L40
L40: failed++;
  GO TO L5
L41: await db.execute( sql`UPDATE notification_outbox SET status='failed',last_error='Retry window ended. Contact the operator.' WHERE status IN('queued','
  GO TO L42
L42: const [pending] = await rows( sql`SELECT count(*) AS remaining FROM notification_outbox WHERE status IN('queued','failed','sending') AND attempts<5 AN
  GO TO L43
L43: RETURN { sent, failed, skipped, remaining: Number(pending.remaining) }
  GO TO L2
L44: Follow False branch
  GO TO L22
L45: Follow False branch
  GO TO L38
```
