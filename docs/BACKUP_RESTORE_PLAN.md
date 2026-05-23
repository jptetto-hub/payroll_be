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

The script writes a compressed custom-format dump to `backups/`.

## Restore

Restore a backup into the database configured by `DATABASE_URL`:

```bash
npm run db:restore -- backups/payroll_backup_YYYYMMDD_HHMMSS.dump
```

Stop API and worker services before restoring production data.

## Before Migrations

Before production migrations:

```bash
npm run db:backup
npx prisma migrate deploy
npx prisma generate
```

## Retention

Recommended retention:

- Daily backups: keep 14 days.
- Weekly backups: keep 8 weeks.
- Monthly backups: keep 12 months.
- Yearly backups: keep 7 years.

Store backups outside the application server, such as Cloudflare R2, S3, DigitalOcean Spaces, or a managed database backup system.

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
