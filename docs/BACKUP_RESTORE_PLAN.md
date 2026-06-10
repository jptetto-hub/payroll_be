# Backup, Restore, And Disaster Recovery

Payroll data is financial data. Protect these tables carefully:

- Employee
- Attendance
- SalaryHistory
- Payroll
- Payslip
- AdvancePayment
- LedgerEntry
- AuditLog
- Settings

## Backup

Create a database backup:

```bash
npm run db:backup
```

The script writes a compressed custom-format dump of the application-owned
`public` schema to `backups/`. Supabase-managed schemas and event triggers are
excluded so restore does not attempt to overwrite provider-owned objects.
It validates the dump with `pg_restore --list` and writes a SHA-256 checksum.

Set `DATABASE_ADMIN_URL` to a direct or session-pooler PostgreSQL URL for
administrative operations. The script falls back to `DIRECT_URL`, then
`DATABASE_URL`, when it is not configured.

Install PostgreSQL client tools with a major version equal to or newer than the
database server. On macOS with a PostgreSQL 17 server:

```bash
brew install postgresql@17
```

Set `PG_BIN_DIR` when the correct client tools are installed outside the normal
shell path:

```bash
PG_BIN_DIR=/path/to/postgresql/bin npm run db:backup
```

## Restore

Restore a backup into the database configured by `DATABASE_URL`:

```bash
CONFIRM_DB_RESTORE=RESTORE_DATABASE \
npm run db:restore -- backups/payroll_backup_YYYYMMDD_HHMMSS.dump
```

Stop API and worker services before restoring production data.
The restore script validates the selected dump and creates a safety backup of
the current database before overwriting it.

For an approved production restore, also set:

```bash
ALLOW_PRODUCTION_DB_RESTORE=true \
CONFIRM_DB_RESTORE=RESTORE_DATABASE \
npm run db:restore -- backups/payroll_backup_YYYYMMDD_HHMMSS.dump
```

Use `SKIP_PRE_RESTORE_BACKUP=true` only when the target database is empty or a
safety backup has already been verified.

## Before Migrations

Before production migrations:

```bash
npm run db:backup
npx prisma migrate deploy
npx prisma generate
```

## Retention

Recommended production backup retention:

- Daily backups: keep 6 days.
- Weekly backups: keep 4 weeks.
- Monthly backups: keep 2 months.
- Yearly backups: keep 7 years.

Store backups outside the application server, such as Cloudflare R2, S3, DigitalOcean Spaces, or a managed database backup system.

## Cloudflare R2 Daily Backup

Create an R2 bucket named `payroll-db-backups`. In Cloudflare, create an R2 API
token with Object Read & Write access for that bucket, then configure:

```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=payroll-db-backups
R2_REGION=auto
R2_WEEKLY_BACKUP_DAY=7
R2_MONTHLY_BACKUP_DAY=01
R2_AUTO_BACKUP_ENABLED=true
R2_BACKUP_CRON="0 2 * * *"
APP_TIMEZONE=UTC
# Optional override. When blank, R2 backup cron uses APP_TIMEZONE.
R2_BACKUP_CRON_TIMEZONE=
R2_REMOTE_DELETE_ENABLED=false
R2_DAILY_RETENTION_DAYS=6
R2_WEEKLY_RETENTION_WEEKS=4
R2_MONTHLY_RETENTION_MONTHS=2
```

The Cloudflare account email is not used by the script. Keep the R2 secret key
only in the deployment environment or an external secrets manager.

Install the AWS CLI because Cloudflare R2 exposes an S3-compatible API:

```bash
brew install awscli
```

Run an offsite backup manually:

```bash
npm run db:backup:r2
```

The command creates a compressed SQL dump of the application-owned `public`
schema and uploads:

```text
payroll-db-backups/
  daily/
    payroll_YYYY-MM-DD_HH-mm-ss.sql.gz
  weekly/
    payroll_week_YYYY-WW.sql.gz
  monthly/
    payroll_YYYY-MM.sql.gz
```

Before generating the full dump, the script uploads and removes a tiny
`.permission-check/` object. This fails quickly when the R2 token is read-only
or scoped to the wrong bucket.

