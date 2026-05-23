# Observability And Alerting

Step 24 adds structured logs, request IDs, Sentry hooks, queue health, and worker heartbeats.

## Structured Logs

The backend uses Pino:

```bash
LOG_LEVEL=info
LOG_API_REQUESTS=false
```

For stress testing:

```bash
LOG_LEVEL=debug
LOG_API_REQUESTS=true
ENABLE_PERFORMANCE_LOG=true
ENABLE_PRISMA_QUERY_LOG=true
SLOW_API_MS=500
SLOW_QUERY_MS=200
```

## Request IDs

Every request gets an `x-request-id` response header. If the client sends `x-request-id`, the server reuses it.

Slow API logs include:

- requestId
- method
- path
- statusCode
- durationMs
- userId
- role

## Sentry

Sentry is disabled unless `SENTRY_DSN` is set:

```bash
SENTRY_DSN="your_sentry_dsn"
```

Production default:

```bash
SENTRY_DSN="your_sentry_dsn"
NODE_ENV=production
```

API errors and worker failures are captured with request/job context.

## Health APIs

Public:

- `GET /api/health`
- `GET /api/health/db`
- `GET /api/health/redis`
- `GET /api/health/system`

SUPER_ADMIN:

- `GET /api/health/queues`
- `GET /api/health/workers`

## Worker Heartbeat

The worker process writes a heartbeat every 30 seconds to `WorkerHeartbeat`.

If `lastSeenAt` is older than 2 minutes, the worker should be treated as stale/down.

## Minimum Alerts

Create alerts for:

- API error rate greater than 1%.
- p95 API response time greater than 2 seconds.
- Payroll scheduler job failed.
- Payslip failed jobs greater than 10.
- Redis disconnected.
- Database health check failed.
- Queue waiting jobs greater than 10,000.
- Worker heartbeat older than 2 minutes.
- Backup failed.
- Disk/storage usage high.
