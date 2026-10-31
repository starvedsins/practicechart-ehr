import {
  readFile,
  writeFile,
  copyFile,
  mkdir,
  readdir,
} from "node:fs/promises";
import { Pool } from "pg";
import "dotenv/config";
const read = async (file: string) => JSON.parse(await readFile(file, "utf8"));
const unit = await read("docs/evidence/vitest-results.json");
const browser = await read("docs/evidence/playwright-results.json");
const perf = await read("docs/evidence/performance.json");
const restore = await read("docs/evidence/restore-result.json");
const coverage = await read("coverage/coverage-summary.json");
await copyFile(
  "coverage/coverage-summary.json",
  "docs/evidence/coverage-summary.json",
);
const p = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED });
const cols = (
  await p.query(
    "SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
  )
).rows;
await p.end();
const summary = `Vitest recorded ${unit.numPassedTests} passing tests and ${unit.numFailedTests} failed tests. Playwright recorded ${browser.stats.expected} passing browser tests and ${browser.stats.unexpected} unexpected failures. The measured Vitest library coverage was ${coverage.total.statements.pct}% of statements and ${coverage.total.branches.pct}% of branches. This is not a claim of full path coverage.`;
const performanceTable =
  "| Active sessions | Seconds | Browser login ms | First record ms | Warm display p95 ms | API requests | Request errors |\n| --- | --- | --- | --- | --- | --- | --- |\n" +
  perf.results
    .map(
      (r: {
        concurrentSessions: number;
        durationSeconds: number;
        uiLoginMs: number;
        firstRecordMs: number;
        warmRecordDisplay: { p95Ms: number };
        apiRequests: number;
        errors: number;
      }) =>
        `| ${r.concurrentSessions} | ${r.durationSeconds} | ${r.uiLoginMs} | ${r.firstRecordMs} | ${r.warmRecordDisplay.p95Ms} | ${r.apiRequests} | ${r.errors} |`,
    )
    .join("\n");
