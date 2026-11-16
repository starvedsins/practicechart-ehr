# Common task step method

Count a step when a user opens a task screen, submits one completed form, or selects a record or output. Field entry and movement within a form belong to that form step. This is a documented implementation measure. The source did not define its step-count method.

| Task and starting point | Counted steps | Total |
| --- | --- | --- |
| Patient registration, from login | Open Patient registration form; complete and send form | 2 |
| Register a patient, from staff workspace | Open Patients; open Register patient; complete and submit form | 3 |
| Retrieve a patient, from staff workspace | Open Patients; enter search; open matching record | 3 |
| Clinical entry, from prepared patient record | Open Clinical record; select visit if needed; complete and save entry | 3 |
| Prescription, from prepared patient record | Open Visits; select Prescription for a completed visit; print | 3 |
| Schedule report, from staff workspace | Open Reports; select date; open schedule | 3 |
| File a ready visit, from Today worklist | Open the ready patient; open Visits; select File visit | 3 |

Duplicate review, invalid input, missing records, and failed saves add recovery steps. Booking includes a review screen. No claim is made that every task or exception needs at most three actions. Human usability testing remains pending. A printed browser output can also need the operating system print dialog.
