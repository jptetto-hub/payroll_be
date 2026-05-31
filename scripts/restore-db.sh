#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/db-common.sh"

require_command node
require_command sed

PG_RESTORE_BIN=$(resolve_pg_command pg_restore)

if [ -z "${1:-}" ]; then
  echo "Usage: CONFIRM_DB_RESTORE=RESTORE_DATABASE npm run db:restore -- backups/file.dump"
  exit 1
fi

BACKUP_FILE=$1

if [ ! -r "$BACKUP_FILE" ] || [ ! -s "$BACKUP_FILE" ]; then
  echo "Backup file is missing, unreadable, or empty: $BACKUP_FILE"
  exit 1
fi

if [ "${CONFIRM_DB_RESTORE:-}" != "RESTORE_DATABASE" ]; then
  echo "Restore blocked: set CONFIRM_DB_RESTORE=RESTORE_DATABASE"
  exit 1
fi

if [ "$(is_production_environment)" = "true" ] &&
  [ "${ALLOW_PRODUCTION_DB_RESTORE:-}" != "true" ]; then
  echo "Production restore blocked: set ALLOW_PRODUCTION_DB_RESTORE=true"
  exit 1
fi

DATABASE_OPERATION_URL=$(get_database_admin_url)
DATABASE_TARGET=$(describe_database_target "$DATABASE_OPERATION_URL")
RESTORE_LIST=$(mktemp "${TMPDIR:-/tmp}/payroll-restore-list.XXXXXX")

cleanup() {
  rm -f "$RESTORE_LIST"
}

trap cleanup EXIT

echo "Validating backup file..."
"$PG_RESTORE_BIN" --list "$BACKUP_FILE" |
  sed '/ SCHEMA - public /d' > "$RESTORE_LIST"

if [ "${SKIP_PRE_RESTORE_BACKUP:-}" != "true" ]; then
  echo "Creating a safety backup before restore..."
  bash "$SCRIPT_DIR/backup-db.sh"
else
  echo "Skipping pre-restore backup because SKIP_PRE_RESTORE_BACKUP=true"
fi

echo "Restoring $BACKUP_FILE into $DATABASE_TARGET..."
"$PG_RESTORE_BIN" \
  --clean \
  --if-exists \
  --single-transaction \
  --use-list "$RESTORE_LIST" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  --dbname "$DATABASE_OPERATION_URL" \
  "$BACKUP_FILE"

echo "Restore completed."
