# Backend Stress Testing Guide

Use stress testing only after smoke, auth/RBAC, security validation, and core payroll flow tests are stable.

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
- Failed request rate below 5%.
- p95 response time below 1500ms for normal list/read APIs.
- Database CPU and memory should remain stable.

## Do not stress these first

Avoid repeatedly stress testing payroll generation, payroll recalculation, cancellation, or scheduler run endpoints. Those endpoints mutate data and can create duplicate or heavy long-running operations if the backend does not protect them.

## Recommended next backend improvement

For long-running scheduler or payroll-all operations, prefer async job behavior:

1. POST endpoint returns quickly with `runId`.
2. Worker processes payroll in background.
3. GET status endpoint returns RUNNING / COMPLETED / FAILED.
4. UI polls status instead of waiting for one long HTTP request.
