# PracticeChart permission matrix

## Role permissions

The server applies these rules on each request. Hidden controls are not a security boundary. The server reads the current account role and active state from the database. Role changes revoke existing sessions.

| Function | Front desk | Doctor |
| --- | --- | --- |
| View and change patient demographics | Yes | Yes |
| Register a patient or provisional record | Yes | Yes |
| Archive or reconcile patient records | No | Yes |
| Book, reschedule, cancel, and mark arrival | Yes | Yes |
| View and print appointment schedules | Yes | Yes |
| Create, issue, print, and void manual invoices | Yes | Yes |
| Start a visit, view readiness, and file a ready visit | Yes | Yes |
| View notes, diagnoses, treatment, and clinical history | No | Yes |
| Enter or correct clinical records | No | Yes |
| Upload or retrieve diagnostic files | No | Yes |
| Create or print prescriptions and certificates | No | Yes |
| Print full clinical reports and visit summaries | No | Yes |
| Print an attendance slip without clinical details | Yes | Yes |
| Create, change, or disable staff accounts | No | Yes |
| Set doctor hours and unavailable intervals | No | Yes |
| View audit history | No | Yes |
| Change own password and log out | Yes | Yes |
| Download a full backup or run a restore in the website | No | No |

Front desk patient responses omit clinical entries and diagnostic document metadata. Visit readiness does not disclose the diagnosis. A front desk attendance slip contains attendance information only. Invoice lines are entered by staff. They do not prove payment.

Full backups and restores require a private operator terminal. The public demo protects its supplied accounts. It accepts only the supplied fictional diagnostic file. Doctors can manage other fictional demo accounts. The final active doctor cannot be removed.

These are course implementation rules. They are not evidence of legal compliance or clinical approval.
