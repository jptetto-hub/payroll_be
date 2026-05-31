#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/db-common.sh"

umask 077

require_command node
require_command psql

PG_DUMP_BIN=$(resolve_pg_command pg_dump)
PG_RESTORE_BIN=$(resolve_pg_command pg_restore)
PSQL_BIN=$(resolve_pg_command psql)

BACKUP_DIR=${BACKUP_DIR:-backups}
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILE_NAME="$BACKUP_DIR/payroll_backup_${TIMESTAMP}.dump"
TEMP_FILE="${FILE_NAME}.tmp"
DATABASE_OPERATION_URL=$(get_database_admin_url)
DATABASE_TARGET=$(describe_database_target "$DATABASE_OPERATION_URL")

assert_pg_dump_compatible "$DATABASE_OPERATION_URL" "$PG_DUMP_BIN" "$PSQL_BIN"

cleanup() {
  rm -f "$TEMP_FILE"
}

trap cleanup EXIT

echo "Starting database backup from $DATABASE_TARGET..."
"$PG_DUMP_BIN" \
  --format=custom \
  --schema=public \
  --no-owner \
  --no-privileges \
  --file="$TEMP_FILE" \
  "$DATABASE_OPERATION_URL"

if [ ! -s "$TEMP_FILE" ]; then
  echo "Backup failed: dump file is empty"
  exit 1
fi

"$PG_RESTORE_BIN" --list "$TEMP_FILE" >/dev/null
mv "$TEMP_FILE" "$FILE_NAME"
write_sha256 "$FILE_NAME"
chmod 600 "$FILE_NAME" "${FILE_NAME}.sha256"

echo "Backup verified: $FILE_NAME"
echo "Checksum written: ${FILE_NAME}.sha256"
