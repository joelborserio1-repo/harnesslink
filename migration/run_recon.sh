#!/usr/bin/env bash
#
# migration/run_recon.sh
#
# Turnkey wrapper for migration/recon.rb.
#
# You have a large WordPress SQL dump and don't want to install anything or
# touch a real server. This script:
#   1. boots a DISPOSABLE MariaDB in Docker (throwaway root creds, local only),
#   2. imports your dump into it (.sql or .sql.gz),
#   3. auto-detects the WordPress table prefix,
#   4. runs migration/recon.rb against it (Ruby + mysql2 run inside a container,
#      so nothing is installed on your host),
#   5. writes migration/RECON.md, then tears the database down.
#
# The dump never leaves your machine. No real/production server is contacted.
#
# ---------------------------------------------------------------------------
# Usage:
#   ./migration/run_recon.sh /path/to/dump.sql
#   ./migration/run_recon.sh /path/to/dump.sql.gz
#   ./migration/run_recon.sh /path/to/dump.sql wp_xyz_      # force a prefix
#
# Requirements: Docker. That's it.
#
# Modes:
#   Default            -> disposable Dockerized MariaDB (recommended).
#   USE_EXISTING=1     -> skip Docker/import; run recon against an already-loaded
#                         DB via WP_DB_HOST/WP_DB_NAME/WP_DB_USER/WP_DB_PASSWORD.
#                         (See migration/recon.rb header for those env vars.)
#   HOST_RUBY=1        -> use your local `ruby` + mysql2 instead of a container
#                         (needs the mysql2 gem installed).
# ---------------------------------------------------------------------------

set -euo pipefail

DUMP="${1:-}"
FORCE_PREFIX="${2:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# --- Mode: run against an existing, already-loaded database ----------------
if [[ "${USE_EXISTING:-}" == "1" ]]; then
  echo "[run_recon] USE_EXISTING=1 — running recon against existing DB (no Docker, no import)."
  : "${WP_DB_HOST:?set WP_DB_HOST}"; : "${WP_DB_NAME:?set WP_DB_NAME}"; : "${WP_DB_USER:?set WP_DB_USER}"
  export WP_TABLE_PREFIX="${WP_TABLE_PREFIX:-${FORCE_PREFIX:-wp_}}"
  ruby migration/recon.rb
  echo "[run_recon] done -> migration/RECON.md"
  exit 0
fi

if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "usage: $0 /path/to/dump.sql[.gz] [table_prefix]" >&2
  exit 2
fi
command -v docker >/dev/null || { echo "[run_recon] Docker is required (or use USE_EXISTING=1)." >&2; exit 2; }

CONTAINER="harnesslink-recon-db"
DB_NAME="wp"
ROOT_PW="recon_throwaway_pw"
MARIADB_IMAGE="mariadb:11"
RUBY_IMAGE="ruby:3.3"

cleanup() {
  echo "[run_recon] tearing down disposable database…"
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[run_recon] starting disposable MariaDB ($MARIADB_IMAGE)…"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" \
  -e MYSQL_ROOT_PASSWORD="$ROOT_PW" \
  -e MYSQL_DATABASE="$DB_NAME" \
  --tmpfs /var/lib/mysql:rw,size=8g \
  "$MARIADB_IMAGE" \
  --max_allowed_packet=1G --innodb_buffer_pool_size=1G >/dev/null
# Note: /var/lib/mysql on tmpfs keeps the throwaway DB in RAM and guarantees it
# vanishes on teardown. If your dump is very large or RAM is tight, delete the
# --tmpfs line to use normal container storage instead.

echo -n "[run_recon] waiting for MariaDB to accept connections"
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" mysqladmin ping -uroot -p"$ROOT_PW" --silent >/dev/null 2>&1; then
    echo " ✓"; break
  fi
  echo -n "."; sleep 2
done
docker exec "$CONTAINER" mysqladmin ping -uroot -p"$ROOT_PW" --silent >/dev/null 2>&1 \
  || { echo; echo "[run_recon] database never came up." >&2; exit 1; }

echo "[run_recon] importing dump (this can take a while for a large dump)…"
if [[ "$DUMP" == *.gz ]]; then
  gunzip -c "$DUMP" | docker exec -i "$CONTAINER" mysql -uroot -p"$ROOT_PW" "$DB_NAME"
else
  docker exec -i "$CONTAINER" mysql -uroot -p"$ROOT_PW" "$DB_NAME" < "$DUMP"
fi
echo "[run_recon] import complete."

# --- Detect the table prefix ------------------------------------------------
if [[ -n "$FORCE_PREFIX" ]]; then
  PREFIX="$FORCE_PREFIX"
  echo "[run_recon] using forced table prefix: $PREFIX"
else
  echo "[run_recon] detecting table prefix…"
  # Find a "*options" table that also has a matching "*posts" sibling.
  PREFIX="$(docker exec "$CONTAINER" mysql -uroot -p"$ROOT_PW" -N -B -e "
    SELECT SUBSTRING(t1.table_name, 1, LENGTH(t1.table_name)-7) AS prefix
    FROM information_schema.tables t1
    JOIN information_schema.tables t2
      ON t2.table_schema = t1.table_schema
     AND t2.table_name = CONCAT(SUBSTRING(t1.table_name,1,LENGTH(t1.table_name)-7),'posts')
    WHERE t1.table_schema = '$DB_NAME'
      AND t1.table_name LIKE '%options'
    LIMIT 1;" 2>/dev/null || true)"
  if [[ -z "$PREFIX" ]]; then
    echo "[run_recon] could not auto-detect prefix. Tables present:" >&2
    docker exec "$CONTAINER" mysql -uroot -p"$ROOT_PW" -N -B -e \
      "SELECT table_name FROM information_schema.tables WHERE table_schema='$DB_NAME' LIMIT 40;" >&2
    echo "[run_recon] re-run with an explicit prefix: $0 \"$DUMP\" <prefix>" >&2
    exit 1
  fi
  echo "[run_recon] detected table prefix: $PREFIX"
fi

# --- Run the recon ----------------------------------------------------------
CONTAINER_IP="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$CONTAINER")"

if [[ "${HOST_RUBY:-}" == "1" ]]; then
  echo "[run_recon] running recon with host Ruby…"
  WP_DB_HOST="127.0.0.1" WP_DB_PORT="$(docker port "$CONTAINER" 3306 2>/dev/null | sed 's/.*://')" \
  WP_DB_NAME="$DB_NAME" WP_DB_USER="root" WP_DB_PASSWORD="$ROOT_PW" \
  WP_TABLE_PREFIX="$PREFIX" \
    ruby migration/recon.rb
else
  echo "[run_recon] running recon inside $RUBY_IMAGE (installing mysql2 in-container)…"
  docker run --rm \
    --network "container:$CONTAINER" \
    -v "$REPO_ROOT:/app" -w /app \
    -e WP_DB_HOST="127.0.0.1" -e WP_DB_PORT="3306" \
    -e WP_DB_NAME="$DB_NAME" -e WP_DB_USER="root" -e WP_DB_PASSWORD="$ROOT_PW" \
    -e WP_TABLE_PREFIX="$PREFIX" \
    "$RUBY_IMAGE" bash -lc '
      set -e
      apt-get update -qq >/dev/null
      apt-get install -y -qq default-libmysqlclient-dev >/dev/null
      gem install mysql2 -N >/dev/null
      ruby migration/recon.rb
    '
fi

echo "[run_recon] ✓ done — report written to migration/RECON.md"
echo "[run_recon] the disposable database will now be removed."
