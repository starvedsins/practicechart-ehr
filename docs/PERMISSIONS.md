# PracticeChart permission matrix

## Role permissions

Revised on November 15, 2026, to follow the group's proposed-system diagram and functional requirements F1 to F9. Receptionist is the UI name for the stored front_desk role. Doctor is a clinical role. Each request uses the current database session and role.

| Function | Receptionist | Doctor |
| --- | --- | --- |
| Register patients, change demographics, create interim records | Yes | No |
| Find patient records and view demographics | Yes | Yes, for care |
| Archive or reconcile patient records | Yes | No |
| Book, confirm, reschedule, cancel, and mark arrival | Yes | No |
| Read the worklist and appointment schedule | Yes | Yes, read only |
| Set practice hours and unavailable intervals | Yes | No |
| Start a visit, file a ready visit, print attendance | Yes | No |
| Create, issue, print, or void manual invoices | Yes | No |
| View visit counts and administrative reports | Yes | No |
| Upload medical documents and add replacements | Yes | No |
| View document titles and upload metadata | Yes | Yes |
| Download diagnostic document contents | No | Yes |
| View or record clinical notes, diagnoses, treatment, and manual lab results | No | Yes |
| Correct final clinical entries with a reason | No | Yes |
| Create and print prescriptions, certificates, clinical summaries, and patient history | No | Yes |
| Manage staff accounts or view the full audit log through the website | No | No |
| Change own password and log out | Yes | Yes |
| Full backup or restore through the website | No | No |

The receptionist prepares the visit. The doctor records care and marks the entry final. The receptionist files the ready visit. Filing still requires a final doctor-entered diagnosis. Receptionist responses contain document metadata for filing and replacement, but no clinical entries or private file paths. File bytes remain doctor-only. Doctors can enter lab results in the clinical record; this is separate from the receptionist's document upload task.

Staff provisioning, audit investigation, full backups, and restores are operator tasks outside the two employee login roles. There is no third employee login role. The SQL role constraint still permits only doctor and front_desk. Account-management APIs reject both employee roles. Tests may construct a trusted operator context only for fixture provisioning.

The source diagram gives the patient a separate registration-form action. UC01 instead says the receptionist completes it. This release follows the earlier no-portal decision and has no patient-facing intake form. That is a gap against the diagram, not proof that a patient can use the current staff form. See SPEC_AUDIT.md. Email delivery remains deferred by the earlier user decision. In-app confirmations and reminders remain available. There is no payment processing or external medical integration.

The earlier broader doctor permissions are superseded by this matrix. UI controls and server checks must agree. A hidden control alone is not a permission check.