Every run uploads a daily backup. A Sunday run also writes the weekly snapshot.
A run on the first day of a month also writes the monthly snapshot. Weekly and
monthly names are stable, so rerunning the scheduled job replaces only that
period's snapshot.

Restore a selected R2 SQL backup:

```bash
CONFIRM_DB_RESTORE=RESTORE_DATABASE \
npm run db:restore:r2 -- daily/payroll_YYYY-MM-DD_HH-mm-ss.sql.gz
```

Stop the API and worker first. The restore command downloads and validates the
compressed SQL file, creates a local safety backup, then restores only the
application-owned tables in the `public` schema. It preserves the Supabase
managed `public` schema itself and performs the restore in one transaction, so
a failed restore rolls back instead of leaving a partially restored database.
Add `ALLOW_PRODUCTION_DB_RESTORE=true` for an approved production restore. Use
`SKIP_PRE_RESTORE_BACKUP=true` only after a database clear when an earlier
backup has already been verified.

The worker schedules the command every day at 2:00 AM when:

```env
R2_AUTO_BACKUP_ENABLED=true
R2_BACKUP_CRON="0 2 * * *"
APP_TIMEZONE=UTC
R2_BACKUP_CRON_TIMEZONE=
R2_BACKUP_RUN_ON_STARTUP=true
```

Cron jobs run from the worker process, not the API process. In local
development, keep this command running:

```bash
cd backend
npm run dev:worker
```

In production, keep the worker process alive with PM2/systemd/Docker:

```bash
npm run worker
```

When `R2_BACKUP_RUN_ON_STARTUP=true`, worker startup checks R2 for today's
`daily/` backup. If it is missing, the worker creates a scheduled backup
immediately. This protects local machines and production restarts from missing
the exact 2:00 AM cron window.

For deployments where the worker is not continuously running, use an external
VPS cron instead. Do not enable both schedulers:

```cron
0 2 * * * cd /ABSOLUTE_PATH/payroll-attendance-app/backend && /usr/bin/env bash -lc 'npm run db:backup:r2' >> logs/db-backup-r2.log 2>&1
```

Recommended R2 lifecycle retention:

- `daily/`: delete objects after 6 days.
- `weekly/`: delete objects after 28 days.
- `monthly/`: delete objects after 2 months.

Configure these lifecycle rules in the Cloudflare R2 dashboard. The application
also supports configurable retention cleanup through the SUPER_ADMIN Backups
page. Keep `R2_REMOTE_DELETE_ENABLED=false` until you have reviewed the cleanup
preview. Set it to `true` to allow confirmed UI cleanup and automatic
post-backup cleanup.

Cloudflare R2 automatically encrypts stored objects at rest and uses TLS for
transfers. Application-managed encryption before upload can be added later if
you need to manage your own encryption keys.

## Background Service Restart

Database restore, database clear, and organization timezone changes publish a
restart-required notification in Redis. Routine backup creation, retention
cleanup, and maintenance cleanup do not require service restarts. The
SUPER_ADMIN navbar does not poll during normal browsing. Restore, database
clear, and timezone changes activate a temporary status watch. It checks every
15 seconds until the notification is found and while a restart is actively
running.

Connect the restart API to your production process manager:

```env
APP_RESTART_COMMAND="pm2 restart payroll-api payroll-worker && pm2 restart payroll-frontend"
APP_RESTART_TIMEOUT_MS=120000
```

Use the commands appropriate for your PM2, systemd, Docker, or deployment-hook
setup. Do not configure `npm run dev` commands here: an API process cannot
reliably restart itself by launching duplicate development servers. For a
static frontend deployment, use your hosting provider's deployment hook or
omit frontend restart from the command.

## Encryption

Payroll backups should be encrypted before offsite storage:

```bash
gpg -c backups/payroll_backup_YYYYMMDD_HHMMSS.dump
```

Decrypt for restore:

```bash
gpg -d payroll_backup_YYYYMMDD_HHMMSS.dump.gpg > payroll_backup.dump
```

## Disaster Recovery

1. Stop API and worker services.
2. Identify the latest valid backup.
3. Restore backup to a new database.
4. Update `DATABASE_URL`.
5. Run `npx prisma migrate deploy`.
6. Run `npx prisma generate`.
7. Start API service.
8. Start worker service.
9. Verify health APIs.
10. Verify login, latest payroll data, and reports.
