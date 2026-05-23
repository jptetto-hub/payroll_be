#!/bin/bash

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is missing"
  exit 1
fi

mkdir -p backups

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILE_NAME="backups/payroll_backup_${TIMESTAMP}.dump"

echo "Starting database backup..."
pg_dump "$DATABASE_URL" -Fc -f "$FILE_NAME"

echo "Backup completed: $FILE_NAME"
