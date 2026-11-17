# PracticeChart EHR change record

## 2026-10-30

The user confirmed that the old CampusFix folder and the earlier change record were deleted. The new build does not claim to have inspected that deleted source. Existing test results are not evidence for PracticeChart.

The source project is the private practice EHR in Software Implementation Group Project Sem1-26_27.md. Assignment_Guide.docx sets the report structure. The syllabus sets course expectations. Supporting lessons and examples supply testing methods, not EHR business rules.

The user approved the PracticeChart EHR plan. Manual invoices are included. Payments and external email delivery are excluded. The Vercel project and team will be renamed after the replacement is verified. The old public address will be kept as an alias if possible.

The new application folder is practice-ehr. Requirements, decisions, and actual test evidence will be maintained there. Human coding, training, testing, and acceptance will not be reported as complete without evidence.

## 2026-10-31

PracticeChart EHR was implemented and published at https://practicechart-ehr.vercel.app. Public source is https://github.com/starvedsins/practicechart-ehr. The Vercel project is practicechart-ehr. The team is PracticeChart, slug practicechart7. The former public URL remains an alias. The prior deployment and unrelated resources were retained.

The local PostgreSQL presentation copy, migrations, tests, diagrams, manuals, source listing, and safe evidence are in practice-ehr. The automated suite passed 74 Vitest tests and 8 Playwright workflows. GitHub verification and backup jobs passed. The encrypted GitHub backup restored into an isolated local database. All 16 tables, all row values, both files, both record number sequences, and booking and history guards were checked. Human course tasks remain pending as listed in the group guide.


Final booking review checks added duration-aware availability, patient conflict checks, and the selected patient name and MRN. The final local regression suite passed 76 Vitest tests. Eight complete browser workflows cover both roles. The public release record and safe evidence state the final results.

## 2026-11-15

The group requested the original proposed-system role split. The earlier broad doctor permissions are superseded. Receptionists perform registration, scheduling, filing, invoices, uploads, and visit analytics. Doctors perform clinical work and clinical outputs. Staff provisioning and global audit review are operator tasks. Direct API checks enforce the roles. The user manual, screenshots, diagrams, programme manual, processing narratives, and role tests were updated. Existing records and prior clinical revisions are preserved.

## Patient form and email implementation, November 15, 2026

The latest instruction enables patient form completion as a separate public action and provider email confirmations and reminders. Reception retains direct registration and office functions. Added pending intake review, pre-save duplicate guards, doctor interim review, combined linked history, visit-linked lab uploads, expanded read and failure audit, operator account commands, monthly and per-record visit analytics, and renewed load and restore evidence. Public demo intake is limited to a fictional example. Demo mail is routed to a provider test inbox. See AUDIT_RESOLUTION.md for current scope and external verification limits.

## Case-sensitive login and duplicate patient guard

Usernames now require the stored letter case. The login rate limit still groups case variants. A database identity key blocks identical normal registrations and demographic edits, including concurrent requests. A reason cannot override an identical record. Same-name patients with different contact or address details still require review. Explicit interim records remain supported. Historical duplicate rows are marked for doctor review and controlled receptionist linking. No records or clinical history were deleted. Local test suites were not run for this fix, as requested.
