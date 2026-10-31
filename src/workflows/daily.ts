export async function dailyPracticeTasks() {
  "use workflow";
  await createReminders();
  await reconcileFiles();
  return { complete: true };
}
export async function createReminders() {
  "use step";
  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  await db.execute(
    sql`INSERT INTO reminders(appointment_id,due_date) SELECT id,(start_at AT TIME ZONE 'America/Jamaica')::date FROM appointments WHERE status='confirmed' AND start_at>now() AND start_at<now()+interval '7 days' ON CONFLICT DO NOTHING`,
  );
  await db.execute(sql`DELETE FROM sessions WHERE expires_at<now()`);
  await db.execute(sql`DELETE FROM login_attempts WHERE expires_at<now()`);
  return { complete: true };
}
export async function reconcileFiles() {
  "use step";
  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const { readPrivateFile } = await import("../lib/storage");
  const { createHash } = await import("node:crypto");
  const r = await db.execute(
    sql`SELECT pathname,sha256 FROM documents ORDER BY created_at DESC LIMIT 100`,
  );
  let missing = 0;
  for (const row of r.rows) {
    try {
      const b = await readPrivateFile(String(row.pathname));
      if (createHash("sha256").update(b).digest("hex") !== row.sha256)
        missing++;
    } catch {
      missing++;
    }
  }
  await db.execute(
    sql`INSERT INTO audit_events(action,entity,metadata) VALUES('file_reconciliation','maintenance',${JSON.stringify({ checked: r.rows.length, unavailable: missing })}::jsonb)`,
  );
  return { checked: r.rows.length, unavailable: missing };
}
