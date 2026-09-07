#!/usr/bin/env bash
#
# Runs the data-layer test suite against a throwaway PostgreSQL cluster.
#
#   ./supabase/tests/run.sh
#
# Requires a local PostgreSQL installation (initdb/pg_ctl/psql on PATH, or set
# PG_BIN). If you already run `supabase start`, you can skip this script and
# point psql straight at it:
#
#   psql "$(supabase status -o json | jq -r .DB_URL)" -f supabase/tests/data-layer.test.sql
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Debian/Ubuntu keep the server binaries out of PATH; look there too.
if [[ -z "${PG_BIN:-}" ]]; then
  if command -v initdb >/dev/null 2>&1; then
    PG_BIN="$(dirname "$(command -v initdb)")"
  else
    PG_BIN="$(ls -d /usr/lib/postgresql/*/bin /opt/homebrew/opt/postgresql*/bin 2>/dev/null | sort -V | tail -1 || true)"
  fi
fi

if [[ -z "$PG_BIN" || ! -x "$PG_BIN/initdb" ]]; then
  echo "Could not find initdb. Install PostgreSQL, or set PG_BIN=/path/to/postgres/bin." >&2
  exit 1
fi

if [[ "$(id -u)" == "0" ]]; then
  echo "PostgreSQL refuses to run as root. Re-run this script as a normal user." >&2
  exit 1
fi
WORK="${TMPDIR:-/tmp}/map-dismissals-pgtest.$$"
PORT="${PGTEST_PORT:-55432}"

cleanup() {
  "$PG_BIN/pg_ctl" -D "$WORK/data" -s -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "▸ creating a throwaway cluster in $WORK"
mkdir -p "$WORK/data" "$WORK/run"
"$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
"$PG_BIN/pg_ctl" -D "$WORK/data" -o "-k $WORK/run -p $PORT -c listen_addresses=" \
  -l "$WORK/pg.log" -w start >/dev/null

export PGHOST="$WORK/run" PGPORT="$PORT" PGUSER=postgres

echo "▸ applying stubs, migrations and seed"
psql -q -d postgres -c "create database mapdismissals;" >/dev/null
export PGDATABASE=mapdismissals

psql -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/tests/_supabase-stubs.sql" 2>&1 \
  | grep -viE 'wal_level|^HINT|^NOTICE' || true

for migration in "$ROOT"/supabase/migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -q -f "$migration" 2>&1 | grep -vE '^NOTICE' || true
done

psql -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/seed.sql" 2>&1 | grep -vE '^NOTICE' || true

echo "▸ running assertions"
psql -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/data-layer.test.sql" 2>&1 \
  | grep -E 'ok:|ASSERTION|ERROR|^--- [0-9]|PASSED' \
  | sed -E 's/^psql:[^ ]+ (NOTICE|ERROR): +/  /'
