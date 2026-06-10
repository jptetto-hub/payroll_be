# Security Hardening

Step 23 adds production-oriented API protections for payroll data.

## Active Protections

- Helmet security headers are enabled with `crossOriginResourcePolicy: false`.
- CORS uses `CORS_ORIGIN` allow-listing.
- General API rate limiting is enabled globally.
- Login has a stricter auth rate limiter.
- Sensitive mutations have stricter rate limits:
  - Payroll generate/cancel/recalculate
  - Scheduler run
  - Settings/work-hour mutations
  - Maintenance cleanup and partition preparation
- Zod validation assigns parsed request data back to `req.body`, `req.query`, and `req.params`.
- Audit log payloads redact sensitive fields such as passwords, tokens, refresh tokens, and authorization values.
- Production error responses hide stack traces and generic 500 details.
- Audit context captures IP address, user agent, device info, request ID, and session ID where available.

## Required Production Environment

```bash
NODE_ENV=production
CORS_ORIGIN="https://your-frontend-domain.com,https://admin.your-domain.com"
JWT_SECRET="very_long_random_secret_minimum_64_chars"
JWT_EXPIRES_IN="7d"
AUTH_COOKIE_NAME="payroll_session"
AUTH_IDLE_TIMEOUT_SECONDS=1800
BCRYPT_ROUNDS=12
GENERAL_RATE_LIMIT_MAX=1000
AUTH_RATE_LIMIT_MAX=20
SENSITIVE_ACTION_RATE_LIMIT_MAX=10
ENABLE_PRISMA_QUERY_LOG=false
ENABLE_PERFORMANCE_LOG=false
```

## Rules To Keep

- Do not pass raw `req.body` directly into Prisma writes.
- Do not cache payroll duplicate checks, auth checks, lock checks, or settlement state.
- USER routes must enforce ownership in service logic.
- SUPER_ADMIN-only routes should stay strict for payroll cancellation, recalculation, scheduler run, maintenance, and destructive attendance actions.
- File import routes should use file type checks, size limits, row validation, and background jobs before production use.
- Browser sessions use an HTTP-only cookie and a 30-minute idle timeout. Keep `NODE_ENV=production` so the cookie is marked secure behind HTTPS.
