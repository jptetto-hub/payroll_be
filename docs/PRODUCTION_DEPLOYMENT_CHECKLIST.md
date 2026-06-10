# Production Deployment Checklist

## Services

Run API and workers as separate services.

- API service: `npm run start`
- Worker service: `npm run worker`
- PostgreSQL database
- Redis

Do not import workers from `server.ts`. If the API scales to multiple instances, each instance would start its own workers and create unnecessary background load.

## Deployment Flow

```bash
npm run build
npx prisma migrate deploy
npx prisma generate
npm run start
```

Start workers separately:

```bash
npm run worker
```

## Required Environment

```bash
NODE_ENV=production
PORT=5000
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public&connection_limit=10&pool_timeout=30"
READ_DATABASE_URL="postgresql://USER:PASSWORD@READ_HOST:5432/DB?schema=public&connection_limit=10&pool_timeout=30"
DATABASE_ADMIN_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
REDIS_URL="redis://default:PASSWORD@HOST:6379"
CORS_ORIGIN="https://your-frontend-domain.com"
JWT_SECRET="strong_random_secret_minimum_64_chars"
JWT_EXPIRES_IN="7d"
AUTH_COOKIE_NAME="payroll_session"
AUTH_IDLE_TIMEOUT_SECONDS=1800
BCRYPT_ROUNDS=12
APP_TIMEZONE=Asia/Kolkata
ENABLE_REDIS_CACHE=true
PAYSLIP_SYNC_GENERATION=false
ENABLE_PRISMA_QUERY_LOG=false
ENABLE_PERFORMANCE_LOG=false
SLOW_API_MS=2000
SLOW_QUERY_MS=1000
RESPONSE_SIZE_WARN_BYTES=500000
R2_AUTO_BACKUP_ENABLED=true
R2_BACKUP_CRON="0 2 * * *"
R2_BACKUP_RUN_ON_STARTUP=true
R2_REMOTE_DELETE_ENABLED=false
R2_DAILY_RETENTION_DAYS=6
R2_WEEKLY_RETENTION_WEEKS=4
R2_MONTHLY_RETENTION_MONTHS=2
```

Frontend production build:

```bash
VITE_API_BASE_URL="https://api.your-domain.com/api"
```

For Supabase Free Tier, keep:

```bash
SCHEDULER_BATCH_SIZE=50
SCHEDULER_EMPLOYEE_CONCURRENCY=1
SCHEDULER_STORE_ITEM_DETAILS=false
PAYROLL_WORKER_CONCURRENCY=1
PAYSLIP_WORKER_CONCURRENCY=1
```

On larger dedicated PostgreSQL capacity, tune `SCHEDULER_BATCH_SIZE` and
`SCHEDULER_EMPLOYEE_CONCURRENCY` upward in stages. Keep
`SCHEDULER_STORE_ITEM_DETAILS=false` for very large payroll cycles so run
history stores failures/skips for investigation without writing one detail row
for every successful payroll.

## Health Checks

Use:

- `GET /api/health`
- `GET /api/health/db`
- `GET /api/health/redis`

## Safety Checklist

- Manual scheduler returns `202`.
- Worker service is running.
- Redis connection works.
- Payroll duplicate protection works.
- Payslip generation runs in background.
- Large list APIs are paginated.
- Reports require date range.
- Slow query logging is disabled by default.
- Migrations are applied with `npx prisma migrate deploy`.
- Backups are enabled and restore has been tested.
- Frontend `VITE_API_BASE_URL` points to the production API.
- Backend `CORS_ORIGIN` exactly matches the deployed frontend URL.
- R2 cleanup preview is reviewed before setting `R2_REMOTE_DELETE_ENABLED=true`.