const development = `# PracticeChart software development and implementation report

## Introduction

PracticeChart is a working EHR course application for a private medical practice. It replaces the case study's paper record steps with role-controlled digital workflows. The intended users are doctors and front desk staff. Development, tests, screenshots, and the public demo use fictional records only. No live practice rollout, clinical approval, legal compliance, completed training, or human acceptance is claimed.

The project brief defines the EHR business scope. The assignment guide defines this report and the two manuals. The syllabus requires implementation, testing, metrics, maintenance, configuration management, and team participation. The old application and earlier change record were deleted. Their code and test results were not reused as EHR evidence.

## Scope and objectives

Support patient registration and retrieval, administrative updates, safe appointment scheduling, consultation records, diagnostic files, prescriptions, certificates, visit filing, manual invoices, and reports. Preserve earlier clinical entries and audit history. Provide an encrypted full backup and a measured restore test. Keep the local presentation data across restarts.

There is no patient portal, payment processor, AI clinical advice, biometric authentication, external medical practice connection, Ministry of Health connection, pharmacy integration, or laboratory integration. Email delivery is deferred. In-app reminders are included. Hardware purchasing and staff training are not represented as completed work.

## Requirements and constraints

REQUIREMENTS.md records source references, conflicts, and decisions. The scanned requirements include unique usernames, role limits, audit history, daily backup, a three second login target, a two second patient retrieval target, 50 concurrent users, and a 99 percent operational availability target. The short tests measure the first three performance conditions locally. They cannot prove long-term availability or legal compliance.

Development used a Windows computer, Node.js, Docker Desktop, PostgreSQL 18, and Chromium. The local benchmark environment was ${perf.environment.cpu.trim()}, ${perf.environment.logicalCpuCount} logical CPUs, ${perf.environment.memoryGiB} GiB RAM, Node ${perf.environment.node}, and Next.js ${perf.environment.next}. The cloud demo uses the existing Vercel project, separate Neon EHR databases, and new private Blob paths. Free service limits remain a constraint.

Inputs include credentials, patient demographics, booking intervals, doctor-entered clinical data, diagnostic files, and invoice lines. Outputs include confirmation and error messages, schedules, patient history, prescriptions, medical certificates, visit summaries, attendance slips, invoices, audit history, and recovery evidence. A patient report and full EHR backup are different outputs.

## Design and implementation process

The brief, assignment guide, syllabus, schedule, supporting lesson documents, and all 53 embedded images were reviewed. Requirements were separated from old-system interviews, lesson examples, draft algorithms, and unsupported statements. Source conflicts were recorded before implementation. The user selected manual invoices and in-app reminders.

The implementation used small server services, validation schemas, explicit role checks, SQL migrations, database constraints, and a shared interface. The initial green sidebar design was rejected as too close to the earlier application's appearance. It was replaced with ink-blue accents, warm light surfaces, top navigation, a patient worklist, and segmented record controls. No deleted application source or saved design reference was used.

Coding and automated checks were performed with AI assistance in this workspace. These files do not assign module authorship to group members. The group must review the implementation, record each member's actual code contribution, and complete the human course tasks in GROUP_START_GUIDE.md.

## Architectural design

The browser uses Next.js pages and authenticated route handlers. Zod validates inputs. Drizzle services use PostgreSQL transactions. A restricted runtime database role cannot alter the schema or overwrite protected history. Clinical and audit changes commit together. Private files are streamed only after role checks. Workflow state contains IDs and result counts, not clinical bodies.

![Use case diagram](diagrams/png/use_case.png)

![Sequence diagram](diagrams/png/sequence.png)

![Swimlane diagram](diagrams/png/swimlane.png)

![Domain class and service diagram](diagrams/png/class.png)

![Input processing and output modules](diagrams/png/ipo.png)

The class diagram represents domain models and service operations. The implementation uses TypeScript types, functions, and Drizzle table models. It does not pretend that every domain model is implemented as an object-oriented class.

## Procedural design

MODULES.md contains source-linked processing narratives and graph instructions for 26 functions. CONTROL_FLOW.md contains the three complexity calculations, planar face boundaries, and independent syntactic candidates. TEST_PLAN.md maps feasible state and input cases to executable tests. Database constraints are tested through PostgreSQL, rather than assigned invented JavaScript branch counts.

## Interface design

The Today page leads with a patient worklist. The patient record separates demographics, visits, doctor-only clinical entries, and private documents. Shared forms show labels, required fields, errors, busy states, and confirmation. Booking uses a review step before commit. Final clinical corrections require a reason. Reduced-motion preferences remove motion. The phone view uses a compact bottom navigation.

![Doctor workspace](screenshots/doctor-overview.png)

![Phone workspace](screenshots/phone-overview.png)

## Testing and actual results

${summary}

Unit and database tests cover valid and invalid partitions, boundaries, session and account states, simultaneous bookings, stale changes, clinical corrections, document rules, and invoices. Complete browser tests cover both roles. Direct clinical and file routes are denied to the front desk. Axe recorded zero violations on the nine checked desktop pages and the checked emulated phone page. Automated scans do not replace a full accessibility review or a real phone test.

### Performance

The fixture contained ${perf.environment.dataset.patients} fictional patients and ${perf.environment.dataset.clinicalRevisions} clinical revisions. Each load ran for 30 seconds. At loads above one, each background session requested a patient search and detail, then waited one second. One browser session measured complete record display. The first display is reported separately from later displays. The first display is not a claim of a cold server start.

${performanceTable}

All measured browser logins were below three seconds. All measured warm record displays were below two seconds. Only one browser login was measured at each load. The server was a local production build. PostgreSQL ran in Docker on the same host. These results do not prove equivalent cloud performance or 99 percent availability.

### Recovery

The full encrypted EHR recovery bundle restored into an isolated local PostgreSQL 18 database. The actual result was ${restore.status}. The test compared ${restore.tablesCompared} tables and ${restore.documentsVerified} uploaded documents. The measured restore phase took ${restore.durationSeconds} seconds. It checked file hashes and bytes, MRN sequencing, immutable histories, and overlap rejection. RECOVERY.md explains key custody, daily scheduling, retention, and limits.

### Defects found and corrected

| Observed defect | Cause and correction | Retest |
| --- | --- | --- |
| Local login rejected a valid page origin | Internal host differed from the request host. Check the actual request host. | Both role logins pass |
| Available times changed after a newer date was selected | A late response replaced newer state. Ignore superseded responses. | Booking and rescheduling pass |
| Booking confirmation rejected a returned time | PostgreSQL timestamp output needed ISO normalisation. Normalise before submission. | Confirmation workflow passes |
| Saved textarea label lookup was inconsistent | Default text entered the nested label text. Add explicit accessible names. | Clinical correction workflow passes |
| A container did not trust the cloud certificate chain | Its trust store differed from Node. Supply the trusted Node CA set and retain hostname verification. | Cloud backup and restore evidence |

## Implementation method and maintenance

Use a phased conversion with a parallel reference process if the practice later approves real deployment. Begin with registration and scheduling. Add clinical recording and controlled document outputs after training. This reduces the amount of change at one time. It also requires extra checks and a clear authoritative record. This is a proposed method, not a completed pilot.

Use versioned migrations, reviewed branches, a lockfile, regression tests, and a release record. Keep recovery keys and backups private. Review failed daily jobs. Check restore ability after schema or storage changes. Train staff before any real use. Keep a support contact and issue register.

## Human testing and remaining work

No completed user acceptance, staff training, live pilot, or real-device testing is claimed. Blank forms and a training plan are supplied. Each member must complete and explain a module contribution. Confirm the actual group presentation slot and private submission cover details with the tutor.

## References

University of Technology, Jamaica. (n.d.). Assignment guide [Course handout].

University of Technology, Jamaica. (n.d.). Software implementation and testing syllabus [Course outline].

University of Technology, Jamaica. (2026). Software implementation schedule 2026 to 2027 semester 1 [Course schedule].

Group 2. (2026). Software implementation group project semester 1 2026 to 2027 [Private project brief].

PostgreSQL Global Development Group. (2026). PostgreSQL documentation: Range types. https://www.postgresql.org/docs/current/rangetypes.html

Neon. (2026). Migrate data from Postgres with pg_dump and pg_restore. https://neon.com/docs/import/migrate-from-postgres

Vercel. (2026). Private storage. https://vercel.com/docs/vercel-blob/private-storage

## Appendices

See REQUIREMENTS.md, TEST_PLAN.md, CONTROL_FLOW.md, MODULES.md, RECOVERY.md, the diagrams, safe evidence files, programme manual, user manual, source listing, and blank training and acceptance forms. Private interviews and course chats are excluded from the public repository.
`;
await writeFile("docs/DEVELOPMENT_REPORT.md", development);
let programme =
  `# PracticeChart programme manual

This manual describes the implemented source, database, interfaces, file formats, and operating controls. It is for the group programmer and technical operator. Use the separate user manual for staff tasks.

## Source and architecture

The Next.js App Router hosts the login, workspace, report pages, and route handlers. The workspace is a client interface backed by authenticated server functions. Drizzle models define typed rows. SQL migrations add database-level invariants. The indexed source listing contains all authored application source, migrations, scripts, tests, and project configuration. Third-party packages and generated bundles are excluded.

The important source groups are src/app for routes and pages, src/components for interface modules, src/lib for authentication, validation, storage, and transactional services, and src/workflows for daily work. scripts contains setup, migration, test, performance, course analysis, and recovery tools. The SQL migrations are the authority for constraints and triggers. Schema hashes prevent silent migration changes.

![Data design](diagrams/png/data.png)

![Data flow](diagrams/png/dfd.png)

## Database structure

The cloud uses a separate practicechart_ehr database. Preview uses practicechart_preview. The old ticket database is not part of this schema. Local tests use practicechart_test. Restore drills create a new timestamped local database.

| Table | Purpose |
| --- | --- |
| users | Unique staff login, role, password hash, active state, protected demo flag, and version |
| sessions | SHA-256 session token hash, account reference, and expiry |
| login_attempts | Hashed attempt key, count, and expiry |
| patients | Immutable MRN, demographics, provisional link, archive flag, and version |
| doctor_hours | Doctor weekday start and end minutes |
| appointments | Patient, doctor, interval, state, and version |
| schedule_blocks | Unavailable doctor intervals |
| visits | Patient, doctor, optional unique appointment, clinical revision number, and filing state |
| clinical_revisions | Immutable doctor content, revision, state, correction reason, and author |
| prescriptions | Exact doctor-entered medicine fields linked to a final revision |
| documents | Patient association, private path, MIME, size, digest, replacement reference, and author |
| invoices | Unique number, manual line items, integer-cent total, state, reason, and version |
| audit_events | Append-only actor, action, record reference, metadata, and time |
| reminders | Unique appointment and due date pair |
| backup_runs | Backup status, private bundle reference, and time |
| migrations | Applied migration names, hashes, and time |

MRNs and invoice numbers use independent sequences. The number formatting function does not truncate longer sequence values. Patient birth dates cannot exceed the Jamaica calendar day. Appointment intervals are positive and at most four hours. PostgreSQL GiST exclusion constraints reject active overlaps for both doctor and patient. Trigger checks serialize doctor availability changes and reject blocked or outside-hours bookings. A doctor account guard keeps at least one active doctor. Clinical, prescription, and audit histories reject update and delete operations.

The runtime role has no schema creation permission. It cannot update or delete protected history. The migration owner connection is separate from the runtime connection. Password hashes are never returned in staff API responses. Front desk patient queries omit clinical content and document metadata.

## Column dictionary

| Table | Column | PostgreSQL type | Nullable | Default |
| --- | --- | --- | --- | --- |
` +
  cols
    .map(
      (c) =>
        `| ${c.table_name} | ${c.column_name} | ${c.data_type} | ${c.is_nullable} | ${String(c.column_default || "").replaceAll("|", "/")} |`,
    )
    .join("\n") +
  `

## Server interfaces

All application data routes require a current session except login and health. The cron route requires its separate secret. Browser mutations must have the same origin as the request host. JSON uses camelCase. Validation errors return 400. Missing sessions return 401. Denied roles return 403. Missing records return 404. Stale changes, duplicate values, and overlaps return 409 where applicable. Unconfirmed service failures return 503. Private responses are not cached.

| Route group | Input contract and behaviour |
| --- | --- |
| POST /api/login | username and password; creates an eight-hour HTTP-only session cookie |
| POST /api/logout | closes the current server session and removes the cookie |
| POST /api/password | currentPassword and replacement password; closes existing sessions |
| GET or POST /api/patients | optional q search, or validated demographic fields |
| POST /api/patients/id | demographic fields and current version |
| POST /api/patients/id/archive | version and archived boolean; doctor only |
| POST /api/patients/id/reconcile | targetId and reason; doctor only |
| GET /api/availability | doctorId and Jamaica date |
| POST /api/appointments | patientId, doctorId, ISO startAt and endAt; confirms transactionally |
| POST /api/appointments/id | booking fields and current version; confirmed bookings only |
| POST /api/appointments/id/status | version and arrived or cancelled state |
| POST /api/visits | patientId, doctorId, optional matching appointmentId |
| POST /api/visits/id/clinical | expectedRevision, state, structured content, and correction reason; doctor only |
| POST /api/visits/id/file | expectedRevision; server requires the final diagnosis |
| GET or POST /api/documents | doctor-only listing or multipart patientId, title, kind, file, optional replacesId |
| GET /api/documents/id | authorised private file bytes, not a public storage URL |
| POST /api/invoices | patientId and description, quantity, unitCents line items |
| POST /api/invoices/id | version, issued or void state, and void reason |
| GET or POST /api/users | doctor-only account listing, creation, and versioned changes |
| GET /api/audit | doctor-only recent audit events |
| GET /api/reports/type | type-specific record ID and server role check |
| GET or POST /api/hours | read doctor hours; doctor-only guarded hour changes |
| POST /api/blocks | doctor-only interval creation or removal |
| GET /api/cron | secret-authenticated daily workflow start |

## Clinical and invoice payloads

Clinical content has symptoms, notes, diagnosis, treatment, allergies, vitals, labResults, medications, and certificate fields. Each medication has medication, dosage, route, frequency, duration, quantity, and instructions. The system neither infers nor recommends clinical content. Final entries require a diagnosis. A correction after a final entry requires a reason and another final revision.

Invoice lines contain description, positive integer quantity, and non-negative integer unitCents. The server calculates the total. Stored totals must fit the configured bound. Invoice states are draft, issued, and void. No payment settlement state or provider connection exists.

## File and external data structure

Diagnostic objects use a private practicechart/records or practicechart/preview prefix and a random UUID. Metadata is in PostgreSQL. Byte size, magic signature, claimed MIME, SHA-256, patient association, and optional replacement link are checked. The public demo accepts only the supplied fictional PDF. Earlier files are kept.

Local files live under PRIVATE_STORAGE_DIR, outside public. Cloud files use private Vercel Blob. The server fetches the stored object only after account and role checks. The response uses an attachment filename and private no-store caching. There are no external medical, pharmacy, laboratory, biometric, or Ministry integrations.

The recovery format begins with PCBACKUP1, a four-byte metadata length, a JSON encryption header, and authenticated encrypted compressed payload bytes. The payload contains a custom-format PostgreSQL dump, file bytes, row counts, hashes, creation time, and database identification. Recovery keys and bundles are private. See RECOVERY.md and the source listing for exact encoding.

## Configuration and global data

Cloud functions prefer EHR_DATABASE_URL so the existing ticket connection settings can remain intact for rollback. Local commands use DATABASE_URL and DATABASE_URL_UNPOOLED. Other settings are APP_URL, DEMO_MODE, STORAGE_DRIVER, PRIVATE_STORAGE_DIR, BLOB_READ_WRITE_TOKEN, CRON_SECRET, and recovery settings. .env.example gives safe local values. Never put cloud values into NEXT_PUBLIC variables.

The process-wide PostgreSQL pool has at most five connections. The session cookie contains a random opaque token. PostgreSQL stores its SHA-256 hash. The session lifetime is eight hours. The practice time zone is America/Jamaica. Workflow runs pass record IDs and status counts. Patient note bodies and passwords do not belong in workflow state or logs.

## Installation and operation

Run npm ci, npm run setup, and npm run dev. For the presentation, stop development, build, and start the production server. The setup script preserves existing local data. Docker uses a named PostgreSQL volume. The upload folder must also be preserved. Group and operator instructions are in GROUP_START_GUIDE.md and RECOVERY.md.

## Verification

${summary}

The control flow appendix records actual source-linked graphs and calculations. The test plan identifies feasible path cases and limits. Safe evidence includes automated results, axe results, load results, and an actual restore result. No human test or training completion is inferred from these files.
`;
await writeFile("docs/PROGRAMME_MANUAL.md", programme);
await mkdir("docs/evidence", { recursive: true });
await writeFile(
  "docs/evidence/build-summary.json",
  JSON.stringify(
    {
      application: "PracticeChart EHR",
      generatedAt: new Date().toISOString(),
      unitTests: { passed: unit.numPassedTests, failed: unit.numFailedTests },
      browserTests: {
        passed: browser.stats.expected,
        failed: browser.stats.unexpected,
      },
      coverage: coverage.total,
      restore,
      performanceSource: "performance.json",
      humanAcceptance: "not performed",
      staffTraining: "planned, not completed",
      realDeviceTest: "pending",
    },
    null,
    2,
  ),
);
console.log(
  "Generated development report, programme manual, database dictionary, and evidence summary.",
);
