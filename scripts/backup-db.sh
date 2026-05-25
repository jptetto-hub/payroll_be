#!/bin/bash

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is missing"
  exit 1
fi

mkdir -p backups

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILE_NAME="backups/payroll_backup_${TIMESTAMP}.dump"
PG_DUMP_URL=$(node -e '
const url = new URL(process.env.DATABASE_URL);
for (const key of ["schema", "connection_limit", "pool_timeout"]) {
  url.searchParams.delete(key);
}
process.stdout.write(url.toString());
')

echo "Starting database backup..."
pg_dump "$PG_DUMP_URL" -Fc -f "$FILE_NAME"

echo "Backup completed: $FILE_NAME"
