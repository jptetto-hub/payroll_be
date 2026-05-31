# Clear Database Business Data

This command permanently truncates rows from application business tables. It
does not drop tables or schemas, and it preserves the Prisma migration history.

Stop the API and worker before running it. Create and verify a backup first:

```bash
npm run db:backup
CONFIRM_DB_CLEAR=CLEAR_PAYROLL_DATABASE npm run db:clear
```

Production clearing requires an additional explicit override during an
approved maintenance window:

```bash
ALLOW_PRODUCTION_DB_CLEAR=true \
CONFIRM_DB_CLEAR=CLEAR_PAYROLL_DATABASE \
npm run db:clear
```

After clearing, remove stale BullMQ jobs from the configured Redis instance,
then restart the API and worker. Do not flush a shared Redis database that is
used by other applications.

## Local Redis

```bash
docker run -d --name payroll-redis -p 6379:6379 redis:7-alpine
docker start payroll-redis
docker exec payroll-redis redis-cli ping
```
