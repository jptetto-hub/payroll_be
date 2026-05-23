# Backend Stress Testing Guide

Use stress testing only after smoke, auth/RBAC, security validation, and core payroll flow tests are stable.

## Load-Test Seed Data

For Supabase Free Tier, start small:

```bash
SEED_EMPLOYEE_COUNT=1000 SEED_ATTENDANCE_DAYS=31 npm run seed:load
SEED_EMPLOYEE_COUNT=5000 SEED_ATTENDANCE_DAYS=31 npm run seed:load
```

For a stronger local or paid Postgres later:

```bash
SEED_EMPLOYEE_COUNT=100000 SEED_ATTENDANCE_DAYS=31 SEED_BATCH_SIZE=1000 npm run seed:load
```

Default seeded admin login:

```txt
phone: 9999999999
password: Password@123
```

Do not seed 1 lakh or 10 lakh employees into Supabase Free Tier.

## Focused k6 Tests

Use focused tests instead of one giant mixed test:

```bash
BASE_URL=http://localhost:5000 VUS=10 DURATION=1m npm run k6:login
BASE_URL=http://localhost:5000 VUS=10 DURATION=1m npm run k6:employee-list
BASE_URL=http://localhost:5000 VUS=10 DURATION=1m npm run k6:employee-options
EMPLOYEE_ID=employee_id BASE_URL=http://localhost:5000 VUS=10 DURATION=1m npm run k6:attendance-range
BASE_URL=http://localhost:5000 VUS=1 DURATION=30s npm run k6:scheduler-start
JOB_ID=your_scheduler_run_id BASE_URL=http://localhost:5000 VUS=10 DURATION=1m npm run k6:scheduler-status
EMPLOYEE_ID=employee_id BASE_URL=http://localhost:5000 VUS=1 ITERATIONS=1 npm run k6:payroll-generate
BASE_URL=http://localhost:5000 VUS=10 DURATION=1m npm run k6:payslip-list
BASE_URL=http://localhost:5000 REPORT_FROM=2026-05-01 REPORT_TO=2026-05-31 VUS=10 DURATION=1m npm run k6:report-payroll-summary
BASE_URL=http://localhost:5000 REPORT_FROM=2026-05-01 REPORT_TO=2026-05-31 VUS=10 DURATION=1m npm run k6:report-ledger-summary
```

Thresholds by API type:

- Fast list APIs: p95 below 1000ms.
- Job start APIs: p95 below 500ms.
- Job status APIs: p95 below 500ms.
- Payroll single generate: p95 below 3000ms.
- Reports: p95 below 2000ms.

Do not measure full scheduler processing as one HTTP response. Track worker logs, processed employees per minute, success/failure counts, and slow query logs.

## Safe first run

This checks read/list APIs only. It does not generate payroll or run scheduler.

```bash
BASE_URL=http://localhost:5000 \
ADMIN_TOKEN=your_admin_or_super_admin_jwt \
USER_TOKEN=your_user_jwt_optional \
EMPLOYEE_ID=your_weekly_employee_id_optional \
PAYROLL_ID=your_weekly_payroll_id_optional \
npm run stress:read-apis
```

## Increase load slowly

```bash
STRESS_VUS=25 STRESS_DURATION=1m npm run stress:read-apis
STRESS_VUS=50 STRESS_DURATION=2m npm run stress:read-apis
STRESS_VUS=100 STRESS_DURATION=3m npm run stress:read-apis
```

## Pass criteria

- No 500 errors.
- Failed request rate below 1%.
- p95 response time below 1000ms for normal list/read APIs.
- Database CPU and memory should remain stable.

## Slow query and API timing logs

Enable these only while debugging a stress run:

```bash
ENABLE_PRISMA_QUERY_LOG=true \
ENABLE_PERFORMANCE_LOG=true \
SLOW_QUERY_MS=200 \
SLOW_API_MS=500 \
npm run dev
```

Watch backend logs for:

