# Test plan and basis path evidence

## Strategy and environment

Test the database and domain services first. Integrate the server routes and browser interface after those checks. Use fictional fixtures and a separate local test database. Use the complete application for system tests. Use manual fault cases for missing files, invalid data, stale changes, and rejected access. Keep regression checks on the protected paths.

Vitest covers partitions, boundaries, and domain/database outcomes. Playwright covers real browser workflows and direct route restrictions. Axe checks selected pages. The restore drill tests a full encrypted recovery bundle. The performance script states its load, timing definitions, environment, and limits.

This is a bottom-up integration strategy: validation and persistence, then service transactions, then routes, then role workflows. Database fixtures and test callers act as drivers. File failure tests isolate storage. No stub is presented as proof that a real database constraint works. The booking tests use actual PostgreSQL transactions.

## Feasible independent path proof cases

These cases take different application decision edges. Expected and actual outcomes are checked by the named executable tests. Graph node numbers are in CONTROL_FLOW.md and the per-function graphs. The generated syntactic path lists are not labelled as executed paths merely because a graph tool found them.

| Module | Inputs and starting state | Expected outcome | Executable evidence |
| --- | --- | --- | --- |
| Login | Valid active doctor and correct password | Create session; token resolves to doctor | logs in and stores only a token hash |
| Login | Wrong password or missing username | Same rejection; no new valid session | rejects wrong and missing accounts with the same error |
| Login | Eight failed attempts in the window, then another | Reject with 429 | enforces the login attempt limit |
| Session | Expired token or removed session | No authenticated account | rejects an expired session; token deletion assertion |
| Patient save | Valid new person | Commit patient and unique MRN | preserves distinct MRNs |
| Patient save | Existing record and current version | Commit demographic change | permits one of two stale demographic changes |
| Patient save | Two writers use one expected version | One save; one conflict | stale demographic race test |
| Booking | Active patient and free interval | Commit confirmed booking | browser confirmation workflow |
| Booking | Same doctor, overlapping interval | Reject and preserve other booking | adjacent and overlap test |
| Booking | Two requests claim one interval | Exactly one commits | simultaneous booking test |
| Booking | Start outside hours or end beyond closing | Reject | hour boundary test |
| Reschedule | Current confirmed booking, target conflicts | Roll back; original time remains | keeps the original booking when a reschedule conflicts |
| Cancel | Current confirmed booking | Keep row, cancel, release slot | releases a cancelled slot and retains its history |
| Visit | No final diagnosis | Reject filing | clinical correction and filing test |
| Clinical save | New visit, valid draft | Append draft revision | preserves revisions test |
| Clinical save | Stale expected revision | Reject with conflict | stale revision assertion |
| Clinical save | Previous final entry, no reason | Reject correction | correction reason assertion |
| Clinical save | Previous final entry, final correction and reason | Append revision; keep earlier content | correction test and complete browser workflow |
| Prescription | Doctor enters explicit medicine fields | Store and print those fields | medication storage test and browser prescription check |
| File retrieval | Approved path and existing bytes | Return exact bytes privately | file storage test and browser retrieval test |
| File retrieval | Unsafe path or missing object | Reject or return unavailable | private path and missing-file tests |
| Invoice | Valid quantities and exact unit cents | Calculate exact total; create draft | total calculation and invoice state test |
| Invoice | Issue current draft | Mark issued | invoice state and browser issue test |
| Invoice | Void without reason | Reject | void reason assertion |
| Invoice | Void issued invoice with reason | Keep row and mark void | invoice state test |
| Account | Front desk requests account administration | Reject and audit denied access | front desk account creation and direct URL tests |
| Account | Disable the final doctor | Reject in PostgreSQL | last active doctor test |
| Account | Disable another test account | Revoke sessions and deny login | account access test |
| History | Update or delete protected rows | Reject | immutable clinical and audit tests |
| Recovery | Complete encrypted dump and matching file | Restore into isolated database | restore-result.json |

## Partitions and boundaries

Use valid and invalid dates, leap days, today's birth date, future dates, required names, maximum text lengths, invalid phone characters, invalid roles, and password length limits. No patient age range is invented.

Use free, occupied, adjacent, blocked, outside-hours, cancelled, and stale appointment states. Test opening time, one minute before opening, exact closing time, and an interval that starts at closing. Test zero, negative, valid, and excessive durations. Use database races for simultaneous requests.

Use empty, approved, wrong-signature, mismatched MIME, missing, maximum-size, and too-large files. Test public demo sample restrictions. Use zero, negative, fractional, valid, and excessive invoice values. Exact cents avoid floating-point totals in stored invoices.

Use valid sessions, wrong passwords, unknown accounts, disabled accounts, expired sessions, front desk direct clinical requests, guessed document IDs, and forged origins. A hidden button alone is not evidence of a permission check.

## Coverage and feasibility limits

The V8 coverage summary applies to the tested library files and the Vitest process. Browser work is measured separately. It is not valid to add the percentages together. Full statement, branch, and possible-path coverage are not claimed.

Graph candidates can include contradictory state assumptions. Examples include saving successfully after the same execution has raised a stale-version error, treating one previous revision as both draft and final, or filing a visit that is both open and ready. Those combinations are infeasible. A loop-skipping path also needs an empty collection. A medicine loop path needs the corresponding number of medicines. Documented tests use feasible records and states.

## Release criteria

Type checking and the production build must pass. Unit, integration, and complete browser workflows must pass. Role and private file failures must be fixed before release. The full recovery test must pass. Scan Git contents for secrets and private source material. Record load results and axe results. Record any unmet long-term target as a limit.

Human acceptance, actual staff training, legal review, and testing on a real phone remain separate tasks. Blank forms are supplied. No automated result is presented as completed human testing.

## Separate operational probes

database-outage.json records a real server connection failure in a separate local production process. It used an unavailable local database port. The login route returned 503 without a session cookie. The browser showed the service error and kept the entered fields. The normal presentation database stayed running.

local-persistence.json records an actual Docker database restart. Fingerprints of all seven record tables matched before and after. A private local file matched byte for byte. The existing session remained valid. The same application process reconnected after its idle pool connections closed.

private-blob.json records an unsigned request to a real private Blob object. It returned 403. The evidence omits the stored URL. cloud-smoke-production.json records both roles against the public domain without a deployment bypass.

workflows.json records two actual cloud Workflow runs. They produced one reminder for one fictional appointment and recorded file integrity results. github-actions.json records successful remote verification and backup jobs. recovery-browser.json records a separate restored application drill. These probes are separate from the 76 Vitest tests and eight Playwright suite cases.
