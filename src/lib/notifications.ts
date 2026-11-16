import { sql } from "drizzle-orm";
import { db } from "./db";
import { event, rows } from "./service";
import { requireRole } from "./auth";
import type { Staff } from "./schema";

export function appointmentMessage(kind: string, start: Date) {
  const date = new Intl.DateTimeFormat("en-JM", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Jamaica",
  }).format(start);
  return {
    subject:
      kind === "reminder"
        ? "PracticeChart appointment reminder"
        : "PracticeChart appointment confirmation",
    text: `Your appointment is ${kind === "reminder" ? "due" : "confirmed"} for ${date} (Jamaica time). Contact reception if you need to change it. No medical details are included.\n\nPracticeChart course demonstration. Fictional data only.`,
  };
}
export async function queueEmailReminders() {
  await db.execute(
    sql`INSERT INTO notification_outbox(appointment_id,appointment_version,kind) SELECT id,version,'reminder' FROM appointments WHERE status='confirmed' AND start_at>now() AND start_at<=now()+interval '24 hours' ON CONFLICT DO NOTHING`,
  );
}
export async function notificationList(actor: Staff) {
  await requireRole(actor, "front_desk");
  await event(db, actor, "view", "notification_outbox");
  return rows(
    sql`SELECT n.id,n.kind,n.status,n.attempts,n.last_error,n.created_at,n.sent_at,p.mrn,p.first_name,p.last_name,a.start_at FROM notification_outbox n JOIN appointments a ON a.id=n.appointment_id JOIN patients p ON p.id=a.patient_id ORDER BY n.created_at DESC LIMIT 100`,
  );
}
export async function deliverQueuedEmails(send = fetch) {
  // Claims expire so an interrupted worker can retry the same provider idempotency key.
  const claimed = await db.transaction(async (tx) =>
    rows(
      sql`UPDATE notification_outbox SET status='sending',attempts=attempts+1,next_attempt_at=now()+interval '5 minutes' WHERE id IN(SELECT id FROM notification_outbox WHERE ((status IN('queued','failed') AND next_attempt_at<=now()) OR (status='sending' AND next_attempt_at<=now())) AND attempts<5 AND created_at>now()-interval '23 hours' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 20) RETURNING *`,
      tx,
    ),
  );
  let sent = 0,
    failed = 0,
    skipped = 0;
  for (const item of claimed) {
    const [a] = await rows(
      sql`SELECT a.*,p.email,p.email_opt_in FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE a.id=${String(item.appointment_id)}::uuid`,
    );
    if (
      !a ||
      a.status !== "confirmed" ||
      Number(a.version) !== Number(item.appointment_version) ||
      !a.email_opt_in ||
      !a.email ||
      new Date(String(a.start_at)).valueOf() <= Date.now()
    ) {
      await db.execute(
        sql`UPDATE notification_outbox SET status='skipped',last_error='Not eligible: changed booking, no consent, or no email.' WHERE id=${String(item.id)}::uuid`,
      );
      skipped++;
      continue;
    }
    try {
      if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
        throw new Error("Email provider is not configured.");
      const to =
        process.env.DEMO_MODE === "true"
          ? "delivered@resend.dev"
          : String(a.email);
      const message = appointmentMessage(
        String(item.kind),
        new Date(String(a.start_at)),
      );
      const [snapshot]=await rows(sql`UPDATE notification_outbox SET delivery_payload=coalesce(delivery_payload,${JSON.stringify({from:process.env.EMAIL_FROM,to:[to],...message})}::jsonb) WHERE id=${String(item.id)}::uuid RETURNING delivery_payload`);
      const response = await send("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "practicechart-" + item.id,
        },
        body: JSON.stringify(snapshot.delivery_payload),
      });
      if (!response.ok)
        throw new Error(`Email provider returned ${response.status}.`);
      const result = (await response.json()) as { id: string };
      if (!result.id) throw new Error("Email provider gave no receipt.");
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`UPDATE notification_outbox SET status='sent',provider_id=${result.id},sent_at=now(),last_error='' WHERE id=${String(item.id)}::uuid`,
        );
        await tx.execute(
          sql`INSERT INTO audit_events(action,entity,entity_id) VALUES('email_accepted','notification',${String(item.id)})`,
        );
      });
      sent++;
    } catch (e) {
      const message =
        e instanceof Error &&
        /^(Email provider|The operation was aborted)/.test(e.message)
          ? e.message
          : "Email delivery failed. Retry is scheduled.";
      await db.execute(
        sql`UPDATE notification_outbox SET status='failed',last_error=${message},next_attempt_at=now()+make_interval(mins=>least(60,power(2,attempts)::int)) WHERE id=${String(item.id)}::uuid`,
      );
      failed++;
    }
  }
  await db.execute(
    sql`UPDATE notification_outbox SET status='failed',last_error='Retry window ended. Contact the operator.' WHERE status IN('queued','sending') AND created_at<=now()-interval '23 hours'`,
  );
  const [pending] = await rows(
    sql`SELECT count(*) AS remaining FROM notification_outbox WHERE status IN('queued','failed','sending') AND attempts<5 AND created_at>now()-interval '23 hours'`,
  );
  return { sent, failed, skipped, remaining: Number(pending.remaining) };
}
