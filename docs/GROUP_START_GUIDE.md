# PracticeChart group start guide

This guide lets group members install, test, present, and maintain the same application. It also identifies course work that still needs people.

Website: https://practicechart-ehr.vercel.app. Repository: https://github.com/starvedsins/practicechart-ehr. These links can be shared with the group. Use only fictional data.

## Course purpose

CIT4001 requires the group to implement and test the system from its earlier analysis work. The assignment guide requires a development report, programme manual, and user manual with colour pictures. The syllabus also requires a working demonstration, configuration management, training planning, and team participation. Each member must code at least one module. Generated source does not prove that a member completed that requirement.

The source case is an EHR for a private medical practice. Lecture examples about tickets, grades, and admissions supply test methods. They are not application requirements.

## Install and start

1. Install Git, Node.js 24 or later, and Docker Desktop. Select Linux containers in Docker.
2. Clone the public PracticeChart repository. Open a terminal in the repository folder.
3. Run `npm ci`.
4. Run `npm run setup`. Setup keeps an existing `.env` and existing patient data.
5. Run `npm run dev`. Open http://localhost:3000.
6. Use the doctor or front desk demo account in the README.

For a presentation build, stop the development server, run `npm run build`, then run `npm start`. Do not build into the same `.next` folder while a development server is using it.

The local database is at localhost port 5438. Docker stores it in a named volume. Uploads are in `.private/uploads`, outside the public web folder. `.env.example` contains only local demo values and variable names. Never send cloud environment files to the group chat.

## Team workflow

Use a branch for each task. Agree on the file or module owner before work starts. Keep changes small. Pull current changes before editing. Open a pull request with the problem, change, and checks. A second member should review it. Merge only after the checks pass.

Suggested contribution areas are patient registration and search, appointment rules, clinical records and reports, and tests and recovery. These are proposed tasks, not a record of completed member work. Record the actual author, commit, reviewer, and demonstration date for each contribution.

Use versioned SQL migrations. Do not change a migration after it has run. Add a new migration. The migration runner checks file hashes and takes a database lock. It does not run during every web request.

## Run the checks

Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`. Install the browser once with `npx playwright install chromium`. Run `npm audit --omit=dev` after dependency changes. Use `npx tsx scripts/performance.ts` for the stated local load test. Use a production server for performance work.

Run `npx tsx scripts/cold-performance.ts` for the separate fresh-process timing check. The database and operating system caches stay warm. Do not describe it as a Vercel cold start test.

To rebuild course documents, install the Python packages in scripts/docs-requirements.txt. Run `npx tsx scripts/course-analysis.ts`, `python scripts/regions.py`, `npx tsx scripts/diagram-details.ts`, `npx tsx scripts/report-content.ts`, and `python scripts/build-documents.py`. Run the tests and recovery drill first so the reports read actual evidence. Review the final PDF pages. Private cover details are read only from .private/group-cover.json when that local file exists.

Unit and integration tests use a separate local test database. Browser tests use the local presentation database and add fictional records. Do not point the full browser test suite at a live practice. Public cloud smoke checks use the fictional demo only.

Evidence is in `docs/evidence`. A test count is not proof of all possible paths or legal compliance. Keep expected and actual results, failures, fixes, environment, and limits with the evidence.

## Repeatable demonstration

1. Log in as frontdesk. Show that clinical and account controls are absent.
2. Register a fictional patient. Note the assigned MRN. Search for that MRN.
3. Edit a demographic field. Show that the MRN is unchanged.
4. Book a future weekday appointment. Show the review screen and confirmation.
5. Try a conflicting appointment. Explain the server and PostgreSQL checks.
6. Reschedule and cancel a separate appointment. Show that the slot is released.
7. Start a walk-in visit. Show that it cannot yet be filed.
8. Log in as doctor. Open the patient and enter sample notes, a diagnosis, and treatment.
9. Add fictional prescription details and certificate text. Save the final entry.
10. Make a correction with a reason. Show both revisions.
11. Download the sample lab report. Upload it to the same patient. Retrieve it again.
12. Print the prescription, visit summary, and patient report.
13. Log in as frontdesk. File the completed visit without opening its clinical notes.
14. Create and issue a manual invoice. State that it is not proof of payment.
15. Show audit history as doctor. Show the recorded restore test and explain how a full backup differs from a patient report.

Use the local copy if the network is slow. Test the laptop, power, projector, Docker, browser, and print view before the presentation. Keep an encrypted recovery bundle and its recovery key in separate private locations.

## Remaining course tasks

| Task | Evidence needed | Current human status |
| --- | --- | --- |
| Each member codes a module | Commit, review, and explanation | Pending member work |
| Group rehearses the demonstration | Date and attendance | Pending |
| Doctor and front desk training | Attendance and task checklist | Planned, not completed |
| Human usability and acceptance testing | Completed forms and issue records | Pending |
| Test on a real phone | Device, browser, tester, and results | Pending |
| Confirm presentation and submission dates | Tutor confirmation | Pending |
| Confirm private submission cover details | Group review | Pending |
| Add GitHub collaborators | Member GitHub usernames | Pending usernames |
| Store a separate recovery key copy | Controlled storage and operator record | Pending operator action |

The schedule lists presentations in the weeks of November 9 to 13 and November 16 to 20, 2026. A group message mentions November 9 and a user manual before the presentation. Confirm the actual group slot and submission rules with the tutor. Do not treat the older brief milestone dates as the current CIT4001 deadline.
