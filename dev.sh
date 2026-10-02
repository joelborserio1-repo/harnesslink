#!/bin/sh
# Start the whole stack locally on this Mac (Homebrew Ruby 3.3 + Postgres 16):
#   ./dev.sh          → site on http://localhost:3000, API/admin on :3001
# Ctrl-C stops the API and the site; Postgres is left running.
set -e
cd "$(dirname "$0")"
export PATH="/opt/homebrew/opt/ruby@3.3/bin:/opt/homebrew/opt/postgresql@16/bin:$PATH"
export LC_ALL=en_US.UTF-8

pg_isready -q || pg_ctl -D /opt/homebrew/var/postgresql@16 -l /opt/homebrew/var/log/postgresql@16.log start

set -a; . ./.env; set +a
unset SECRET_KEY_BASE # development uses Rails' own dev secret

(cd api && rm -f tmp/pids/server.pid && bin/rails db:prepare && exec bin/rails server -p 3001) &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT INT TERM

cd web && API_BASE=http://127.0.0.1:3001 npm run dev -- -p 3000
