#!/usr/bin/env bash
# migration/route_checks.sh — URL behaviour checks for the root namespace,
# where stories, static pages and event pages all live (/%postname%/).
#
#   migration/route_checks.sh [https://staging.harnesslink.com]
#
# Each line: expected status, path, and (for redirects) where it must go.
set -uo pipefail
BASE=${1:-https://staging.harnesslink.com}
fail=0
check() { # expect path [location-suffix]
  local want=$1 path=$2 to=${3:-}
  local got loc
  read -r got loc < <(curl -s -o /dev/null -m 30 -w '%{http_code} %{redirect_url}\n' "$BASE$path")
  if [ "$got" != "$want" ] || { [ -n "$to" ] && [[ "$loc" != *"$to" ]]; }; then
    echo "FAIL $path: got $got ${loc:-} (want $want ${to:-})"; fail=1
  else
    echo "ok   $path -> $got ${loc:-}"
  fi
}

# A live story whose slug another post once had: the story wins, no redirect.
check 200 /ring-in-the-new-year-at-the-meadowlands-racetrack/
check 200 /aussie-news-3rd-july/
# An old WordPress slug with nothing at that address still redirects.
check 301 /2402698-2/ /aussies-arrive-en-masse-for-cup-week-raid/
# Event page at the root, as on the live site.
check 200 /the-eureka/
# An ordinary story and a static page.
check 200 /encipher-downs-stunning-line-up/
check 200 /privacy-policy/
# Nothing there at all.
check 404 /no-such-page-$RANDOM/

exit $fail
