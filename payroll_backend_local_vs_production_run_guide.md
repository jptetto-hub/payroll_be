# Payroll Backend Run Guide

This guide explains **what you need to run in local development** and **what you need to run in production** after implementing the backend performance optimization steps.

It is written for your payroll backend project with:

- Node.js + Express
- Prisma
- PostgreSQL / Supabase PostgreSQL
- Redis
- BullMQ workers
- Payroll scheduler
- Payslip background generation
- k6 stress testing

---

# 1. Local vs Production Overview

## Local development

In local development, you usually run everything manually on your machine:

```txt
Local machine
 ├─ Backend API          npm run dev
 ├─ Backend Worker       npm run dev:worker
 ├─ Redis                Docker Redis
 └─ PostgreSQL           Supabase / local PostgreSQL
```

You use local mode for:

```txt
Development
API testing in Postman
Debugging
k6 small stress tests
Checking payroll generation
Checking scheduler worker
Checking payslip worker
```

---

## Production

In production, the API and worker should be separated.

```txt
Production
 ├─ payroll-api service
 │   └─ npm run start
 │
 ├─ payroll-worker service
 │   └─ npm run worker
 │
 ├─ PostgreSQL database
 │
 └─ Redis service
```

Production should not run worker code inside the API server.

This is important because if the API scales to multiple instances and each instance starts workers or cron jobs, you can accidentally trigger duplicate scheduler jobs.

---

# 2. What Must Be Running

## Local required processes

You need 3 things running locally:

```txt
1. Redis
2. Backend API
3. Backend Worker
```

### Local terminal setup

Terminal 1:

```bash
docker start payroll-redis
```

Terminal 2:

```bash
npm run dev
```

Terminal 3:

```bash
npm run dev:worker
```

---

## Production required services

You need at least 4 services/resources:

```txt
1. payroll-api
2. payroll-worker
3. PostgreSQL database
4. Redis
```

Later for scale:

```txt
5. read replica database
6. report/export worker
7. object storage for payslips/exports
```

---

# 3. Local Setup Guide

## Step 1: Go to backend folder

```bash
cd backend
```

If your backend is inside another path, use that actual path.

Example:

```bash
cd /Users/jp/Downloads/Shobika_hydraulics/product/payroll-attendance-app/backend
```

---

## Step 2: Install packages

Run this once after extracting backend or after package changes:

```bash
npm install
```

This installs:

```txt
Express
Prisma
BullMQ
Redis client
Zod
Helmet
Compression
Rate limit
Logger packages
Testing packages
```

---

## Step 3: Configure `.env` for local

Create or update:

```txt
.env
```

Use this local-safe configuration:

```env
NODE_ENV=development

PORT=5000

DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?schema=public&connection_limit=5&pool_timeout=30"
READ_DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?schema=public&connection_limit=5&pool_timeout=30"

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
# REDIS_URL="redis://localhost:6379"

JWT_SECRET="local-development-strong-secret-change-this"
JWT_EXPIRES_IN="7d"

CORS_ORIGIN="http://localhost:5173,http://localhost:3000"

PAYSLIP_SYNC_GENERATION=false

SCHEDULER_BATCH_SIZE=50
SCHEDULER_MAX_RESULT_ITEMS=500

PAYROLL_WORKER_CONCURRENCY=1
PAYROLL_WORKER_RATE_LIMIT_MAX=1
PAYROLL_WORKER_RATE_LIMIT_DURATION=1000

PAYSLIP_WORKER_CONCURRENCY=1
PAYSLIP_WORKER_RATE_LIMIT_MAX=2
PAYSLIP_WORKER_RATE_LIMIT_DURATION=1000

ENABLE_REDIS_CACHE=true

ENABLE_PRISMA_QUERY_LOG=true
ENABLE_PERFORMANCE_LOG=true
LOG_API_REQUESTS=true

SLOW_API_MS=500
SLOW_QUERY_MS=200
RESPONSE_SIZE_WARN_BYTES=500000

AUDIT_LOG_RETENTION_DAYS=90
SCHEDULER_ITEM_RETENTION_DAYS=30
EXPORT_FILE_RETENTION_DAYS=3
FAILED_JOB_RETENTION_DAYS=15
```

---

## Important local note for Supabase Free Tier

For Supabase Free Tier, keep these values low:

```env
SCHEDULER_BATCH_SIZE=50
PAYROLL_WORKER_CONCURRENCY=1
PAYSLIP_WORKER_CONCURRENCY=1
```

Do not start with:

