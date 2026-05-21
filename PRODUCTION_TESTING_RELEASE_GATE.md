# Backend Production Testing Release Gate

Use this file as the final backend testing checklist before connecting the frontend or deploying to production.

## Release gate rule

Do not release the backend if any **Must Pass** item below fails.

Use this order:

1. Fix all `500` errors.
2. Fix all auth/RBAC failures.
3. Fix all salary/payroll calculation mismatches.
4. Fix all payroll lock/cancel/recalculate issues.
5. Fix all security validation failures.
6. Run stress test only after the above are stable.

---

## 1. Must Pass: API health and smoke test

Command:

```bash
BASE_URL=http://localhost:5000 \
USER_PHONE=your_user_phone \
USER_PASSWORD=your_user_password \
ADMIN_PHONE=your_admin_phone \
ADMIN_PASSWORD=your_admin_password \
SUPER_ADMIN_PHONE=your_super_admin_phone \
SUPER_ADMIN_PASSWORD=your_super_admin_password \
npm run test:smoke
```

Pass criteria:

- Backend health route responds.
- Login works for required roles.
- Protected APIs block requests without token.
- No important API returns `500`.
- USER is blocked from admin-only routes.

Fail criteria:

- Any API crashes with `500`.
- Any protected route allows access without token.
- USER can access admin/super-admin APIs.

---

## 2. Must Pass: Auth and RBAC test

Command:

```bash
BASE_URL=http://localhost:5000 \
USER_PHONE=your_user_phone \
USER_PASSWORD=your_user_password \
ADMIN_PHONE=your_admin_phone \
ADMIN_PASSWORD=your_admin_password \
SUPER_ADMIN_PHONE=your_super_admin_phone \
SUPER_ADMIN_PASSWORD=your_super_admin_password \
npm run test:auth-rbac
```

Pass criteria:

- Invalid login is rejected.
- Missing login body is rejected.
- Invalid token is rejected.
- USER cannot access admin-only APIs.
- ADMIN cannot access SUPER_ADMIN-only APIs.
- SUPER_ADMIN can access privileged APIs.

---

## 3. Must Pass: Employee and salary history flow

Command:

```bash
BASE_URL=http://localhost:5000 \
ADMIN_PHONE=your_admin_phone \
ADMIN_PASSWORD=your_admin_password \
SUPER_ADMIN_PHONE=your_super_admin_phone \
SUPER_ADMIN_PASSWORD=your_super_admin_password \
npm run test:employee-salary
```

Pass criteria:

- Test weekly employee can be created.
- Test monthly employee can be created.
- Duplicate phone is rejected.
- Invalid salary type is rejected.
- Salary history can be created.
- Duplicate effective date is rejected.
- Invalid salary amount is rejected.
- Employee list pagination works.

Save these IDs from output:

```text
WEEKLY_EMPLOYEE_ID=...
MONTHLY_EMPLOYEE_ID=...
```

---

## 4. Must Pass: Attendance and salary calculation

Command:

```bash
BASE_URL=http://localhost:5000 \
ADMIN_PHONE=your_admin_phone \
ADMIN_PASSWORD=your_admin_password \
SUPER_ADMIN_PHONE=your_super_admin_phone \
SUPER_ADMIN_PASSWORD=your_super_admin_password \
WEEKLY_EMPLOYEE_ID=your_weekly_employee_id \
MONTHLY_EMPLOYEE_ID=your_monthly_employee_id \
npm run test:attendance-salary
```

Pass criteria:

- Cross-month weekly attendance works.
- Duplicate attendance is rejected.
- Attendance range returns records.
- Weekly salary preview works.
- Weekly salary preview treats April 27-30 + May 1-2 as one cycle.
- Missing attendance blocks or reports missing dates clearly.

Critical manual check:

For weekly employee period `2026-04-27` to `2026-05-02`, confirm:

- `salaryType = WEEKLY`
- present days count is correct
- gross salary is correct
- final salary is correct
- missing attendance is empty when all six days are present

---

## 5. Must Pass: Advance and payroll generation

Command:

```bash
BASE_URL=http://localhost:5000 \
ADMIN_PHONE=your_admin_phone \
ADMIN_PASSWORD=your_admin_password \
SUPER_ADMIN_PHONE=your_super_admin_phone \
SUPER_ADMIN_PASSWORD=your_super_admin_password \
WEEKLY_EMPLOYEE_ID=your_weekly_employee_id \
WEEKLY_PERIOD_START=2026-04-27 \
WEEKLY_PERIOD_END=2026-05-02 \
WEEKLY_ADVANCE_AMOUNT=1500 \
npm run test:advance-payroll
```

Pass criteria:

- Advance creation works or returns expected business-rule warning.
- Weekly cross-month payroll generation works.
- Payroll includes correct `salaryType`.
- Payroll includes correct `periodStart` and `periodEnd`.
- Advance deduction is correct.
- Payroll lock blocks attendance update after payroll generation.
- ADMIN cannot recalculate/cancel if SUPER_ADMIN-only.
- SUPER_ADMIN can recalculate/cancel if available.

Save payroll ID if printed:

```text
WEEKLY_PAYROLL_ID=...
```

---

## 6. Should Pass: Attendance request workflow

Command:

```bash
BASE_URL=http://localhost:5000 \
USER_PHONE=your_user_phone \
USER_PASSWORD=your_user_password \
ADMIN_PHONE=your_admin_phone \
ADMIN_PASSWORD=your_admin_password \
SUPER_ADMIN_PHONE=your_super_admin_phone \
SUPER_ADMIN_PASSWORD=your_super_admin_password \
npm run test:attendance-request
```

Pass criteria:

