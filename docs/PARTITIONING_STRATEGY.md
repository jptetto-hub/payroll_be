# Database Partitioning Strategy

Partitioning is a future scaling step for very large deployments. Do not convert the current Supabase Free database immediately.

## When To Partition

- `Attendance` above 50 lakh rows.
- `AuditLog` above 10 lakh rows, or archive aggressively first.
- `LedgerEntry` above 10 lakh rows.
- `Payroll` above 10 lakh rows.

For 10 lakh employees, attendance can grow by crores of rows per month, so `Attendance` becomes the first mandatory partitioning candidate.

## Recommended Tables

Use monthly range partitions:

- `Attendance` by `date`
- `LedgerEntry` by `date`
- `AuditLog` by `createdAt`
- `Payroll` by `periodStart` later, preferably monthly at very high scale

## Query Rule

Partition pruning works only when queries include the partition key:

- Attendance queries must include `date` range.
- Ledger queries must include `date` range.
- Audit log queries must include `createdAt` range.
- Payroll/report queries should include `periodStart` / `periodEnd` range.

This is why report APIs require `from` and `to`.

## Maintenance Helper

The API endpoint below only creates child partitions if the base table is already partitioned:

```bash
curl -X POST "$BASE_URL/api/maintenance/partitions/next-month" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
```

If the base table is not partitioned yet, it returns a safe message and does nothing.

## Parent Table Conversion

Converting an existing active table to a partitioned parent table is a dedicated migration project:

1. Create a new partitioned table with the same columns.
2. Create required monthly partitions.
3. Backfill data in batches.
4. Recreate constraints and indexes.
5. Swap table names during maintenance time.
6. Verify Prisma reads/writes.

Do this only on a paid/dedicated database with backups.
