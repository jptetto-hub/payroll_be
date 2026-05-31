#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BACKEND_DIR=$(cd "$SCRIPT_DIR/.." && pwd)

cd "$BACKEND_DIR"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command is missing: $1"
    exit 1
  fi
}

get_env_value() {
  node -r dotenv/config -e '
process.stdout.write(process.env[process.argv[1]] || "");
' "$1"
}

assert_r2_configuration() {
  local account_id=$1
  local endpoint_url=$2

  if [[ ! "$account_id" =~ ^[a-fA-F0-9]{32}$ ]]; then
    echo "R2_ACCOUNT_ID must be the 32-character Cloudflare Account ID, not the API token value."
    exit 1
  fi

  if [[ "$endpoint_url" != "https://${account_id}.r2.cloudflarestorage.com" ]]; then
    echo "R2_ENDPOINT_URL must match https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com"
    exit 1
  fi
}

resolve_pg_command() {
  local command_name=$1
  local candidate

  if [ -n "${PG_BIN_DIR:-}" ]; then
    candidate="${PG_BIN_DIR%/}/$command_name"

    if [ ! -x "$candidate" ]; then
      echo "Configured PostgreSQL command is missing: $candidate" >&2
      exit 1
    fi

    echo "$candidate"
    return
  fi

  for candidate in \
    "/opt/homebrew/opt/postgresql@17/bin/$command_name" \
    "/usr/local/opt/postgresql@17/bin/$command_name"
  do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return
    fi
  done

  command -v "$command_name"
}

assert_pg_dump_compatible() {
  local database_url=$1
  local pg_dump_bin=$2
  local psql_bin=$3
  local client_major
  local server_version_num
  local server_major

  client_major=$("$pg_dump_bin" --version | sed -E 's/.* ([0-9]+)(\.[0-9]+)?.*/\1/')
  server_version_num=$("$psql_bin" "$database_url" --tuples-only --no-align \
    --command="SHOW server_version_num;")
  server_major=$((server_version_num / 10000))

  if [ "$client_major" -lt "$server_major" ]; then
    echo "Backup blocked: pg_dump major version $client_major is older than PostgreSQL server major version $server_major."
    echo "Install a PostgreSQL $server_major client or set PG_BIN_DIR to its bin directory."
    exit 1
  fi
}

get_database_admin_url() {
  node -r dotenv/config -e '
const rawUrl =
  process.env.DATABASE_ADMIN_URL ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL;

if (!rawUrl) {
  console.error("DATABASE_ADMIN_URL, DIRECT_URL, or DATABASE_URL is required");
  process.exit(1);
}

const url = new URL(rawUrl);
for (const key of [
  "schema",
  "connection_limit",
  "pool_timeout",
  "pgbouncer",
  "uselibpqcompat",
]) {
  url.searchParams.delete(key);
}

if (!url.searchParams.has("connect_timeout")) {
  url.searchParams.set("connect_timeout", "10");
}

process.stdout.write(url.toString());
'
}

describe_database_target() {
  DATABASE_OPERATION_URL="$1" node -e '
const url = new URL(process.env.DATABASE_OPERATION_URL);
const database = url.pathname.replace(/^\//, "") || "(default)";
process.stdout.write(`${url.hostname}:${url.port || "5432"}/${database}`);
'
}

is_production_environment() {
  node -r dotenv/config -e '
process.stdout.write(process.env.NODE_ENV === "production" ? "true" : "false");
'
}

write_sha256() {
  local file_path=$1

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file_path" > "${file_path}.sha256"
    return
  fi

  shasum -a 256 "$file_path" > "${file_path}.sha256"
}
