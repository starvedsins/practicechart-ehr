import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { AppError, digest, requireRole } from "./auth";
import { patientInput, idSchema } from "./validation";
import { event, insertPatient, rows } from "./service";
import type { Staff } from "./schema";
import { demoIntake } from "./demo-intake";

export async function submitIntake(input: unknown, address: string) {
  const parsed = z
    .object({
      submissionId: idSchema,
      consent: z.literal(true),
      website: z.literal("").default(""),
    })
    .parse(input);
  // A public intake cannot set provisional flags or staff review fields.
  const payload = patientInput.parse({
    ...(input as object),
    provisionalReason: "",
  });
  if (
    process.env.DEMO_MODE === "true" &&
    Object.entries(demoIntake).some(
      ([k, v]) => payload[k as keyof typeof payload] !== v,
    )
  )
    throw new AppError(
      400,
      "The public demo accepts only the supplied fictional example. Select Use fictional example and try again.",
    );
  return db.transaction(async (tx) => {
    const bucket = digest(address + ":" + Math.floor(Date.now() / 3600000));
    const limit = await rows(
      sql`INSERT INTO public_form_limits(bucket,attempts,expires_at) VALUES(${bucket},1,now()+interval '2 hours') ON CONFLICT(bucket) DO UPDATE SET attempts=public_form_limits.attempts+1 RETURNING attempts`,
      tx,
    );
    if (Number(limit[0].attempts) > 10)
      throw new AppError(
        429,
        "Too many forms were sent. Try again later or contact reception.",
      );
    await tx.execute(
      sql`INSERT INTO registration_intakes(id,payload) VALUES(${parsed.submissionId},${JSON.stringify(payload)}::jsonb) ON CONFLICT(id) DO NOTHING`,
    );
    await tx.execute(
      sql`INSERT INTO audit_events(action,entity,entity_id) VALUES('submit','registration_intake',${parsed.submissionId})`,
    );
    return {
      reference: parsed.submissionId,
      message:
        "Your form was received. Reception will check it. This does not confirm an appointment.",
    };
  });
}
export async function intakeList(actor: Staff) {
  await requireRole(actor, "front_desk");
  return db.transaction(async (tx) => {
    await event(tx, actor, "view", "registration_intakes");
    return rows(
      sql`SELECT id,payload,status,version,created_at FROM registration_intakes WHERE status='pending' ORDER BY created_at LIMIT 100`,
      tx,
    );
  });
}
export async function reviewIntake(actor: Staff, id: string, input: unknown) {
  await requireRole(actor, "front_desk");
  const d = z
    .object({
      version: z.number().int().positive(),
      action: z.enum(["accept", "reject"]),
      reason: z.string().trim().max(500).default(""),
      duplicateReason: z.string().trim().max(500).default(""),
    })
    .parse(input);
  return db.transaction(async (tx) => {
    const [intake] = await rows(
      sql`SELECT * FROM registration_intakes WHERE id=${idSchema.parse(id)}::uuid FOR UPDATE`,
      tx,
    );
    if (!intake || intake.status !== "pending" || intake.version !== d.version)
      throw new AppError(
        409,
        "This form was already reviewed or changed. Reload the list.",
      );
    if (d.action === "reject" && d.reason.length < 3)
      throw new AppError(400, "Enter a reason to reject the form.");
    const result =
      d.action === "accept"
        ? await insertPatient(tx, actor, patientInput.parse(intake.payload), d)
        : null;
    await tx.execute(
      sql`UPDATE registration_intakes SET status=${d.action === "accept" ? "accepted" : "rejected"},patient_id=${result?.patient.id || null}::uuid,reviewed_by=${actor.id}::uuid,review_reason=${d.reason},reviewed_at=now(),version=version+1 WHERE id=${id}::uuid`,
    );
    await event(tx, actor, d.action, "registration_intake", id);
    return { patient: result?.patient || null };
  });
}