- USER can create valid attendance request.
- Duplicate pending request is rejected.
- USER can list own requests.
- Counts and grouped statuses work.
- USER cannot approve/reject requests.
- ADMIN/SUPER_ADMIN can list pending requests based on your permission rules.
- SUPER_ADMIN can approve/reject based on your permission rules.

Warnings are acceptable if the chosen dates are locked, already used, before joining date, or already have attendance.

---

## 7. Should Pass: Payslip, ledger, reports, audit logs

Command:

```bash
BASE_URL=http://localhost:5000 \
USER_PHONE=your_user_phone \
USER_PASSWORD=your_user_password \
ADMIN_PHONE=your_admin_phone \
ADMIN_PASSWORD=your_admin_password \
SUPER_ADMIN_PHONE=your_super_admin_phone \
SUPER_ADMIN_PASSWORD=your_super_admin_password \
WEEKLY_EMPLOYEE_ID=your_weekly_employee_id \
WEEKLY_PAYROLL_ID=your_weekly_payroll_id \
REPORT_FROM_DATE=2026-04-27 \
REPORT_TO_DATE=2026-05-02 \
npm run test:payslip-ledger-reports
```

Pass criteria:

- Payslip list works.
- Payroll payslip fetch works if payslip is generated.
- Ledger list works.
- Payroll ledger fetch works if ledger is generated.
- Reports work with employee/date filters.
- USER is blocked from admin-only reports/audit logs.
- Audit log list works for privileged role.

---

## 8. Should Pass: Settings and overtime

Command:

```bash
BASE_URL=http://localhost:5000 \
USER_PHONE=your_user_phone \
USER_PASSWORD=your_user_password \
ADMIN_PHONE=your_admin_phone \
ADMIN_PASSWORD=your_admin_password \
SUPER_ADMIN_PHONE=your_super_admin_phone \
SUPER_ADMIN_PASSWORD=your_super_admin_password \
WEEKLY_EMPLOYEE_ID=your_weekly_employee_id \
OT_DATE=2026-05-18 \
npm run test:settings-overtime
```

Pass criteria:

- USER cannot manage work-hour settings.
- Work-hour setting supports effective dates.
- April and May settings are stored independently.
- Invalid work-hour input is rejected.
- Attendance can store OT fields if implemented.
- Salary preview exposes OT values if implemented.

Critical manual check:

April calculations should use April work-hour settings. May calculations should use May work-hour settings. New settings must not retroactively change old payrolls.

---

## 9. Should Pass: Scheduler safe check

Safe command:

```bash
BASE_URL=http://localhost:5000 \
USER_PHONE=your_user_phone \
USER_PASSWORD=your_user_password \
ADMIN_PHONE=your_admin_phone \
ADMIN_PASSWORD=your_admin_password \
SUPER_ADMIN_PHONE=your_super_admin_phone \
SUPER_ADMIN_PASSWORD=your_super_admin_password \
npm run test:scheduler
```

Pass criteria:

- USER is blocked from scheduler APIs.
- ADMIN is blocked if scheduler is SUPER_ADMIN-only.
- SUPER_ADMIN can list scheduler runs.
- Manual scheduler trigger is not run unless `RUN_SCHEDULER=true` is explicitly passed.

Only run this when ready:

```bash
RUN_SCHEDULER=true npm run test:scheduler
```

---

## 10. Must Pass: Security and negative validation

Command:

```bash
BASE_URL=http://localhost:5000 \
USER_PHONE=your_user_phone \
USER_PASSWORD=your_user_password \
ADMIN_PHONE=your_admin_phone \
ADMIN_PASSWORD=your_admin_password \
SUPER_ADMIN_PHONE=your_super_admin_phone \
SUPER_ADMIN_PASSWORD=your_super_admin_password \
npm run test:security-validation
```

Pass criteria:

- Bad login is rejected.
- Missing/invalid token is rejected.
- USER is blocked from admin-only APIs.
- ADMIN is blocked from SUPER_ADMIN-only APIs.
- Invalid payloads return `400` or `422` where the role is allowed.
- Unknown routes return `404`.
- Invalid search/pagination inputs do not crash the server.

Important:

Validation tests must use the correct allowed role. Otherwise the backend may correctly return `403` before it reaches validation.

---

## 11. Full safe test command

After individual scripts are stable, run:

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

Pass criteria:

- No unexpected `500` errors.
- No unexpected RBAC failures.
- No critical salary/payroll mismatch.
- No security failure.

---

## 12. Stress testing gate

Only run stress testing after all must-pass checks are stable.

Install k6:

```bash
brew install k6
```

Run:

```bash
BASE_URL=http://localhost:5000 \
SUPER_ADMIN_TOKEN=your_super_admin_jwt_token \
npm run stress:payroll
```

Initial pass criteria:

- No `500` responses.
- 95% requests complete under 1 second.
- DB CPU and memory remain stable.
- Backend process does not crash.

Start with small load:

```text
10 users for 30 seconds
```

Then increase slowly:

```text
50 users
100 users
500 users only after optimization
```

---

## Final release decision

Backend is ready for frontend testing when:

- Smoke test passes.
- Auth/RBAC test passes.
- Security validation test passes.
- Employee + salary history flow passes.
- Attendance + salary calculation flow passes.
- Advance + payroll flow passes for at least one weekly and one monthly employee.
- Cross-month weekly payroll is verified manually.
- Payroll lock is verified.
- Payslip and ledger are verified.
- Audit logs are verified for sensitive actions.
- Scheduler safe check passes.

Backend is ready for production only after:

- All above pass.
- Stress test is acceptable.
- Real production `.env` is reviewed.
- CORS is restricted.
- JWT secret is strong.
- Database backup plan exists.
- Logs do not expose passwords/tokens.
- Admin/Super Admin accounts are secured.
