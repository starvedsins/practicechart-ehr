import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "./db";
import { users, sessions, auditEvents, type Staff } from "./schema";
export const SESSION_COOKIE = "practicechart_session";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const hashPassword = (s: string) =>
  hash(s, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
export async function auditDenied(actor: Staff | null, entity: string) {
  await db
    .insert(auditEvents)
    .values({ actorId: actor?.id, action: "access_denied", entity });
}
export async function requireRole(actor: Staff, role = "doctor") {
  if (actor.role !== role) {
    await auditDenied(actor, "clinical_or_admin");
    throw new AppError(403, "Your account cannot use this function.");
  }
}
export async function getSession(token?: string): Promise<Staff | null> {
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      role: users.role,
      protected: users.protected,
      version: users.version,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, digest(token)),
        gt(sessions.expiresAt, new Date()),
        eq(users.active, true),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
let dummy: Promise<string> | undefined;
export async function login(username: string, password: string, ip: string) {
  const key = digest(username.toLowerCase().trim() + ":" + ip);
  const attempt = await db.execute(
    sql`INSERT INTO login_attempts(key,count,expires_at) VALUES(${key},1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN login_attempts.expires_at<now() THEN 1 ELSE login_attempts.count+1 END,expires_at=CASE WHEN login_attempts.expires_at<now() THEN now()+interval '15 minutes' ELSE login_attempts.expires_at END RETURNING count`,
  );
  if (Number(attempt.rows[0].count) > 8)
    throw new AppError(
      429,
      "Too many login attempts. Try again in 15 minutes.",
    );
  const [u] = await db
    .select()
    .from(users)
    .where(eq(users.username, username.toLowerCase().trim()))
    .limit(1);
  dummy ??= hashPassword(randomBytes(32).toString("hex"));
  const valid = await verify(u?.passwordHash ?? (await dummy), password).catch(
    () => false,
  );
  if (!u || !u.active || !valid) {
    await db
      .insert(auditEvents)
      .values({ action: "login_failed", entity: "session" });
    throw new AppError(401, "The username or password is incorrect.");
  }
  const token = randomBytes(32).toString("hex");
  await db.transaction(async (tx) => {
    await tx
      .insert(sessions)
      .values({
        id: digest(token),
        userId: u.id,
        expiresAt: new Date(Date.now() + 8 * 3600000),
      });
    await tx.execute(sql`DELETE FROM login_attempts WHERE key=${key}`);
    await tx
      .insert(auditEvents)
      .values({ actorId: u.id, action: "login", entity: "session" });
  });
  return {
    token,
    user: { id: u.id, name: u.name, role: u.role, username: u.username },
  };
}