```env
SCHEDULER_BATCH_SIZE=1000
PAYROLL_WORKER_CONCURRENCY=10
PAYSLIP_WORKER_CONCURRENCY=10
```

That can overload Supabase Free Tier.

---

# 4. Redis Setup in Local

Redis is required for:

```txt
BullMQ scheduler queue
Payslip background queue
Redis cache
Queue health checks
```

## Start Redis using Docker

First time:

```bash
docker run --name payroll-redis -p 6379:6379 -d redis
```

Next time:

```bash
docker start payroll-redis
```

Check Redis is running:

```bash
docker ps
```

You should see:

```txt
redis
0.0.0.0:6379->6379/tcp
```

---

## If Redis container already exists but stopped

```bash
docker start payroll-redis
```

---

## If Redis container name conflict happens

Check containers:

```bash
docker ps -a
```

Remove old container if needed:

```bash
docker rm payroll-redis
```

Then create again:

```bash
docker run --name payroll-redis -p 6379:6379 -d redis
```

---

# 5. Prisma Setup in Local

## Generate Prisma client

```bash
npx prisma generate
```

## Run migrations locally

```bash
npx prisma migrate dev
```

This applies migrations such as:

```txt
SchedulerRun
SchedulerRunItem
PayslipStatus
DashboardSummary
AuditLogArchive
WorkerHeartbeat
activePayrollKey
activePayrollKey backfill
Indexes
```

---

## Open Prisma Studio

Optional:

```bash
npx prisma studio
```

Use this to inspect tables.

---

# 6. Build Backend

Run:

```bash
npm run build
```

Expected output:

```txt
dist/server.js
dist/worker.js
```

If these files are not created, your build is not correct.

Do not proceed to production until build passes.

---

# 7. Run Backend Locally

## Terminal 1: Redis

```bash
docker start payroll-redis
```

## Terminal 2: API server

```bash
npm run dev
```

Expected log:

```txt
Server started
```

The API handles:

```txt
Login
Employee APIs
Attendance APIs
Payroll trigger APIs
Scheduler trigger API
Health APIs
Reports
Dashboard summary
```

---

## Terminal 3: Worker

```bash
npm run dev:worker
```

Expected log:

```txt
Payroll workers started
Payroll cron started
```

The worker handles:

```txt
Manual scheduler background processing
Cron scheduler job
Payslip background generation
BullMQ queue processing
Worker heartbeat
```

---

# 8. Important Local Rule

Do not test scheduler without worker running.

If worker is not running:

```txt
POST /api/scheduler/run
```

may return:

```txt
202 Accepted
```

but actual payroll generation will not process.

Because the API only queues the job. The worker processes the job.

---

# 9. Health Checks in Local

After starting API and worker, test these.

## Basic health

```http
GET http://localhost:5000/api/health
```

Expected:

```json
{
  "success": true,
  "status": "OK"
}
```

---

## System health

```http
GET http://localhost:5000/api/health/system
```

Expected:

```txt
API OK
Database OK
Redis OK
```

---

## Queue health

```http
GET http://localhost:5000/api/health/queues
```

Expected:

```txt
payrollScheduler queue counts visible
payslipGeneration queue counts visible
```

This route may require SUPER_ADMIN login depending on your auth setup.

---

# 10. Local Login Test

Use Postman:

```http
POST http://localhost:5000/api/auth/login
Content-Type: application/json
```

Body example:

```json
{
  "phone": "9999999999",
  "password": "Password@123"
}
```

Expected:

```txt
200 OK
JWT token returned
```

Use this token in Postman Authorization header:

```http
Authorization: Bearer YOUR_TOKEN
```

---

# 11. Manual Scheduler Test in Local

## Start scheduler

```http
POST http://localhost:5000/api/scheduler/run
Authorization: Bearer YOUR_TOKEN
```

Expected:

```txt
202 Accepted
Scheduler job queued
runId returned
```

Example expected response:

```json
{
  "success": true,
  "message": "Payroll scheduler job queued",
  "data": {
    "runId": "..."
  }
}
```

---

## Check scheduler status

```http
GET http://localhost:5000/api/scheduler/runs/:runId
Authorization: Bearer YOUR_TOKEN
```

Expected statuses:

```txt
PENDING
RUNNING
COMPLETED
FAILED
```

---

## Check scheduler items

```http
GET http://localhost:5000/api/scheduler/runs/:runId/items?page=1&limit=50
Authorization: Bearer YOUR_TOKEN
```

Use this to see:

```txt
Generated employees
Skipped employees
Failed employees
Reasons
```

---

