#!/bin/bash

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is missing"
  exit 1
fi

if [ -z "$1" ]; then
  echo "Usage: ./scripts/restore-db.sh backups/file.dump"
  exit 1
fi

BACKUP_FILE=$1
PG_RESTORE_URL=$(node -e '
const url = new URL(process.env.DATABASE_URL);
for (const key of ["schema", "connection_limit", "pool_timeout"]) {
  url.searchParams.delete(key);
}
process.stdout.write(url.toString());
')

echo "Restoring database from $BACKUP_FILE..."

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --dbname "$PG_RESTORE_URL" \
  "$BACKUP_FILE"

echo "Restore completed."
