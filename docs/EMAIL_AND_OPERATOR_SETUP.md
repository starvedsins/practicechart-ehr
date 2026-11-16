# Email and operator setup

## Appointment mail

Set RESEND_API_KEY and EMAIL_FROM in private server settings. Use a sending-only key restricted to the verified sender domain. Do not put the key in NEXT_PUBLIC variables, source, screenshots, manuals, or group chats. Keep provider tracking disabled for these appointment messages.

Patients can give email consent during intake. Reception can record or remove that consent in demographics. No email is sent when the address or consent is absent. The message contains appointment time in Jamaica time. It contains no name, MRN, diagnosis, treatment, prescription, lab report, or attachment.

Booking and rescheduling commit an outbox event in the same database transaction. Vercel Workflows process the queue. A deterministic provider idempotency key and a stored request protect retries against duplicate sends. Cancelled, changed, expired, and non-consenting bookings are skipped. Attempts are limited to five and a 23-hour retry window. The daily task also processes the queue and creates reminders due within 24 hours. Reception can start due retries from Email status.

The public demo forces all mail to delivered@resend.dev. This is the provider's test inbox. A Sent status means the provider accepted the request. It does not prove delivery to a person's inbox. A failed provider configuration remains a visible failure. Do not call a queued or failed message delivered.

The local application needs its own private mail settings for real provider sending. Tests use a mock transport and never send mail to the fictional addresses in the database. Provider checks use only the test inbox.

References: Resend. (2026). Idempotency keys. https://resend.com/docs/dashboard/emails/idempotency-keys. Resend. (2026). Test email addresses. https://resend.com/docs/dashboard/emails/send-test-emails.

## Technical operator commands

Use a trusted terminal with DATABASE_URL_UNPOOLED set to the separate PracticeChart owner connection. The staff website does not offer these privileges. Create an input JSON file under .private. Run npm run operator -- .private/staff-change.json. Keep this file out of Git and document bundles.

For creation, supply actorUsername, action set to create, and data containing username, name, role, and password. The role must be doctor or front_desk. Use at least 12 password characters. actorUsername identifies the active staff record used to attribute the operator action. It is not an alternative to the privileged database credential.

For an update, set action to update, add targetId, and supply data with role, active, and the current version. Add password only for a password reset. The command revokes the changed account's sessions. The last active doctor and public demo accounts remain protected.

For audit review, set action to audit. The command prints the latest 100 audit headers. It does not print clinical contents or passwords. The audit view itself is recorded. No third employee login role is added.
