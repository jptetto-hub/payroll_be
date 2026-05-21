# Backend Testing Guide

This backend uses simple script-based testing for practical API verification.

## Safe tests

Run these after starting the backend:

```bash
npm run test:smoke
npm run test:auth-rbac
npm run test:security-validation
```

## Full safe master runner

This runs all safe scripts in order and prevents accidental scheduler execution.

```bash
BASE_URL=http://localhost:5000 \
USER_PHONE=your_user_phone \
USER_PASSWORD=your_user_password \
ADMIN_PHONE=your_admin_phone \
ADMIN_PASSWORD=your_admin_password \
SUPER_ADMIN_PHONE=your_super_admin_phone \
SUPER_ADMIN_PASSWORD=your_super_admin_password \
WEEKLY_EMPLOYEE_ID=your_weekly_employee_id \
MONTHLY_EMPLOYEE_ID=your_monthly_employee_id \
WEEKLY_PAYROLL_ID=your_weekly_payroll_id \
npm run test:all-safe
```

## Notes

- Smoke, auth/RBAC, and security validation are required before production.
- Employee, attendance, payroll, reports, OT, and scheduler checks are business-flow tests.
- Some flow tests may create clearly marked test records.
- Stress testing is not part of the master runner.
- To intentionally trigger the scheduler, run `npm run test:scheduler` separately with `RUN_SCHEDULER=true`.

## Stress test

Install k6 first:

```bash
brew install k6
```

Run:

```bash
BASE_URL=http://localhost:5000 \
SUPER_ADMIN_TOKEN=your_super_admin_jwt_token \
npm run stress:payroll
```
