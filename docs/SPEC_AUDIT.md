# Initial brief and specification audit

This is the initial audit record, kept for traceability. Its gap descriptions refer to the code before the latest implementation. Read [AUDIT_RESOLUTION.md](AUDIT_RESOLUTION.md) for current status. The patient form, email, visit-linked lab uploads, pre-save duplicate checks, interim review, combined history, audit reads, and operator commands have now been implemented.

Review date: November 15, 2026. This review checks the current source brief against the code and recorded evidence. The application does not meet every source statement without exceptions. Passing tests do not prove full compliance.

## How the source specification is set up

The brief combines several stages of the earlier analysis project. The scope document states objectives, inclusions, exclusions, and planned dates. The old-system analysis includes interviews, observations, problems, and the PIECES framework. These are source context, not acceptance results for this application.

The SRS starts at section 3.1. Section 3.2 gives the proposed-system use case diagram. Section 3.3 lists high-level functions. Section 3.4 gives four use case narratives: UC01 registration, UC02 file retrieval, UC03 diagnosis and treatment, and UC04 visit filing. Section 3.5 lists F1 to F9. Section 3.6 lists N1 to N10. Section 3.7 maps requirements to SMART objectives and PIECES categories. The following rubric assesses that analysis submission. Its self-assessment scores are not marks for this implementation.

Later design diagrams, pseudocode, and flow graphs describe proposed designs. They need checks against the SRS. The assignment guide and syllabus separately control the implementation course deliverables. Lecture exercises and example business rules do not add EHR requirements.

The current Markdown file contains 54 embedded images. Images 25 to 33 contain the proposed roles, high-level functions, narratives, and numbered requirements. Images 34 to 37 contain traceability and the SRS rubric. Images 38 to 53 contain draft designs and flow graphs. Image 54 is the previously generated PracticeChart diagram. It is not an independent source requirement. The public repository excludes the private source scans, interviews, and chats.

## Functional requirement checks

| Source | Finding in current code | Status and limit |
| --- | --- | --- |
| F1, F2; UC01 | patientInput validates name, date of birth, address, and phone. savePatient saves through a transaction and database MRN sequence. | Implemented and tested. Emergency contact is optional. UC01 mentions it, but the numbered mandatory fields do not. |
| UC01 duplicate alternative | savePatient finds matching name and birth date and returns a warning with existing IDs. | Partial. The warning appears after the new record commits. UC01 describes prompting staff to use the existing record before creation. Shared names must remain valid. |
| F3; UC02 | patientList searches MRN and names. patientDetail returns role-filtered data. | Implemented and tested. The receptionist does not receive full clinical history, despite the broad UC02 narrative. This is a recorded access decision. |
| F4; UC02 interim path | Explicit provisional reason, retained MRNs, receptionist reconciliation, and a link to the primary record. | Implemented with a changed rule. A database outage cannot create a new record. Reconciliation preserves separate histories; it does not combine them into one clinical timeline. Review is an operational step, with no separate doctor approval state. |
| F5; UC03 | saveClinical stores doctor-entered diagnosis and treatment as revisions. | Implemented and tested. Text entry is used. No diagnosis or medication catalogue is supplied. |
| UC03 missing diagnosis | A final entry requires a diagnosis. A draft can omit one. | Partial against the literal narrative. The validation blocks final completion; it does not warn on every draft save without a diagnosis. |
| F6; UC03 labs | Doctors enter lab text within a visit revision. Receptionists upload private files. Doctors retrieve those files. | Partial. Manual lab text links to a visit. Uploaded files link to the patient, without a visit foreign key. The specific-visit attachment requirement is not fully met. |
| F7, F8, F9; UC04 | fileVisit requires a final doctor diagnosis, closes the visit, stores its date and patient link, and confirms success. | Implemented and tested. Filed visits form the digital logbook. The patient stays searchable. Filing does not archive the patient. |
| Proposed roles, image 25 | Receptionist office actions and doctor clinical actions have separate server checks and UI controls. | Corrected. Doctors cannot register, book, file, invoice, upload documents, or read visit analytics. Both roles can find patients and read schedules. |
| High-level invoices | Receptionists create manual service lines. The server calculates charges. Draft, issued, and void states are supported. | Implemented and tested. This is an invoice, not payment processing or the clinical visit summary. |
| High-level certificates and prescriptions | Doctors enter the content and print it from saved clinical records. | Implemented and tested. No clinical advice or external transmission is generated. |
| High-level schedules and analytics | Printable schedules and dated visit counts are available. | Implemented with limited analytics. No wider clinical trend analysis is claimed. |
| High-level email confirmation and reminders | Booking confirmation and in-app reminders are available. | Deferred by the earlier user decision. No external email is sent. This differs from the email actor in the source diagram. |
| Draft receipt and lab routines | Separate clinical summary, attendance slip, invoice, and authenticated diagnostic retrieval. | Intentional correction. The repeated receipt pseudocode is not used as the lab report implementation. |