- `SLOW_API_REQUEST` to identify slow routes.
- `SLOW_PRISMA_QUERY` to identify slow DB queries.
- `PERFORMANCE_CHECKPOINT` to identify slow payroll/scheduler steps.

For normal production-like runs, keep Prisma query and performance checkpoint logs disabled.

## Supabase-safe concurrency

For Supabase Free Tier, keep conservative limits:

```bash
SCHEDULER_BATCH_SIZE=50
SCHEDULER_MAX_RESULT_ITEMS=500
PAYROLL_WORKER_CONCURRENCY=1
PAYROLL_WORKER_RATE_LIMIT_MAX=1
PAYROLL_WORKER_RATE_LIMIT_DURATION=1000
PAYSLIP_WORKER_CONCURRENCY=1
PAYSLIP_WORKER_RATE_LIMIT_MAX=2
PAYSLIP_WORKER_RATE_LIMIT_DURATION=1000
REPORT_TIMEOUT_MS=10000
```

Use a bounded Prisma pool in `DATABASE_URL`:

```bash
?schema=public&connection_limit=5&pool_timeout=30
```

When moving to a stronger database, see `.env.example` for commented higher-limit values.

## Read Replica Split

Step 18 adds a separate `readPrisma` client for read-heavy APIs. Locally and on Supabase Free Tier it falls back to the primary database, so no extra setup is required:

```bash
READ_DATABASE_URL=
```

When you move to a database with a read replica, set:

```bash
READ_DATABASE_URL="postgresql://USER:PASSWORD@READ_REPLICA_HOST:5432/postgres?schema=public&connection_limit=20&pool_timeout=30"
```

Write-heavy flows still use the primary database: payroll generation, scheduler processing, attendance locking, advance settlement, ledger creation, payslip creation, maintenance cleanup, and partition management. Read-heavy flows use the read client where safe: dashboards, reports, employee list/options, attendance lists, attendance request lists, payroll lists, payslip lists, ledger lists, and audit log browsing.

Read replicas can lag by a few seconds. Do not use the read client for duplicate payroll checks, cancellations, recalculation, approvals, auth, or any flow that needs immediate consistency.

## Payroll idempotency

Step 14 adds `Payroll.activePayrollKey` to block duplicate active payrolls for the same employee and period.

Before backfilling old rows, check for existing duplicates:

```sql
SELECT
  "employeeId",
  "periodStart",
  "periodEnd",
  COUNT(*)
FROM "Payroll"
WHERE status IN ('GENERATED', 'PAID')
GROUP BY "employeeId", "periodStart", "periodEnd"
HAVING COUNT(*) > 1;
```

If no duplicates exist, backfill old active payroll keys:

```sql
UPDATE "Payroll"
SET "activePayrollKey" =
  "employeeId" || '_' ||
  TO_CHAR("periodStart", 'YYYY-MM-DD') || '_' ||
  TO_CHAR("periodEnd", 'YYYY-MM-DD')
WHERE status IN ('GENERATED', 'PAID')
  AND "activePayrollKey" IS NULL;
```

## Maintenance Retention

Step 16 adds manual cleanup for safe high-volume tables:

```bash
curl -X POST "$BASE_URL/api/maintenance/cleanup" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
```

Supabase Free Tier testing defaults:

```bash
AUDIT_LOG_RETENTION_DAYS=90
SCHEDULER_ITEM_RETENTION_DAYS=30
EXPORT_FILE_RETENTION_DAYS=3
FAILED_JOB_RETENTION_DAYS=15
```

Production-style defaults:

```bash
AUDIT_LOG_RETENTION_DAYS=365
SCHEDULER_ITEM_RETENTION_DAYS=90
EXPORT_FILE_RETENTION_DAYS=7
FAILED_JOB_RETENTION_DAYS=30
```

Do not automatically delete financial tables such as `Payroll`, `Payslip`, `LedgerEntry`, `AdvancePayment`, `SalaryHistory`, or business-critical `Attendance` without business approval.

## Partitioning Strategy

