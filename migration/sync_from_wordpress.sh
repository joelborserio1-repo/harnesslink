#!/usr/bin/env bash
# migration/sync_from_wordpress.sh — keep Strapi in step with the live
# WordPress site until cutover. READ-ONLY against WordPress (wp eval-file of
# export_posts.php / export_readers.php; nothing is written there).
#
#   sync_from_wordpress.sh            every 10 minutes: posts changed since the
#                                     last good run (new, edited, re-slugged,
#                                     unpublished or trashed)
#   sync_from_wordpress.sh nightly    also: posts deleted outright (ID check)
#                                     and new reader accounts
#
# Cron (root, on the staging server):
#   */10 * * * * /root/harnesslink/migration/sync_from_wordpress.sh >> /var/log/hl-sync.log 2>&1
#   40 3 * * *   /root/harnesslink/migration/sync_from_wordpress.sh nightly >> /var/log/hl-sync.log 2>&1
#
# Pause it: touch /root/harnesslink-backups/sync/PAUSED   (rm to resume)
set -euo pipefail

REPO=/root/harnesslink
WP=/var/www/harnesslink.com
WP_USER=u6_harnesslink
STATE=/root/harnesslink-backups/sync
FIRST_SINCE="2026-10-19 00:00:00"   # the full import was taken on 20 Oct
mkdir -p "$STATE"; chmod 700 "$STATE"

exec 9>"$STATE/lock"
flock -n 9 || { echo "$(date -u '+%F %T') sync already running, skipping"; exit 0; }
[ -e "$STATE/PAUSED" ] && exit 0

log() { echo "$(date -u '+%F %T') $*"; }
wp_export() { # env assignments..., output file
  local out="${!#}"; local envs=("${@:1:$#-1}")
  install -m 644 "$REPO/migration/export_posts.php" /tmp/hl_export_posts.php
  ( cd "$WP" && sudo -u "$WP_USER" env "${envs[@]}" /usr/local/bin/wp eval-file /tmp/hl_export_posts.php --path="$WP/" ) > "$out" 2>/dev/null
  [ "$(head -c1 "$out")" = "[" ] || { log "export failed (not JSON)"; return 1; }
}
import() { # file, extra importer args...
  local file=$1; shift
  cd "$REPO"
  docker compose exec -T cms sh -c "umask 077; cat > /tmp/hl-sync.json" < "$file"
  local st=0
  docker compose exec -T -e CRON_ENABLED=false -e NODE_ENV=production cms \
    sh -c "cd /app && node scripts/import-wordpress.js $* /tmp/hl-sync.json; s=\$?; rm -f /tmp/hl-sync.json; exit \$s" \
    > "$TMP/import.log" 2>&1 || st=$?
  grep -E '\] (done|reconcile|unpublished|post [0-9]+ failed)|refused' "$TMP/import.log" | sed "s/^/$(date -u '+%F %T') /" || true
  if [ "$st" -ne 0 ] || ! grep -qE '\] (done|reconcile done)' "$TMP/import.log"; then
    log "import failed (exit $st); will retry from the same point next run"
    tail -5 "$TMP/import.log"
    return 1
  fi
}

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
STARTED=$(date -u '+%F %T')

# 10 minutes of overlap so a post saved mid-export is never missed (unchanged
# posts are skipped by the importer, so the overlap costs nothing).
SINCE=$(cat "$STATE/last-sync" 2>/dev/null || echo "$FIRST_SINCE")
SINCE=$(date -u -d "$SINCE UTC - 10 minutes" '+%F %T')

wp_export EXPORT_SINCE="$SINCE" "$TMP/changed.json"
COUNT=$(grep -o '"id":' "$TMP/changed.json" | wc -l)
if [ "$COUNT" -gt 0 ]; then
  log "$COUNT post(s) changed since $SINCE"
  import "$TMP/changed.json"
fi
echo "$STARTED" > "$STATE/last-sync"

if [ "${1:-}" = "nightly" ]; then
  wp_export EXPORT_IDS=1 "$TMP/ids.json"
  log "nightly: checking for deleted posts"
  import "$TMP/ids.json" --reconcile
  if [ -x /root/harnesslink-backups/import-readers.sh ]; then
    log "nightly: readers"
    /root/harnesslink-backups/import-readers.sh 2>&1 | grep -E 'done|failed' || true
  fi
fi
