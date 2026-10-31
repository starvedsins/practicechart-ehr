import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, sessions, documents, patients } from "@/lib/schema";
import {
  AppError,
  getSession,
  login,
  SESSION_COOKIE,
  digest,
  requireRole,
} from "@/lib/auth";
import * as service from "@/lib/service";
import { readPrivateFile, storeFile, samplePdf } from "@/lib/storage";
import { idSchema } from "@/lib/validation";
import { start } from "workflow/api";
import { dailyPracticeTasks } from "@/workflows/daily";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function camel(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(camel);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
        camel(v),
      ]),
    );
  return value;
}
function json(value: unknown, status = 200) {
  return NextResponse.json(camel(value), {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
export async function PATCH(req: NextRequest) {
  return handle(req);
}
async function handle(req: NextRequest) {
  try {
    const route = req.nextUrl.pathname.replace(/^\/api\//, "");
    const parts = route.split("/");
    const id = parts[1];
    const post = req.method !== "GET";
    if (route === "health")
      return json({ status: "ok", application: "PracticeChart EHR" });
    if (route === "cron" && req.method === "GET") {
      if (
        !process.env.CRON_SECRET ||
        req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
      )
        throw new AppError(401, "Access denied.");
      const run = await start(dailyPracticeTasks, []);
      return json({ started: true, runId: run.runId });
    }
    if (post) {
      const origin = req.headers.get("origin");
      const host = req.headers.get("host") || req.nextUrl.host;
      if (!origin || origin !== `${req.nextUrl.protocol}//${host}`)
        throw new AppError(403, "Open the form on this website and try again.");
      if (Number(req.headers.get("content-length") || 0) > 4400000)
        throw new AppError(413, "The upload is too large.");
    }
    if (route === "login" && post) {
      const d = z
        .object({
          username: z.string().min(1).max(40),
          password: z.string().min(1).max(128),
        })
        .parse(await req.json());
      const result = await login(
        d.username,
        d.password,
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local",
      );
      const res = json(result.user);
      res.cookies.set(SESSION_COOKIE, result.token, {
        httpOnly: true,
        secure: req.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: 28800,
      });
      return res;
    }
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const actor = await getSession(token);
    if (!actor) throw new AppError(401, "Please log in to continue.");
    if (route === "logout" && post) {
      await db.transaction(async (tx) => {
        await tx.delete(sessions).where(eq(sessions.id, digest(token!)));
        await service.event(tx, actor, "logout", "session");
      });
      const r = json({ ok: true });
      r.cookies.delete(SESSION_COOKIE);
      return r;
    }
    if (route === "me")
      return json({ user: actor, demo: process.env.DEMO_MODE === "true" });
    if (route === "password" && post)
      return json(await service.changePassword(actor, await req.json()));
    if (route === "dashboard" && !post)
      return json(await service.dashboard(actor));
    if (route === "doctors" && !post)
      return json(
        await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(and(eq(users.role, "doctor"), eq(users.active, true))),
      );
    if (route === "patients")
      return json(
        post
          ? await service.savePatient(actor, await req.json())
          : await service.patientList(
              actor,
              req.nextUrl.searchParams.get("q") || "",
            ),
      );
    if (parts[0] === "patients" && id) {
      if (parts[2] === "archive" && post)
        return json(await service.archivePatient(actor, id, await req.json()));
      if (parts[2] === "reconcile" && post)
        return json(
          await service.reconcilePatient(actor, id, await req.json()),
        );
      return json(
        post
          ? await service.savePatient(actor, await req.json(), id)
          : await service.patientDetail(actor, id),
      );
    }
    if (route === "appointments")
      return json(
        post
          ? await service.bookAppointment(actor, await req.json())
          : await service.schedule(
              actor,
              req.nextUrl.searchParams.get("date") || undefined,
            ),
      );
    if (parts[0] === "appointments" && post)
      return json(
        parts[2] === "status"
          ? await service.appointmentStatus(actor, id, await req.json())
          : await service.bookAppointment(actor, await req.json(), id),
      );
    if (route === "availability" && !post)
      return json(
        await service.availability(
          actor,
          req.nextUrl.searchParams.get("doctorId") || "",
          req.nextUrl.searchParams.get("date") || "",
          {
            duration: Number(req.nextUrl.searchParams.get("duration") || 30),
            patientId: req.nextUrl.searchParams.get("patientId") || undefined,
            excludeId: req.nextUrl.searchParams.get("excludeId") || undefined,
          },
        ),
      );
    if (route === "visits" && post)
      return json(await service.startVisit(actor, await req.json()));
    if (parts[0] === "visits" && post) {
      if (parts[2] === "clinical")
        return json(await service.saveClinical(actor, id, await req.json()));
      if (parts[2] === "file")
        return json(await service.fileVisit(actor, id, await req.json()));
    }
    if (route === "invoices")
      return json(
        post
          ? await service.saveInvoice(actor, await req.json())
          : await service.invoiceList(actor),
      );
    if (parts[0] === "invoices" && post)
      return json(await service.setInvoiceStatus(actor, id, await req.json()));
    if (route === "users") {
      await requireRole(actor);
      return json(
        post
          ? await service.manageUser(actor, await req.json())
          : await db
              .select({
                id: users.id,
                username: users.username,
                name: users.name,
                role: users.role,
                active: users.active,
                protected: users.protected,
                version: users.version,
              })
              .from(users)
              .orderBy(users.name),
      );
    }
    if (parts[0] === "users" && post)
      return json(await service.manageUser(actor, await req.json(), id));
    if (route === "audit" && !post) {
      await requireRole(actor);
      await service.event(db, actor, "view", "audit");
      return json(
        await service.rows(
          sql`SELECT a.id,a.action,a.entity,a.entity_id,a.metadata,a.created_at,u.name AS actor_name FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 200`,
        ),
      );
    }
    if (route === "hours") {
      if (!post)
        return json({
          hours: await service.rows(
            sql`SELECT h.*,u.name AS doctor_name FROM doctor_hours h JOIN users u ON u.id=h.doctor_id ORDER BY u.name,h.weekday`,
          ),
          blocks: await service.rows(
            sql`SELECT b.*,u.name AS doctor_name FROM schedule_blocks b JOIN users u ON u.id=b.doctor_id WHERE end_at>now() ORDER BY start_at`,
          ),
        });
      await requireRole(actor);
      const d = z
        .object({
          doctorId: idSchema,
          weekday: z.number().int().min(1).max(7),
          startMin: z.number().int().min(0).max(1439),
          endMin: z.number().int().min(1).max(1440),
        })
        .refine((x) => x.endMin > x.startMin)
        .parse(await req.json());
      return json(
        await db.transaction(async (tx) => {
          await tx.execute(
            sql`SELECT id FROM users WHERE id=${d.doctorId}::uuid FOR UPDATE`,
          );
          const conflicts = await service.rows(
            sql`SELECT id FROM appointments WHERE doctor_id=${d.doctorId}::uuid AND start_at>now() AND status IN('confirmed','arrived','in_consultation') AND extract(isodow FROM start_at AT TIME ZONE 'America/Jamaica')=${d.weekday} AND (extract(epoch FROM (start_at AT TIME ZONE 'America/Jamaica')::time)/60<${d.startMin} OR extract(epoch FROM (end_at AT TIME ZONE 'America/Jamaica')::time)/60>${d.endMin})`,
            tx,
          );
          if (conflicts.length)
            throw new AppError(
              409,
              "Move conflicting appointments before you change these hours.",
            );
          await tx.execute(
            sql`INSERT INTO doctor_hours(doctor_id,weekday,start_min,end_min) VALUES(${d.doctorId},${d.weekday},${d.startMin},${d.endMin}) ON CONFLICT(doctor_id,weekday) DO UPDATE SET start_min=excluded.start_min,end_min=excluded.end_min`,
          );
          await service.event(tx, actor, "update", "doctor_hours", d.doctorId);
          return { ok: true };
        }),
      );
    }
    if (route === "blocks" && post) {
      await requireRole(actor);
      const d = z
        .object({
          doctorId: idSchema,
          startAt: z.string().datetime({ offset: true }),
          endAt: z.string().datetime({ offset: true }),
        })
        .refine((v) => Date.parse(v.endAt) > Date.parse(v.startAt))
        .parse(await req.json());
      return json(
        await db.transaction(async (tx) => {
          const r = await service.rows(
            sql`INSERT INTO schedule_blocks(doctor_id,start_at,end_at) VALUES(${d.doctorId},${d.startAt}::timestamptz,${d.endAt}::timestamptz) RETURNING id`,
            tx,
          );
          await service.event(
            tx,
            actor,
            "create",
            "schedule_block",
            String(r[0].id),
          );
          return r[0];
        }),
      );
    }
    if (parts[0] === "blocks" && post) {
      await requireRole(actor);
      return json(
        await db.transaction(async (tx) => {
          await tx.execute(
            sql`DELETE FROM schedule_blocks WHERE id=${idSchema.parse(id)}::uuid`,
          );
          await service.event(tx, actor, "delete", "schedule_block", id);
          return { ok: true };
        }),
      );
    }
    if (parts[0] === "reports" && !post)
      return json(
        await service.reportData(
          actor,
          id,
          req.nextUrl.searchParams.get("id") || "",
        ),
      );
    if (route === "sample-report" && !post) {
      await requireRole(actor);
      return new NextResponse(new Uint8Array(samplePdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition":
            'attachment; filename="fictional-lab-report.pdf"',
          "Cache-Control": "no-store",
        },
      });
    }
    if (parts[0] === "documents") {
      await requireRole(actor);
      if (id && !post) {
        const [d] = await db
          .select()
          .from(documents)
          .where(eq(documents.id, idSchema.parse(id)));
        if (!d) throw new AppError(404, "The document was not found.");
        const bytes = await readPrivateFile(d.pathname);
        await service.event(db, actor, "retrieve", "document", id);
        return new NextResponse(new Uint8Array(bytes), {
          headers: {
            "Content-Type": d.mime,
            "Content-Disposition": `attachment; filename="${d.id}.${d.mime === "application/pdf" ? "pdf" : d.mime === "image/png" ? "png" : "jpg"}"`,
            "Cache-Control": "private, no-store",
          },
        });
      }
      if (post) {
        const form = await req.formData();
        const p = idSchema.parse(form.get("patientId"));
        const title = z
          .string()
          .trim()
          .min(1)
          .max(160)
          .parse(form.get("title"));
        const kind = z
          .enum(["Lab report", "Diagnostic report"])
          .parse(form.get("kind"));
        const replacesId = form.get("replacesId")
          ? idSchema.parse(form.get("replacesId"))
          : undefined;
        const file = form.get("file");
        if (!(file instanceof File)) throw new AppError(400, "Choose a file.");
        const [patient] = await db
          .select({ id: patients.id })
          .from(patients)
          .where(eq(patients.id, p));
        if (!patient) throw new AppError(404, "The patient was not found.");
        if (replacesId) {
          const [old] = await db
            .select()
            .from(documents)
            .where(eq(documents.id, replacesId));
          if (!old || old.patientId !== p)
            throw new AppError(
              400,
              "The replaced document must belong to this patient.",
            );
        }
        const saved = await storeFile(
          Buffer.from(await file.arrayBuffer()),
          file.type,
        );
        const result = await db.transaction(async (tx) => {
          const [d] = await tx
            .insert(documents)
            .values({
              patientId: p,
              title,
              kind,
              replacesId,
              authorId: actor.id,
              ...saved,
            })
            .returning({ id: documents.id, title: documents.title });
          await service.event(tx, actor, "upload", "document", d.id);
          return d;
        });
        return json(result, 201);
      }
      await service.event(db, actor, "view", "document_list");
      return json(
        await service.rows(
          sql`SELECT d.id,d.patient_id,d.title,d.kind,d.mime,d.size,d.created_at,d.replaces_id,p.first_name,p.last_name,p.mrn FROM documents d JOIN patients p ON p.id=d.patient_id ORDER BY d.created_at DESC LIMIT 100`,
        ),
      );
    }
    throw new AppError(404, "This function was not found.");
  } catch (error) {
    if (error instanceof AppError)
      return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return json(
        { error: error.issues[0]?.message || "Check the form values." },
        400,
      );
    let cause = error as { code?: string; cause?: unknown };
    for (let i = 0; i < 5 && cause?.cause; i++)
      cause = cause.cause as typeof cause;
    const code = cause?.code;
    if (code === "23P01")
      return json(
        {
          error:
            "This time conflicts with another booking. Choose another time.",
        },
        409,
      );
    if (code === "23505")
      return json(
        {
          error:
            "This record already exists. Reload and check the existing record.",
        },
        409,
      );
    if (code === "23514")
      return json(
        {
          error:
            "The change breaks a record rule. Check doctor hours, booking limits, and the last active doctor.",
        },
        400,
      );
    console.error("PracticeChart request failed", {
      code: code || "internal",
      route: req.nextUrl.pathname.replace(/[a-f0-9-]{36}/g, ":id"),
    });
    return json(
      {
        error:
          "The service is not available. No successful save was confirmed. Try again.",
      },
      503,
    );
  }
}