Step 17 does not convert current tables to partitions. On Supabase Free Tier, keep using indexes, pagination, batching, archival cleanup, and required date filters.

Partitioning should be considered later:

- `Attendance` above 50 lakh rows.
- `AuditLog` above 10 lakh rows.
- `LedgerEntry` above 10 lakh rows.
- `Payroll` above 10 lakh rows.

See `docs/PARTITIONING_STRATEGY.md`.

Once parent tables are partitioned in a dedicated migration, prepare next-month child partitions with:

```bash
curl -X POST "$BASE_URL/api/maintenance/partitions/next-month" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"
```

## Dashboard summary cache

Step 10 changed `GET /api/dashboard/summary` for admin/global dashboard usage to read from `DashboardSummary`.

Warm or refresh the cache manually:

```bash
curl -X POST "$BASE_URL/api/dashboard/summary/refresh" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

For a bounded period:

```bash
curl -X POST "$BASE_URL/api/dashboard/summary/refresh" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"from":"2026-05-01","to":"2026-05-31"}'
```

## Raw SQL summary reports

Step 11 added database-level aggregation endpoints:

- `GET /api/reports/payroll-summary?from=2026-05-01&to=2026-05-31`
- `GET /api/reports/employee-payroll?from=2026-05-01&to=2026-05-31&limit=50`
- `GET /api/reports/ledger-summary?from=2026-05-01&to=2026-05-31`
- `GET /api/reports/attendance-summary?from=2026-05-01&to=2026-05-31`
- `GET /api/reports/advance-outstanding`

The read stress script calls the summary endpoints with `REPORT_FROM` and `REPORT_TO`:

```bash
REPORT_FROM=2026-05-01 REPORT_TO=2026-05-31 npm run stress:read-apis
```

## Do not stress these first

Avoid repeatedly stress testing payroll generation, payroll recalculation, cancellation, or scheduler run endpoints. Those endpoints mutate data and can create duplicate or heavy long-running operations if the backend does not protect them.

## Manual scheduler start test

Step 1 changed the manual scheduler endpoint to async behavior:

1. `POST /api/scheduler/run` creates a scheduler run and queues a background job.
2. The API returns `202 Accepted` quickly with `jobId`.
3. The worker processes payroll in the background.
4. `GET /api/scheduler/runs/:jobId` returns progress.

Prerequisites:

```bash
docker run -p 6379:6379 redis
npm run dev
```

Run the scheduler contract test:

```bash
BASE_URL=http://localhost:5003 \
SUPER_ADMIN_PHONE=your_super_admin_phone \
SUPER_ADMIN_PASSWORD=your_super_admin_password \
RUN_SCHEDULER=true \
npm run test:scheduler
```

Expected result:

- Manual scheduler start returns `202`.
- Response has `jobId`.
- Status endpoint returns progress fields.
- The HTTP request should not wait for payroll generation to finish.

## Scheduler start stress test

This tests only the job-start API, not full payroll completion. Keep iterations low because every request creates a scheduler job.

```bash
BASE_URL=http://localhost:5003 \
SUPER_ADMIN_TOKEN=your_super_admin_jwt \
STRESS_VUS=1 \
STRESS_ITERATIONS=1 \
MAX_P95_MS=1000 \
npm run stress:scheduler-start
```

Increase slowly only after confirming Redis, worker logs, and scheduler run history look healthy:

```bash
STRESS_VUS=2 STRESS_ITERATIONS=2 npm run stress:scheduler-start
```

Pass criteria:

- `http_req_failed` below 1%.
- Scheduler start p95 below 1000ms.
- `POST /api/scheduler/run` returns `202`.
- `GET /api/scheduler/runs/:jobId` returns `200`.

## Recommended backend behavior

For long-running scheduler or payroll-all operations, prefer async job behavior:

1. POST endpoint returns quickly with `runId`.
2. Worker processes payroll in background.
3. GET status endpoint returns RUNNING / COMPLETED / FAILED.
4. UI polls status instead of waiting for one long HTTP request.
