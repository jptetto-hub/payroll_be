#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/db-common.sh"

umask 077

require_command aws
require_command gzip
require_command node
require_command psql
require_command zgrep

PG_DUMP_BIN=$(resolve_pg_command pg_dump)
PSQL_BIN=$(resolve_pg_command psql)

R2_ACCOUNT_ID=${R2_ACCOUNT_ID:-$(get_env_value R2_ACCOUNT_ID)}
R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID:-$(get_env_value R2_ACCESS_KEY_ID)}
R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY:-$(get_env_value R2_SECRET_ACCESS_KEY)}
R2_BUCKET=${R2_BUCKET:-$(get_env_value R2_BUCKET)}
R2_BUCKET=${R2_BUCKET:-payroll-db-backups}
R2_REGION=${R2_REGION:-$(get_env_value R2_REGION)}
R2_REGION=${R2_REGION:-auto}
R2_ENDPOINT_URL=${R2_ENDPOINT_URL:-$(get_env_value R2_ENDPOINT_URL)}
R2_WEEKLY_BACKUP_DAY=${R2_WEEKLY_BACKUP_DAY:-$(get_env_value R2_WEEKLY_BACKUP_DAY)}
R2_WEEKLY_BACKUP_DAY=${R2_WEEKLY_BACKUP_DAY:-7}
R2_MONTHLY_BACKUP_DAY=${R2_MONTHLY_BACKUP_DAY:-$(get_env_value R2_MONTHLY_BACKUP_DAY)}
R2_MONTHLY_BACKUP_DAY=${R2_MONTHLY_BACKUP_DAY:-01}
R2_BACKUP_MODE=${R2_BACKUP_MODE:-scheduled}

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
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
ISO_WEEK=$(date +"%G-%V")
DAY_OF_WEEK=$(date +"%u")
DAY_OF_MONTH=$(date +"%d")
TEMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/payroll-r2-backup.XXXXXX")
BACKUP_FILE="$TEMP_DIR/payroll_${TIMESTAMP}.sql.gz"
PERMISSION_CHECK_FILE="$TEMP_DIR/r2-permission-check.txt"
PERMISSION_CHECK_KEY=".permission-check/upload-${TIMESTAMP}.txt"

cleanup() {
  rm -rf "$TEMP_DIR"
}

trap cleanup EXIT

upload_backup() {
  local object_key=$1

  echo "Uploading s3://$R2_BUCKET/$object_key..."
  aws \
    --endpoint-url "$R2_ENDPOINT_URL" \
    s3 cp \
    "$BACKUP_FILE" \
    "s3://$R2_BUCKET/$object_key" \
    --only-show-errors

  aws \
    --endpoint-url "$R2_ENDPOINT_URL" \
    s3api head-object \
    --bucket "$R2_BUCKET" \
    --key "$object_key" \
    >/dev/null

  echo "Verified R2 object: s3://$R2_BUCKET/$object_key"
}

assert_r2_upload_allowed() {
  printf "payroll R2 upload permission check\n" > "$PERMISSION_CHECK_FILE"

  if ! aws \
    --endpoint-url "$R2_ENDPOINT_URL" \
    s3 cp \
    "$PERMISSION_CHECK_FILE" \
    "s3://$R2_BUCKET/$PERMISSION_CHECK_KEY" \
    --only-show-errors; then
    echo "R2 upload permission check failed."
    echo "Create an R2 API token with Object Read & Write access for bucket: $R2_BUCKET"
    exit 1
  fi

  if ! aws \
    --endpoint-url "$R2_ENDPOINT_URL" \
    s3 rm \
    "s3://$R2_BUCKET/$PERMISSION_CHECK_KEY" \
    --only-show-errors; then
    echo "R2 permission check object could not be deleted: s3://$R2_BUCKET/$PERMISSION_CHECK_KEY"
    exit 1
  fi
}

assert_r2_upload_allowed
assert_pg_dump_compatible "$DATABASE_OPERATION_URL" "$PG_DUMP_BIN" "$PSQL_BIN"

echo "Creating compressed SQL backup from $DATABASE_TARGET..."
"$PG_DUMP_BIN" \
  --format=plain \
  --clean \
  --if-exists \
  --schema=public \
  --no-owner \
  --no-privileges \
  "$DATABASE_OPERATION_URL" |
  gzip -9 > "$BACKUP_FILE"

if [ ! -s "$BACKUP_FILE" ]; then
  echo "R2 backup failed: compressed SQL file is empty"
  exit 1
fi

gzip -t "$BACKUP_FILE"

for table_name in \
  AdvancePayment \
  Attendance \
  AttendanceRequest \
  AuditLog \
  AuditLogArchive \
  DashboardSummary \
  Employee \
  LedgerEntry \
  Payroll \
  PayrollCarryForward \
  Payslip \
  SalaryHistory \
  SchedulerRun \
  SchedulerRunItem \
  SystemSetting \
  WorkHourSetting \
  WorkerHeartbeat \
  _prisma_migrations
do
  if ! zgrep -Fq "CREATE TABLE public.\"$table_name\"" "$BACKUP_FILE" &&
    ! zgrep -Fq "CREATE TABLE public.$table_name" "$BACKUP_FILE"; then
    echo "R2 backup failed: required table is missing from SQL dump: $table_name"
    exit 1
  fi
done

if [ "$R2_BACKUP_MODE" = "daily" ] || [ "$R2_BACKUP_MODE" = "scheduled" ]; then
  upload_backup "daily/payroll_${TIMESTAMP}.sql.gz"
fi

if [ "$R2_BACKUP_MODE" = "weekly" ] ||
  { [ "$R2_BACKUP_MODE" = "scheduled" ] && [ "$DAY_OF_WEEK" = "$R2_WEEKLY_BACKUP_DAY" ]; }; then
  upload_backup "weekly/payroll_week_${ISO_WEEK}.sql.gz"
fi

if [ "$R2_BACKUP_MODE" = "monthly" ] ||
  { [ "$R2_BACKUP_MODE" = "scheduled" ] && [ "$DAY_OF_MONTH" = "$R2_MONTHLY_BACKUP_DAY" ]; }; then
  upload_backup "monthly/payroll_$(date +"%Y-%m").sql.gz"
fi

echo "Cloudflare R2 backup completed."
