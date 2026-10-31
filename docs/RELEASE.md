# PracticeChart release record

## Published application

Released for the fictional CIT4001 demonstration on October 31, 2026.

- Website: https://practicechart-ehr.vercel.app
- Public repository: https://github.com/starvedsins/practicechart-ehr
- Vercel project: practicechart-ehr
- Vercel team: PracticeChart, slug practicechart7

The new address is a project domain. It follows future production deployments. The earlier public address remains an alias: https://campusfix-seven-iota.vercel.app. The prior deployment, ticket database, and unrelated storage paths were retained. They are not EHR data sources.

Production uses the separate practicechart_ehr Neon database and private practicechart storage paths. Preview uses practicechart_preview. The runtime database role is separate from the operator connection. The existing ticket connection setting was kept for rollback. The EHR server uses EHR_DATABASE_URL.

Vercel Hobby rejected a deployment with a Git commit author who was not a member of the Vercel team. The release used an isolated source artifact through the authorised Vercel CLI account. The public Git history keeps the group attribution. No person was added as an author merely to pass that restriction. GitHub automatic deployment is not configured.

## Verified evidence

| Check | Recorded result |
| --- | --- |
| Type checking and production build | Passed |
| Vitest, including real PostgreSQL tests | 76 passed |
| Complete Playwright workflows | 8 passed |
| Axe on checked desktop and emulated phone pages | Zero recorded violations |
| Production dependency audit | Zero known vulnerabilities at the check date |
| Isolated cloud preview | Both roles and exact private file retrieval passed |
| Public production site | Both roles and exact private file retrieval passed without a protection bypass |
| GitHub verification job | Passed, see github-actions.json |
| GitHub daily backup job, manual run | Passed, private encrypted bundle stored |
| Restore of that job's full backup | 16 tables and 2 files matched; all row values and both number sequences checked |
| Restored application drill | Both logins, patient search, private file retrieval, and front desk denial passed |
| Local database restart | Record fingerprints and private files persisted; the same app process reconnected |
| Background Workflow | Two runs completed; one reminder for one appointment; all checked files available |
| Local load | 1, 10, and 50 active sessions, 30 seconds per load, zero recorded request errors |
| Separate process-cold timing | Three fresh server processes; limits stated in cold-performance.json |
| Source and PDF review | Public copies exclude infrastructure secrets, uploads, backups, private interviews, and student numbers |

Evidence files state the environment, sample size, time, and limits. The restore timing measures the restore and checks. It excludes download, decryption, and the separate browser drill. A patient report is not a full backup.

The reminder job runs daily at 05:00 UTC (midnight in Jamaica). The GitHub backup job runs daily at 06:00 UTC (01:00 in Jamaica). Scheduled jobs can be delayed. Check their actual results. Seven private cloud backup copies are retained. The private recovery key stays outside the repository and outside GitHub Actions.

## Demo accounts

| Role | Username | Password |
| --- | --- | --- |
| Doctor | doctor | DoctorDemo!2026 |
| Front desk | frontdesk | DeskDemo!2026 |

These passwords are public demo values. The cloud protects these accounts. Uploads accept only the supplied fictional sample. Enter fictional data only.

## Local presentation

Install Node.js 24 or later and Docker Desktop. Run npm ci, npm run setup, and npm run dev. For the presentation, stop development, run npm run build, then npm start. The Docker volume and private local upload folder preserve data between restarts. GROUP_START_GUIDE.md gives the complete steps and demonstration script.

Submission PDFs are in docs/submission. Local copies with private group cover details are in .private/submission. Confirm those cover details before submission. Keep them out of the public repository.

## Human tasks and limits

Each member still needs an actual module contribution and explanation. The group still needs a rehearsal, training attendance, human acceptance results, a real phone test, and confirmation of its presentation slot. Save a separate recovery key copy in a controlled location. Collaborator invitations need member usernames.

The short local load tests do not establish cloud performance or 99 percent availability. No clinical approval, legal compliance, completed staff training, human acceptance, or live pilot is claimed. Full path coverage is not claimed. TEST_PLAN.md records feasible paths and coverage limits.
