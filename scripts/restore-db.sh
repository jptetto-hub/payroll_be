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

echo "Restoring database from $BACKUP_FILE..."

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --dbname "$DATABASE_URL" \
  "$BACKUP_FILE"

echo "Restore completed."