# 12. Payroll Generate Test in Local

Use Postman:

```http
POST http://localhost:5000/api/payroll/generate
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

Body:

```json
{
  "employeeId": "employee_uuid",
  "periodStart": "2026-05-01",
  "periodEnd": "2026-05-31"
}
```

Expected:

```txt
Payroll generated
Payslip queued, not generated synchronously
Ledger entries created
Attendance locked
Advance settlement handled
```

Because:

```env
PAYSLIP_SYNC_GENERATION=false
```

payslip should be created by worker.

Check worker terminal logs.

---

# 13. Local k6 Stress Testing

## Do not start with high load

For Supabase Free Tier, start small:

```txt
VUS=5
DURATION=30s
```

Then increase slowly.

---

## Employee list test

```bash
npm run k6:employee-list
```

Expected:

```txt
p95 < 1000ms
http_req_failed < 1%
```

---

## Scheduler start test

```bash
npm run k6:scheduler-start
```

Expected:

```txt
p95 < 500ms
status 202 or 409
```

409 is okay if scheduler is already running.

---

## Payroll generate test

```bash
npm run k6:payroll-generate
```

Expected:

```txt
p95 < 3000ms
```

Do not test many VUs against the same employee and same period because duplicate payroll protection will correctly block it.

---

# 14. What Logs to Watch in Local

Watch API and worker terminals for:

```txt
SLOW_API_REQUEST
SLOW_PRISMA_QUERY
PERFORMANCE_CHECKPOINT
LARGE_API_RESPONSE
BullMQ failed jobs
Redis connection errors
Prisma pool timeout
```

---

## If you see Prisma pool timeout

Reduce:

```env
SCHEDULER_BATCH_SIZE=25
PAYROLL_WORKER_CONCURRENCY=1
PAYSLIP_WORKER_CONCURRENCY=1
```

Also reduce k6 VUs.

---

## If you see slow attendance query

Check indexes:

```txt
Attendance employeeId + date
Attendance date + status
```

Also confirm APIs use date range.

---

## If scheduler is slow

That is okay in background.

Measure:

```txt
employees processed per minute
success count
skipped count
failed count
DB slow queries
```

Do not expect the full scheduler to finish in seconds for huge employee counts.

Only the scheduler start API should return quickly.

---

# 15. Production Deployment Guide

## Production service separation

Production should have separate API and worker services.

```txt
payroll-api
  command: npm run start

payroll-worker
  command: npm run worker
```

Do not run worker inside API server.

---

## Production build command

```bash
npm install
npm run build
npx prisma generate
```

---

## Production migration command

Use:

```bash
npx prisma migrate deploy
```

Do not use this in production:

```bash
npx prisma migrate dev
```

`migrate dev` is for local development.

---

## Production API start command

```bash
npm run start
```

This should run:

```txt
node dist/server.js
```

---

## Production worker start command

```bash
npm run worker
```

This should run:

```txt
node dist/worker.js
```

---

# 16. Production Environment Variables

Use production-safe env:

```env
NODE_ENV=production

PORT=5000

DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public&connection_limit=10&pool_timeout=30"
READ_DATABASE_URL="postgresql://USER:PASSWORD@READ_HOST:5432/DB?schema=public&connection_limit=10&pool_timeout=30"

REDIS_URL="redis://default:PASSWORD@HOST:6379"

JWT_SECRET="very-long-strong-random-secret-minimum-64-characters"
JWT_EXPIRES_IN="7d"

CORS_ORIGIN="https://your-frontend-domain.com"

PAYSLIP_SYNC_GENERATION=false

SCHEDULER_BATCH_SIZE=100
SCHEDULER_MAX_RESULT_ITEMS=500

PAYROLL_WORKER_CONCURRENCY=1
PAYROLL_WORKER_RATE_LIMIT_MAX=1
PAYROLL_WORKER_RATE_LIMIT_DURATION=1000

PAYSLIP_WORKER_CONCURRENCY=2
PAYSLIP_WORKER_RATE_LIMIT_MAX=3
PAYSLIP_WORKER_RATE_LIMIT_DURATION=1000

ENABLE_REDIS_CACHE=true

ENABLE_PRISMA_QUERY_LOG=false
ENABLE_PERFORMANCE_LOG=false
LOG_API_REQUESTS=false

SLOW_API_MS=2000
SLOW_QUERY_MS=1000
RESPONSE_SIZE_WARN_BYTES=500000

