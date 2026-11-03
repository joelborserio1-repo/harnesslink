#!/bin/bash
# Copies WordPress's uploads to Cloudflare R2, keeping the same paths
# (wp-content/uploads/2024/05/x.jpg), so the site can serve them from
# R2_PUBLIC_URL instead of harnesslink.com. READ-ONLY on WordPress.
#
# Safe to rerun: only new or changed files are sent, so run it once now
# (hours) and again just before cutover (minutes) while WordPress stays live.
#
#   R2_ENV=/root/harnesslink-backups/r2.env migration/sync_media_to_r2.sh [--dry-run]
#
# r2.env (root-only) holds R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and
# R2_SECRET_ACCESS_KEY. Skips wpallimport/ (an old bulk-import cache) and
# plugin folders: only the dated folders hold story photos.
set -euo pipefail
: "${R2_ENV:?set R2_ENV to the credentials file}"
# shellcheck disable=SC1090
source "$R2_ENV"
UPLOADS=${UPLOADS:-/var/www/harnesslink.com/wp-content/uploads}

docker run --rm \
  -v "$UPLOADS":/uploads:ro \
  -e RCLONE_CONFIG_R2_TYPE=s3 \
  -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
  -e RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
  -e RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true \
  rclone/rclone:1.75.1 copy /uploads "r2:${R2_BUCKET}/wp-content/uploads" \
  --include "/20[0-9][0-9]/**" \
  --transfers 32 --checkers 64 --fast-list \
  --header-upload "Cache-Control: public, max-age=31536000, immutable" \
  --stats 60s --stats-one-line --log-level NOTICE \
  "$@"
