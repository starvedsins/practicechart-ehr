# Audit resolution and current scope

Review date: November 15, 2026 (Jamaica time). Evidence timestamps use UTC. SPEC_AUDIT.md preserves the initial findings. This document gives the current implementation status after the user requested those code changes.

## Actors and functions

| Actor | Available functions | Access boundary |
| --- | --- | --- |
| Patient | Complete the public registration form and receive a submission reference | No login to staff pages. No patient search, record retrieval, MRN selection, or clinical access. Reception reviews the form before creating a patient record. |
| Receptionist | Register or update a patient, review patient forms, retrieve demographic files, create interim records, prepare and file visits, manage appointments, print schedules, make manual invoices, upload documents, and review visit analytics | No diagnosis, treatment, prescription, certificate, clinical history, or diagnostic file download. |
| Doctor | Review clinical history, record diagnosis and treatment, enter lab results, make prescriptions and medical certificates, retrieve diagnostic files, correct clinical entries, and review interim records | No patient registration, office booking changes, visit filing, invoices, general uploads, or visit analytics. |
| Email notification system | Send booking confirmations and reminders from the queue | Runs as background work. Includes appointment time only, with no clinical text or attachments. Requires a patient email and consent. |

Both staff roles can find patients and read appointment schedules. A patient is a separate public actor, not a third staff role. There are still only two employee login roles. Staff provisioning, audit investigation, full backup, and restore are technical operator tasks.

## Code gaps closed

| Initial gap | Current implementation | Verification |
| --- | --- | --- |
| No patient registration interaction | /register accepts a validated form without staff login. It stores a pending intake. The receptionist can accept or reject it. Acceptance creates the MRN and review event in one transaction. | Browser patient-to-reception workflow; simultaneous acceptance, duplicate retry, role restriction, invalid consent, and rate-limit tests. |
| Duplicate warning after a patient was created | Reception checks matches before saving. The server locks matching name and birth-date registrations. An explicit reason is required for a separate matching record. | Simultaneous registrations create one record unless staff give a separate-record reason. A refused duplicate leaves the intake pending. |
| Interim records lacked a doctor review state | A doctor records a review reason and current version. Reception can then link the interim record. Demographic edits clear the old review. | Review and reconciliation integration tests. Both MRNs and original clinical entries remain. |
| Linked history was split across separate screens | Patient retrieval follows linked records and returns their combined visit, clinical, appointment, and file history. Original record IDs remain on entries. | A consultation entered under an interim MRN appears through the primary patient history. Reception still receives no clinical entries. |
| Missing diagnosis on a draft produced no warning | Draft saving shows a diagnosis warning. Final completion and visit filing remain blocked without a doctor diagnosis. | Validation and final-entry tests; browser clinical workflow. |
| Lab uploads had no visit link | New lab reports require a visit belonging to the same patient. The database enforces the association. Other diagnostic documents can remain patient-level. | Browser lab upload; mismatched patient and visit rejection. Existing legacy file associations are preserved. |
| Missing email confirmation and reminders | Booking transactions queue confirmations. A Workflow sends queued mail and creates reminders for confirmed appointments within 24 hours. It retries due failures with a fixed provider request and idempotency key. | Queue, cancellation, consent, retry, and duplicate reminder tests. The preview sent both mail types. Provider records confirmed test-inbox delivery. See intake-mail-cloud.json and email-provider.json. |
| Limited visit analytics | Reception has daily and monthly visit totals, filing-state totals, and counts by patient MRN. | Role-restricted report service and browser reports. Counts contain no diagnoses. |
| Staff list and schedule settings reads lacked audit events | Staff identity, doctor list, schedule settings, sample exports, public form submissions, and failed authenticated requests now write audit events. Existing business reads and changes remain audited. | Direct server and role tests. Health probes remain outside the patient activity log. |
| No complete operator account tool | npm run operator accepts a private input file for account creation, role or active-state changes, password reset, and audit review. It uses the owner connection and records the operator action. | Local operator creation check; account version, session revocation, protected demo, and last-doctor tests. |
| Old performance and restore results | A new local load run and fresh-process run were recorded. A new full backup was restored into an isolated database and private file folder. | performance.json, cold-performance.json, and restore-result.json. The restore checked 19 tables and 15 referenced files. |

The public demo registration form accepts only the supplied fictional example. Public demo uploads accept only the sample report. Public demo mail always goes to the provider's test inbox, regardless of the entered address. These controls prevent the public exercise from becoming a real practice intake or mail service.

## Decisions that remain explicit

The patient and receptionist can both complete a registration form. The patient submits information for review. The receptionist can register directly. This resolves the diagram and UC01 narrative without giving patients access to staff data.

The receptionist can retrieve the administrative patient file. Full clinical text remains doctor-only. Filing closes a visit and adds it to the logbook. It does not hide the patient. An interim record needs a reason and an available database. A database outage must not create uncontrolled duplicates.

A new lab file must identify its visit. Old patient-level files are not assigned to a visit by guesswork. Reception can add a visit-linked replacement while preserving the earlier file. Doctors enter lab result text within the consultation record.

Manual invoices record service charges. They do not process payments. A clinical visit summary, an attendance slip, an invoice, a patient report, and a full recovery backup are different outputs.

No external medical practice, Ministry of Health, pharmacy, laboratory, biometric, or AI clinical integration is added. The email service is the notification actor requested in the source and in the latest user instruction.

## Targets that code alone cannot prove

N4 requires 99 percent operational availability. That needs observation over an agreed period. N10 needs an applicable legal and privacy review. Neither result is claimed.

N7 requires encryption at rest and in transit. The cloud uses HTTPS and managed data services. Recovery bundles are encrypted. Local PostgreSQL volumes and upload folders require an encrypted host drive, and remote local-network access needs TLS. The application does not enable or certify host disk encryption. Use the local copy with fictional data until those operator controls are verified.

N8 requires common tasks in three steps. TASK_STEPS.md defines the counted screen actions and starting points. Automated task checks do not replace human usability testing.

The short load runs do not establish cloud capacity or long-term availability. Daily backup jobs must be checked over time. A restore result proves the recorded recovery drill, not every future recovery.

Team coding contributions, physical phone checks, staff training, user testing, acceptance decisions, hardware purchases, and the tutor-confirmed presentation slot remain human tasks. Blank forms and a training plan are supplied. No completion is invented.