AUDIT_LOG_RETENTION_DAYS=365
SCHEDULER_ITEM_RETENTION_DAYS=90
EXPORT_FILE_RETENTION_DAYS=7
FAILED_JOB_RETENTION_DAYS=30
```

---

## Supabase Free Tier production warning

Do not use Supabase Free Tier for real production payroll with large employee count.

Supabase Free Tier is okay for:

```txt
Development
Testing
Small demo
Initial validation
```

For real production payroll, use:

```txt
Supabase Pro
Neon paid Postgres
DigitalOcean Managed PostgreSQL
AWS RDS PostgreSQL
VPS PostgreSQL with backups
```

---

# 17. Production Deployment Pattern

## Render / Railway / Similar platforms

Create two services from the same repo.

### Service 1: payroll-api

Build command:

```bash
npm install && npm run build && npx prisma generate
```

Start command:

```bash
npm run start
```

### Service 2: payroll-worker

Build command:

```bash
npm install && npm run build && npx prisma generate
```

Start command:

```bash
npm run worker
```

Both services need:

```txt
DATABASE_URL
REDIS_URL
JWT_SECRET
CORS_ORIGIN
```

Worker also needs:

```txt
PAYROLL_WORKER_CONCURRENCY
PAYSLIP_WORKER_CONCURRENCY
SCHEDULER_BATCH_SIZE
```

---

# 18. Production Redis

Recommended Redis providers:

```txt
Upstash Redis
Redis Cloud
Railway Redis
Render Redis
AWS ElastiCache
DigitalOcean Managed Redis
```

If Redis URL starts with:

```txt
rediss://
```

you may need TLS config in Redis connection:

```ts
new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  tls: {},
});
```

---

# 19. Production Database

Minimum production database requirements:

```txt
Automatic daily backup
Point-in-time recovery
Enough storage
Connection pooling
Monitoring
Indexes applied
Migration deploy support
```

For high scale:

```txt
Read replica
Partitioning
Dedicated worker DB connection limits
Report background jobs
```

---

# 20. Production Backup Flow

Before every migration:

```bash
npm run db:backup
```

Then:

```bash
npx prisma migrate deploy
```

If something goes wrong:

```bash
npm run db:restore -- backups/backup_file.dump
```

---

# 21. Production Health Check

After deployment, test:

```http
GET https://api.your-domain.com/api/health
GET https://api.your-domain.com/api/health/system
GET https://api.your-domain.com/api/health/queues
```

Expected:

```txt
API OK
Database OK
Redis OK
Queues visible
```

---

# 22. Production Scheduler Test

Use SUPER_ADMIN token.

Start manual scheduler:

```http
POST https://api.your-domain.com/api/scheduler/run
```

Expected:

```txt
202 Accepted
runId returned
```

Check run:

```http
GET https://api.your-domain.com/api/scheduler/runs/:runId
```

Expected:

```txt
PENDING / RUNNING / COMPLETED
```

---

# 23. Production Performance Rules

Use these defaults first:

```txt
API list limit max 100
Dropdown limit max 50
Reports require from/to
Exports are background jobs
Scheduler batch 100
Payroll worker concurrency 1
Payslip worker concurrency 2
```

Increase only after monitoring.

---

# 24. What Not To Do in Production

Do not:

```txt
Run worker inside server.ts
Run cron inside API service
Use migrate dev
Allow CORS all origins
Use fallback JWT secret
Enable full Prisma query logs permanently
Return 1 lakh rows from list APIs
Run scheduler synchronously inside API request
Use high concurrency on weak database
Run stress tests directly against real payroll production data
```

---

# 25. Local vs Production Difference Summary

| Area               | Local                    | Production                                |
| ------------------ | ------------------------ | ----------------------------------------- |
| API command        | `npm run dev`            | `npm run start`                           |
| Worker command     | `npm run dev:worker`     | `npm run worker`                          |
| Migration command  | `npx prisma migrate dev` | `npx prisma migrate deploy`               |
| Redis              | Docker Redis             | Managed Redis                             |
| Database           | Supabase/local Postgres  | Managed Postgres with backups             |
| Logs               | Detailed logs enabled    | Debug logs disabled                       |
| Prisma query logs  | Enabled for debugging    | Disabled by default                       |
| Batch size         | 25–50                    | 100–500 depending on DB                   |
| Worker concurrency | 1                        | 1–5 after testing                         |
| CORS               | localhost allowed        | only frontend domain                      |
| JWT secret         | local strong secret      | required strong secret                    |
| k6 testing         | okay                     | only controlled staging, not live payroll |
| Scheduler          | manual testing           | worker + cron service                     |
| Backup             | optional but recommended | mandatory                                 |

---

# 26. Recommended Run Order

## Local run order

```bash
cd backend
npm install
docker start payroll-redis
npx prisma migrate dev
npx prisma generate
npm run build
npm run dev
npm run dev:worker
```

Then test:

```bash
npm run k6:employee-list
npm run k6:scheduler-start
npm run k6:payroll-generate
```

---

## Production deploy order

```bash
npm install
npm run build
npx prisma generate
npm run db:backup
npx prisma migrate deploy
npm run start
npm run worker
```

In real hosting, API and worker are separate services, so the platform starts them separately.

---

# 27. Final Checklist Before Stress Testing

Confirm:

```txt
[ ] Redis is running
[ ] API server is running
[ ] Worker is running
[ ] DATABASE_URL is correct
[ ] Prisma migration applied
[ ] Prisma generate done
[ ] Build passes
[ ] Health API OK
[ ] DB health OK
[ ] Redis health OK
[ ] Queue health OK
[ ] Login works
[ ] Manual scheduler returns 202
[ ] Scheduler status API works
[ ] Payslip worker creates payslip
[ ] No Prisma pool timeout
[ ] No Redis connection error
```

---

# 28. Final Checklist Before Production

Confirm:

```txt
[ ] API and worker are separate services
[ ] Cron runs only in worker
[ ] Scheduler uses BullMQ queue
[ ] `npm run build` passes
[ ] `dist/server.js` exists
[ ] `dist/worker.js` exists
[ ] `npx prisma migrate deploy` works
[ ] Strong JWT_SECRET configured
[ ] CORS_ORIGIN configured
[ ] Redis production URL configured
[ ] Backups enabled
[ ] Health checks configured
[ ] Logs visible in hosting provider
[ ] Sentry or error tracking configured
[ ] Prisma query logs disabled
[ ] Performance logs disabled
[ ] Worker concurrency safe
[ ] Scheduler batch size safe
[ ] Dashboard summary works
[ ] Reports require date range
[ ] List APIs enforce max limit
```

---

# 29. Troubleshooting

## Problem: Scheduler API returns 202 but nothing happens

Cause:

```txt
Worker is not running
Redis not running
Queue job failed
```

Fix:

```bash
docker start payroll-redis
npm run dev:worker
```

Check:

```http
GET /api/health/queues
```

---

## Problem: Redis connection failed

Check Redis:

```bash
docker ps
```

Start Redis:

```bash
docker start payroll-redis
```

Or create it:

```bash
docker run --name payroll-redis -p 6379:6379 -d redis
```

---

## Problem: Prisma pool timeout

Reduce:

```env
SCHEDULER_BATCH_SIZE=25
PAYROLL_WORKER_CONCURRENCY=1
PAYSLIP_WORKER_CONCURRENCY=1
```

Also reduce k6 VUs.

---

## Problem: Build fails

Run:

```bash
npm install
npm run build
```

Check:

```txt
tsconfig.json
missing imports
wrong TypeScript types
missing env typings
```

---

## Problem: Payslip not created

Check:

```txt
Worker running?
Payslip queue has failed jobs?
PAYSLIP_SYNC_GENERATION=false?
Payslip worker imported in worker.ts?
```

Check queue health:

```http
GET /api/health/queues
```

---

## Problem: Manual scheduler returns 409

This means scheduler is already running.

This is correct behavior.

Check current run:

```http
GET /api/scheduler/runs/:runId
```

or wait until current run completes.

---

# 30. Safe Scaling Order

When stable, increase slowly:

```txt
1. Fix slow SQL queries first
2. Add/verify indexes
3. Reduce payload sizes
4. Use caching
5. Increase scheduler batch size
6. Increase payslip worker concurrency
7. Increase payroll worker concurrency
8. Upgrade database plan
9. Add read replica
10. Add partitioning
```

Do not increase concurrency first.

# 31. Production architecture

                    ┌──────────────────┐
                    │   React Frontend  │
                    │  Vercel/Netlify   │
                    └─────────┬────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Node.js API     │
                    │ Render/Railway    │
                    └──────┬─────┬─────┘
                           │     │
              ┌────────────┘     └────────────┐
              ▼                               ▼
      ┌──────────────┐                ┌──────────────┐
      │ PostgreSQL   │                │ Redis        │
      │ Neon/Render  │                │ Upstash      │
      └──────────────┘                └──────┬───────┘
                                             │
                                             ▼
                                  ┌──────────────────┐
                                  │ Background Worker │
                                  │ Payroll/PDF Jobs  │
                                  └──────────────────┘