## Non-functional requirement checks

| Source | Evidence | Status and limit |
| --- | --- | --- |
| N1: login within 3 seconds | Local login browser measurements in performance.json and cold-performance.json. | Historical local evidence dated October 31. No new cloud performance pass is claimed for this role revision. |
| N2: role restrictions | Server service checks, filtered responses, session role checks, direct denied requests, and both role browser tests. | Corrected and tested locally. Both hosted role workflows and direct denied requests passed after automatic deployment of commit 03a9e5f. See cloud-smoke-production.json. |
| N3: audit every view and change | Transactional record changes, searches, record views, document retrieval, exports, and denied access are recorded. Clinical revisions and audit events cannot be overwritten. | Partial against “all user activities.” Staff list and schedule configuration reads such as /api/doctors and /api/hours do not each write an audit event. Health and session identity reads are also excluded. |
| N4: 99 percent operational availability | Health route and controlled failure responses. | Unverified. A short benchmark cannot establish this target. |
| N5: complete record display in less than 2 seconds | Recorded local browser retrieval results, including the full display measurement. | Environment-limited historical evidence. No production guarantee or new role-revision benchmark. |
| N6: at least 50 concurrent users | Recorded 1, 10, and 50 session local tests with dataset and environment details. | Short load evidence only. “Without noticeable degradation” has no defined numeric threshold in the SRS. Human assessment remains pending. |
| N7: all patient data encrypted at rest and in transit | Cloud HTTPS, managed data services, private files, and encrypted full backup bundles. | Partial verification. Provider encryption settings are not an independent security certification. Default local Docker volumes and upload folders are not encrypted by this application. Local HTTP is for the presentation copy. |
| N8: common tasks in at most three steps | Directory, search, and open-record path. Browser and keyboard tests. | Partial. No agreed step-count method or complete common-task assessment with people exists. |
| N9: automatic daily full backup | Scheduled GitHub job, database snapshot, referenced files, encryption, retention, and an actual isolated restore result. | Implemented with dated evidence. The recorded restore is from October 31, not a new November drill. A past successful job does not establish an unbroken daily run history. |
| N10: applicable privacy standards | Access controls, audit history, private storage, and recovery controls. | Unverified. No legal compliance assessment or clinical approval is claimed. |

## Decisions and specification gaps

The numbered requirements, high-level table, and narratives do not always agree. UC02 says the receptionist sees full history. The current access decision protects clinical text. UC04 calls the patient inactive after filing. The implementation closes only the visit. The original diagram gives document upload to the receptionist, while the lab narrative also permits doctor upload. The revised role decision gives document upload to the receptionist and manual lab entry to the doctor.

Staff account management came from the earlier user plan, not the original proposed-system diagram. Neither employee role now has website account administration. Provisioning and audit investigation need a technical operator. There is no operator employee login. The protected service function is exercised by fixtures, but a complete operator account-management CLI is not supplied. This is a remaining delivery gap against the earlier plan.

The SRS lacks data retention periods, recovery point and recovery time targets, a formal correction policy, explicit permission tables, and an agreed definition of a performance session or user step. The implementation records choices in REQUIREMENTS.md, PERMISSIONS.md, RECOVERY.md, and TEST_PLAN.md. These choices must remain visible as decisions, not be attributed to the source.

The proposed-system diagram gives Patient a separate Complete Registration Form on System use case. UC01 instead makes the receptionist complete the form. Patient self-registration is not implemented. The earlier user plan excluded a patient portal, but that decision does not satisfy the separate patient interaction in the diagram. A patient intake form could support it without adding another staff role. This source conflict needs an explicit decision. External medical practice, Ministry of Health, pharmacy, laboratory, and biometric integrations remain excluded. No AI diagnosis, treatment advice, or payment processor is included.

## Course evidence and remaining work

Current local results: 78 automated tests passed and 9 browser tests passed. The build and TypeScript checks passed. Course artifacts include implemented module narratives, pseudocode, source-linked control flow graphs, all three complexity methods, test partitions, database design, and colour application screenshots. Coverage is measured for the configured library scope, not every application path. Automated browser actions are not human acceptance testing.

The original SRS has four narrative templates. The implementation module narratives explain code, but they do not replace those four source templates. The group must review the source-to-code differences above before submission. Team member coding contributions, physical phone checks, staff training, user testing, acceptance signatures, and the tutor-confirmed presentation slot remain human tasks. Hardware purchase, rollout, cost savings, and legal approval have no completion evidence.

## Evidence locations

Read REQUIREMENTS.md for source traceability, PERMISSIONS.md for current roles, TEST_PLAN.md for test scope, and RELEASE.md for release dates. Current code is in src/lib/service.ts, src/lib/validation.ts, src/app/api/[...path]/route.ts, and src/components/workspace.tsx. Automated results are in docs/evidence. Older results retain their original dates.
