#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/db-common.sh"

umask 077

require_command aws
require_command gzip
require_command node
require_command psql
require_command sed

PSQL_BIN=$(resolve_pg_command psql)
R2_ACCOUNT_ID=${R2_ACCOUNT_ID:-$(get_env_value R2_ACCOUNT_ID)}
R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID:-$(get_env_value R2_ACCESS_KEY_ID)}
R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY:-$(get_env_value R2_SECRET_ACCESS_KEY)}
R2_BUCKET=${R2_BUCKET:-$(get_env_value R2_BUCKET)}
R2_BUCKET=${R2_BUCKET:-payroll-db-backups}
R2_REGION=${R2_REGION:-$(get_env_value R2_REGION)}
R2_REGION=${R2_REGION:-auto}
R2_ENDPOINT_URL=${R2_ENDPOINT_URL:-$(get_env_value R2_ENDPOINT_URL)}

if [ -z "${1:-}" ]; then
  echo "Usage: CONFIRM_DB_RESTORE=RESTORE_DATABASE npm run db:restore:r2 -- daily/payroll_YYYY-MM-DD_HH-mm-ss.sql.gz"
  exit 1
fi

OBJECT_KEY=$1

if [ "${CONFIRM_DB_RESTORE:-}" != "RESTORE_DATABASE" ]; then
  echo "R2 restore blocked: set CONFIRM_DB_RESTORE=RESTORE_DATABASE"
  exit 1
fi

if [ "$(is_production_environment)" = "true" ] &&
  [ "${ALLOW_PRODUCTION_DB_RESTORE:-}" != "true" ]; then
  echo "Production R2 restore blocked: set ALLOW_PRODUCTION_DB_RESTORE=true"
  exit 1
fi

if [ -z "${R2_ACCOUNT_ID:-}" ]; then
  echo "R2_ACCOUNT_ID is required"
  exit 1
fi

if [ -z "${R2_ACCESS_KEY_ID:-}" ]; then
  echo "R2_ACCESS_KEY_ID is required"
  exit 1
fi

if [ -z "${R2_SECRET_ACCESS_KEY:-}" ]; then
  echo "R2_SECRET_ACCESS_KEY is required"
  exit 1
fi

export AWS_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION=$R2_REGION

R2_ENDPOINT_URL=${R2_ENDPOINT_URL:-"https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"}
assert_r2_configuration "$R2_ACCOUNT_ID" "$R2_ENDPOINT_URL"
DATABASE_OPERATION_URL=$(get_database_admin_url)
DATABASE_TARGET=$(describe_database_target "$DATABASE_OPERATION_URL")
TEMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/payroll-r2-restore.XXXXXX")
BACKUP_FILE="$TEMP_DIR/restore.sql.gz"

cleanup() {
  rm -rf "$TEMP_DIR"
}

trap cleanup EXIT

echo "Downloading s3://$R2_BUCKET/$OBJECT_KEY..."
aws \
  --endpoint-url "$R2_ENDPOINT_URL" \
  s3 cp \
  "s3://$R2_BUCKET/$OBJECT_KEY" \
  "$BACKUP_FILE" \
  --only-show-errors

gzip -t "$BACKUP_FILE"

if [ "${SKIP_PRE_RESTORE_BACKUP:-}" != "true" ]; then
  echo "Creating a local safety backup before R2 restore..."
  bash "$SCRIPT_DIR/backup-db.sh"
else
  echo "Skipping pre-restore backup because SKIP_PRE_RESTORE_BACKUP=true"
fi

echo "Restoring s3://$R2_BUCKET/$OBJECT_KEY into $DATABASE_TARGET..."
gzip -dc "$BACKUP_FILE" |
  sed \
    -e '/^DROP SCHEMA \(IF EXISTS \)\{0,1\}public;$/d' \
    -e '/^CREATE SCHEMA public;$/d' |
  "$PSQL_BIN" \
    "$DATABASE_OPERATION_URL" \
    --set ON_ERROR_STOP=on \
    --single-transaction

"$PSQL_BIN" \
  "$DATABASE_OPERATION_URL" \
  --set ON_ERROR_STOP=on \
  --command="
DO \$\$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Employee',
    'AdvancePayment',
    'Attendance',
    'Payroll',
    'Payslip'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      RAISE EXCEPTION 'Restore verification failed: missing table public.%', table_name;
    END IF;
  END LOOP;
END
\$\$;
"

echo "R2 restore completed."
