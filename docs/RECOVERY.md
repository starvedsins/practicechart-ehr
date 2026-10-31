# Full backup and recovery guide

A patient report is a reading copy. It contains selected information for one patient. It does not contain the database schema, account data, all records, or every uploaded file. It cannot restore PracticeChart.

## Full EHR backup

Run `npm run backup` from a private operator terminal. The command uses `DATABASE_URL_UNPOOLED`, not the pooled application connection. It refuses a database whose name does not start with practicechart.

The command opens a repeatable-read snapshot, runs PostgreSQL 18 pg_dump with that snapshot, and reads the document manifest from the same snapshot. It retrieves each referenced immutable file and checks its SHA-256 digest. The bundle includes the full separate EHR database, file bytes, row counts, and a manifest. It does not include the old ticket database or unrelated Blob paths.

The bundle is compressed and encrypted with AES-256-GCM. A new random content key is wrapped with RSA-OAEP using SHA-256. The first local run creates a 4096-bit recovery key pair in `.private`. Only the public key is needed for scheduled backup creation. The private key must remain outside Git and outside the public demo.

Local bundles are stored in `backups`. With `STORAGE_DRIVER=blob`, an encrypted copy goes to `practicechart/backups/` in the private Blob store. Seven daily cloud copies are retained. The GitHub job runs at 06:00 UTC, which is 01:00 in Jamaica. GitHub can delay a scheduled job. Check its actual result and the backup run record.

## Configure the daily job

Set these GitHub repository secrets through the account settings or a trusted operator tool:

- BACKUP_DATABASE_URL: the unpooled connection to the separate EHR database.
- BLOB_READ_WRITE_TOKEN: the private store token.
- BACKUP_PUBLIC_KEY: the base64-encoded PEM public recovery key.

Do not put the private recovery key in GitHub Actions. Do not publish backup bundles as Actions artifacts. Run the workflow manually once and check that the private backup exists before relying on its schedule.

Keep a separate encrypted recovery copy and the private key in separate controlled locations. Neon and Blob are different data services. A second file copy in the same Blob account is not protection against loss of that whole account.

## Actual restore test

Start Docker, create a backup, and run `npm run restore:test`. The command decrypts the newest local bundle and creates a new local database named practicechart_restore followed by a timestamp. It refuses a remote restore target. It restores the full dump and writes files to an isolated `.private/restore-test` folder.

The test checks table counts, file hashes and bytes, the MRN sequence, history protection, and overlap rejection. Its measured result is in `docs/evidence/restore-result.json`. The test database is retained for inspection. No successful restore is claimed merely because a dump file exists.

## Recovery drill and limits

Before replacing a presentation copy, keep its current database and files. Restore into a new database. Apply the runtime grants. Point a separate local server at the restored database and restored file folder. Log in and check patient search, clinical revisions, file retrieval, and booking conflicts. Switch the main local copy only after these checks pass.

Never restore into the live EHR database as a test. Cloud recovery requires a new empty database, operator access, the private key, and a controlled cutover. The automated restore script intentionally supplies no live overwrite command.

Database availability and file storage can fail separately. A failed backup is recorded as failed. A missing file stops a complete backup. The app does not report a successful clinical save from an unconfirmed server response. The restore result is test evidence, not a guarantee of recovery time for a larger real database.
