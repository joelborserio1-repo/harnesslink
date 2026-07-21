#!/usr/bin/env bash
#
# Idempotent (re)deploy for BPM Bloodstock. Run from the bpm-bloodstock dir:
#   ./deploy/deploy.sh
#
# Pulls latest, installs deps, applies DB migrations, builds, and reloads PM2.
# Safe to re-run for every update.
set -euo pipefail

cd "$(dirname "$0")/.."   # -> bpm-bloodstock/

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Installing dependencies (npm ci)"
npm ci

echo "==> Applying database migrations"
npx prisma migrate deploy

echo "==> Building production bundle"
npm run build

echo "==> (Re)starting under PM2"
if pm2 describe bpm-bloodstock > /dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.js --update-env
else
  pm2 start deploy/ecosystem.config.js
fi
pm2 save

echo "==> Done. App is live on 127.0.0.1:3000 (proxied by Nginx)."
