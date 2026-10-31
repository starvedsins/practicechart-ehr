# PracticeChart EHR

A working electronic health records system for a fictional private medical practice. Built for CIT4001 Software Implementation and Testing at the University of Technology, Jamaica.

Use fictional data only. This is a course demonstration. It has no clinical approval, live pilot, or completed user acceptance claim.

[Open PracticeChart](https://practicechart-ehr.vercel.app) or [view the public source](https://github.com/starvedsins/practicechart-ehr). See [the release record](docs/RELEASE.md) for verified checks and limits.

## Start the local presentation copy

Install Node.js 24 or later and Docker Desktop with Linux containers. Keep Docker running.

```powershell
git clone https://github.com/starvedsins/practicechart-ehr.git
cd practicechart-ehr
npm ci
npm run setup
npm run dev
```

Open http://localhost:3000. Setup creates `.env` only when it is missing. It starts PostgreSQL 18, applies migrations, grants the runtime role, and adds fictional records only to an empty database.

| Role | Username | Public demo password |
| --- | --- | --- |
| Doctor | doctor | DoctorDemo!2026 |
| Front desk | frontdesk | DeskDemo!2026 |

These credentials are intentional demo credentials. They are not infrastructure credentials. Cloud demo accounts are protected. Local accounts can be changed when `DEMO_MODE=false`.

## What is included

- Account and session management with server role checks.
- Patient registration, unique MRNs, search, updates, provisional links, and archiving.
- Availability, booking confirmation, rescheduling, cancellation, arrival, and visit filing.
- PostgreSQL overlap constraints and version checks for concurrent changes.
- Doctor-entered consultation notes, diagnoses, treatment, medications, and certificates.
- Append-only clinical revisions and audit history.
- Private diagnostic documents and actual report retrieval.
- Manual service invoices, patient reports, attendance slips, and practice reports.
- Daily in-app reminder work and encrypted full EHR backups.

There is no payment processing, AI clinical advice, biometric login, or external medical, pharmacy, laboratory, or Ministry of Health connection.

## Data persists

PostgreSQL uses the `practicechart-data` Docker volume. Private local uploads use `.private/uploads`. Stop with `docker compose stop`. Start again with `docker compose up -d`. Do not use `docker compose down -v` unless you intend to destroy the local presentation database. Keep uploads with the database.

## Checks and recovery

```powershell
npm run typecheck
npm test
npx playwright install chromium
npm run build
npm run test:e2e
npm audit --omit=dev
npm run backup
npm run restore:test
```

`npm test` rebuilds only the named local `practicechart_test` database. It refuses a remote database. The restore test creates a new local database and retains it for inspection. It never restores into the live EHR database.

The backup includes the whole separate EHR database and its uploaded files. A patient report is a reading copy for one patient. It cannot restore the application. See [the recovery guide](docs/RECOVERY.md).

Read [the group start guide](docs/GROUP_START_GUIDE.md), [user manual](docs/USER_MANUAL.md), [development report](docs/DEVELOPMENT_REPORT.md), and [programme manual](docs/PROGRAMME_MANUAL.md). Generated submission PDFs are in `docs/submission`.

Read [the server permission matrix](docs/PERMISSIONS.md). Full backups and patient reports are different operations.

## Stack

Next.js, TypeScript, Tailwind CSS, PostgreSQL 18, Neon, Drizzle ORM, Zod, private Vercel Blob, Vercel Workflows, Vitest, Playwright, and axe. The lockfile pins installed dependencies. Use the installed Next.js and Workflow documentation when updating these packages.

## Public source rules

Commit source, migrations, lockfile, safe documentation, and fictional test evidence. Never commit `.env`, `.private`, backups, recovery keys, database files, private uploads, `node_modules`, course interviews, or private chat exports. The old application was deleted. Its business logic and test results are not evidence for this build.
