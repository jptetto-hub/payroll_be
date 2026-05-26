# Final Performance Checklist And Tuning Order

## Completion Checklist

- [x] Manual scheduler API returns `202 Accepted` quickly.
- [x] Payroll scheduler runs in BullMQ background worker.
- [x] Redis is reused for queues and cache.
- [x] Scheduler status API works.
- [x] DB indexes added.
- [x] Scheduler processes employees in batches.
- [x] Salary/latest payroll/duplicate payroll checks are preloaded per batch.
- [x] `PayrollService.generate()` optimized.
- [x] Payslip generation moved to background job.
- [x] List APIs have pagination.
- [x] Reports require `from` and `to` date range.
- [x] Dashboard uses summary/cache table.
- [x] Slow API logging added.
- [x] Slow Prisma query logging added.
- [x] Worker concurrency controlled.
- [x] Duplicate payroll protection added.
- [x] Large responses are avoided and logged.
- [x] API and worker are separate production services.

## Supabase Free Tier Settings

Use conservative values:

```bash
SCHEDULER_BATCH_SIZE=50
SCHEDULER_MAX_RESULT_ITEMS=500
SCHEDULER_EMPLOYEE_CONCURRENCY=1
SCHEDULER_STORE_ITEM_DETAILS=true

PAYROLL_WORKER_CONCURRENCY=1
PAYROLL_WORKER_RATE_LIMIT_MAX=1
PAYROLL_WORKER_RATE_LIMIT_DURATION=1000

PAYSLIP_WORKER_CONCURRENCY=1
PAYSLIP_WORKER_RATE_LIMIT_MAX=2
PAYSLIP_WORKER_RATE_LIMIT_DURATION=1000

ENABLE_PRISMA_QUERY_LOG=true
ENABLE_PERFORMANCE_LOG=true

SLOW_API_MS=500
SLOW_QUERY_MS=200
```

Keep `DATABASE_URL` bounded:

```bash
?schema=public&connection_limit=5&pool_timeout=30
```

For a dedicated production database, increase scheduler throughput gradually
after observing pool usage and transaction times:

```bash
SCHEDULER_BATCH_SIZE=500
SCHEDULER_EMPLOYEE_CONCURRENCY=5
# Raise to 10 only after successful load tests and adequate DB connections.
SCHEDULER_STORE_ITEM_DETAILS=false
```

For local/testing, `SCHEDULER_STORE_ITEM_DETAILS=true` lets the UI list
generated and already-handled employees for a run. For very large production
cycles, set it to `false`; counts remain visible and failed/actionable detail
rows are still stored without creating one tracking row per successful or
already-handled employee.

The scheduler queries only employees without a payroll record for the latest
completed cycle. Cancelled or recalculated cycle records are left for manual
payroll actions; failed attempts that wrote no payroll remain retryable.

## k6 Test Order

Run focused tests in this order:

```bash
BASE_URL=http://localhost:5000 VUS=10 DURATION=1m npm run k6:login
BASE_URL=http://localhost:5000 VUS=10 DURATION=1m npm run k6:employee-list
BASE_URL=http://localhost:5000 VUS=10 DURATION=1m npm run k6:employee-options
EMPLOYEE_ID=employee_id BASE_URL=http://localhost:5000 VUS=10 DURATION=1m npm run k6:attendance-range
EMPLOYEE_ID=employee_id BASE_URL=http://localhost:5000 VUS=1 ITERATIONS=1 npm run k6:payroll-generate
BASE_URL=http://localhost:5000 VUS=1 DURATION=30s npm run k6:scheduler-start
JOB_ID=scheduler_run_id BASE_URL=http://localhost:5000 VUS=10 DURATION=1m npm run k6:scheduler-status
BASE_URL=http://localhost:5000 VUS=10 DURATION=1m npm run k6:payslip-list
BASE_URL=http://localhost:5000 REPORT_FROM=2026-05-01 REPORT_TO=2026-05-31 VUS=10 DURATION=1m npm run k6:report-payroll-summary
BASE_URL=http://localhost:5000 REPORT_FROM=2026-05-01 REPORT_TO=2026-05-31 VUS=10 DURATION=1m npm run k6:report-ledger-summary
```

Do not test full scheduler generation as one HTTP response. Test only `POST /api/scheduler/run`.

## Thresholds

- Login API: p95 below 1000ms.
- List APIs: p95 below 1000ms.
- Dropdown APIs: p95 below 500ms.
- Scheduler start API: p95 below 500ms.
- Scheduler status API: p95 below 500ms.
- Payroll single generate: p95 below 3000ms.
- Report summary APIs: p95 below 2000ms.

## Failure Debug Order

When k6 thresholds fail, check:

1. Slow API logs.
2. Slow Prisma query logs.
3. Performance checkpoints.
4. BullMQ failed jobs.
5. Prisma pool timeouts.
6. Redis connection errors.
7. Large response warnings.

## Tuning Order

Do not increase concurrency first.

1. Fix slow queries.
2. Fix large response payloads.
3. Add missing indexes.
4. Reduce N+1 queries.
5. Move heavy work to background jobs.
6. Add caching.
7. Increase batch size.
8. Increase worker concurrency.
9. Upgrade database plan.
10. Add partitioning/read replica.
