# Requirements and implementation decisions

## Source authority

The private source brief is Software Implementation Group Project Sem1-26_27.md. Its 53 embedded images were extracted and inspected during analysis. Images 26 and 27 contain the high level requirements. Image 32 contains F1 to F9. Image 33 contains N1 to N10. Images 38 to 41 are draft design diagrams. Images 42 to 53 are draft flow graphs. The raw brief, interviews, chats, and scans are not published here.

Assignment_Guide.docx controls the course report structure. Software_ImplTest_Syllabus (2).doc describes coding, testing, metrics, maintenance, configuration management, and team work. The semester schedule gives presentation windows. Lesson slides, tutorial exercises, and past papers support test methods. The revision guide is supporting material, not a higher authority than the course documents.

The source contains a private interview and observation notes. Those records describe the old practice. They are not evidence that this application passed human testing. The observation times and source performance claims conflict. No measured improvement is claimed from them.

## Traceability

| ID | Source and requirement | Implementation | Verification |
| --- | --- | --- | --- |
| AUTH-01 | N1; draft login; doctor and front desk login | Argon2id, hashed sessions, expiry, login limit | Authentication integration tests and both role browser logins |
| AUTH-02 | N2; account administration | Server role checks, disabled accounts, last doctor guard | Denied direct URL tests, account and session tests |
| PAT-01 | F1, F2, UC01; registration fields and validation | Patient form, Zod, SQL date rule, unique MRN sequence | Date and string boundaries; duplicate name and MRN tests |
| PAT-02 | F3; patient ID and name search | Parameterised search, demographic updates, version check | Search browser flow and stale update race |
| PAT-03 | F4; interim record | Marked provisional record and doctor-controlled linking | Reconciliation test; both MRNs retained |
| APT-01 | High level requirements; appointment requests | Doctor hours, available slots, review and confirmation | Booking browser flow and hour boundaries |
| APT-02 | Draft appointment functions | Reschedule, cancel, arrival, completion | Browser reschedule and cancel; rollback tests |
| APT-03 | User requirement; concurrent overlaps | PostgreSQL GiST exclusions for doctor and patient | Simultaneous booking and adjacent interval tests |
| CLN-01 | F5; doctor diagnosis and treatment | Structured doctor form and versioned clinical records | Draft, final, stale revision, and correction tests |
| CLN-02 | F6; lab results | Manual lab text and private diagnostic files | Exact file byte retrieval and denied access tests |
| VIS-01 | F7 to F9; file visit and logbook | Ready flag, diagnosis check, filed timestamp | Filing before and after doctor completion |
| OUT-01 | Prescription draft routine | Exact doctor-entered medication output | Prescription storage test and printed browser output |
| OUT-02 | Receipt draft routine | Clinical visit summary and separate attendance slip | Role tests and print workflows |
| OUT-03 | Lab report requirement | Document list and authenticated private retrieval | Private report browser tests |
| OUT-04 | Patient report routine | Patient history, revisions, medications, file index | Report API and print tests |
| OUT-05 | Image 27; medical certificate | Doctor-authored certificate output | Browser and report tests |
| BILL-01 | Image 27 and user decision; invoices | Manual JMD line charges; draft, issue, void | Integer-cent partitions and invoice browser flow |
| AUD-01 | N3; activity history | Transaction audit events and append-only revisions | History update/delete rejection and correction tests |
| REC-01 | N9; daily backup and recovery | Full encrypted database and file bundle | Actual isolated restore result in evidence |
| JOB-01 | Image 27; reminders | Daily idempotent in-app reminder workflow | Workflow and duplicate reminder tests |
| PERF-01 | N1, N5, N6; login, retrieval, 50 users | Production build and bounded connection pool | Stated 1, 10, 50 session benchmark |
| UX-01 | N8; common tasks in at most three steps | Patient directory, search, open record | Keyboard and complete browser workflows |
| SEC-01 | N7; protection in transit and at rest | Cloud TLS, managed storage, private files, encrypted recovery | Access tests and provider configuration review |
| OPS-01 | N4; 99 percent operational availability | Health route and failure responses | Target only; no long-term uptime claim |
| GOV-01 | N10 and scope statements | Access controls and evidence limits | No legal or clinical approval claim |

## Conflicts and decisions

| Conflict or unsupported statement | Decision |
| --- | --- |
| Lab output repeats DisplayReceipt | Retrieve the actual diagnostic file by patient-linked document ID. |
| Receipt lists no money, but another page asks for invoices | Keep the visit summary separate. Add manual invoices by user choice. No payment processing. |
| Receptionist narrative displays full clinical history | Front desk receives demographic and visit-state data only. Clinical access needs a doctor role. |
| Duplicate interim files conflict with unique patient records | Make interim creation explicit and mark it provisional. Doctor linking preserves both identifiers and histories. Never bypass an outage by making another record. |
| Filing calls the patient inactive or archived | Close the visit. Keep the patient available for future care. Patient archiving is a separate doctor action. |
| Draft code stores or compares plain passwords | Store Argon2id hashes. Derive the role from the server account. |
| Sequence drafts confirm registration before a database save | Show success only after the transaction commits. |
| Draft graphs claim all input functions have complexity 2 | Generate graphs from the implemented functions. Record the graph convention and calculate all three methods. |
| Email confirmation and reminders need a delivery service | Use on-screen confirmation and in-app reminders. External email is deferred by user choice. |
| Original text claims delays; interview says no major delay | Measure this build. Do not claim a measured reduction from that source. |
| Dates include old milestones and August 2027 implementation | Use the current course schedule for planning. Confirm the group presentation slot with the tutor. |
| Hardware purchases and vendor support appear in the scope | Supply local and cloud setup requirements. Do not claim equipment was bought or vendor training occurred. |
| Source states compliance, cost recovery, and user training | Treat these as unverified goals. Supply controls, a training plan, and blank acceptance forms. |

## Fixed defaults

The practice time zone is America/Jamaica. Initial doctor hours are Monday to Friday, 08:00 to 17:00. Available start times use 30 minute steps. The booking form allows several visit lengths; the database still rejects overlaps. Appointments must be at least one minute and no more than four hours. There is no patient self-service portal. Local upload storage is private. Public demo uploads accept only the supplied fictional report.
