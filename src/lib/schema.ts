import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  username: text().notNull().unique(),
  name: text().notNull(),
  role: text().notNull(),
  passwordHash: text("password_hash").notNull(),
  active: boolean().notNull().default(true),
  protected: boolean().notNull().default(false),
  version: integer().notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const sessions = pgTable("sessions", {
  id: text().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const patients = pgTable("patients", {
  id: uuid().primaryKey().defaultRandom(),
  mrn: text().notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dob: date().notNull(),
  phone: text().notNull(),
  address: text().notNull(),
  gender: text().notNull().default("Not stated"),
  emergencyContact: text("emergency_contact").notNull().default(""),
  insurance: text().notNull().default(""),
  provisionalReason: text("provisional_reason").notNull().default(""),
  mergedInto: uuid("merged_into"),
  archived: boolean().notNull().default(false),
  version: integer().notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const appointments = pgTable("appointments", {
  id: uuid().primaryKey().defaultRandom(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id),
  doctorId: uuid("doctor_id")
    .notNull()
    .references(() => users.id),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  status: text().notNull().default("confirmed"),
  version: integer().notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const visits = pgTable("visits", {
  id: uuid().primaryKey().defaultRandom(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id),
  doctorId: uuid("doctor_id")
    .notNull()
    .references(() => users.id),
  appointmentId: uuid("appointment_id").references(() => appointments.id),
  status: text().notNull().default("open"),
  revision: integer().notNull().default(0),
  visitAt: timestamp("visit_at", { withTimezone: true }).defaultNow().notNull(),
  filedAt: timestamp("filed_at", { withTimezone: true }),
});
export const clinicalRevisions = pgTable("clinical_revisions", {
  id: uuid().primaryKey().defaultRandom(),
  visitId: uuid("visit_id")
    .notNull()
    .references(() => visits.id),
  revision: integer().notNull(),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  state: text().notNull(),
  content: jsonb().notNull(),
  reason: text().notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const documents = pgTable("documents", {
  id: uuid().primaryKey().defaultRandom(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id),
  title: text().notNull(),
  kind: text().notNull(),
  pathname: text().notNull().unique(),
  mime: text().notNull(),
  size: integer().notNull(),
  sha256: text().notNull(),
  replacesId: uuid("replaces_id"),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const invoices = pgTable("invoices", {
  id: uuid().primaryKey().defaultRandom(),
  number: text().notNull().unique(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id),
  lines: jsonb().notNull(),
  totalCents: integer("total_cents").notNull(),
  status: text().notNull().default("draft"),
  version: integer().notNull().default(1),
  reason: text().notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const auditEvents = pgTable("audit_events", {
  id: uuid().primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => users.id),
  action: text().notNull(),
  entity: text().notNull(),
  entityId: text("entity_id").notNull().default(""),
  metadata: jsonb().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export type Staff = Pick<
  typeof users.$inferSelect,
  "id" | "username" | "name" | "role" | "protected" | "version"
>;
