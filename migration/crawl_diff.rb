#!/usr/bin/env ruby
# frozen_string_literal: true

# migration/crawl_diff.rb
#
# The crawl-diff harness — BUILD_V1 Step 9's "no URL left behind" gate.
#
# It builds a URL inventory from the LIVE WordPress site (by walking its XML
# sitemaps) and from the NEW site, then diffs them. Every live URL must be
# either present on the new site (200) or deliberately redirected (3xx). Any
# live URL that 404s / errors on the new site is UNACCOUNTED and fails the run.
#
# It also writes a flat `live_urls.txt` (one path per line) you can feed
# straight into the SEO parity harness:
#
#   ruby migration/crawl_diff.rb --live https://harnesslink.com \
#        --new https://staging.harnesslink.com
#   ruby migration/seo_parity.rb --live https://harnesslink.com \
#        --new https://staging.harnesslink.com --paths migration/live_urls.txt
#
# Stdlib only (net/http, uri, zlib) — no gems.
#
# NOTE: run this from a machine with network access to both sites (your Mac or
# the server). The build/CI box here is network-restricted.
#
# Usage:
#   ruby migration/crawl_diff.rb --live https://harnesslink.com --new https://staging.harnesslink.com
#   ruby migration/crawl_diff.rb --live-sitemap https://harnesslink.com/sitemap_index.xml \
#        --new https://staging.harnesslink.com --limit 500
#   ruby migration/crawl_diff.rb --live-urls some_urls.txt --new https://staging...   # skip live crawl
#
# Exit code is non-zero if any live URL is unaccounted for, so it can gate CI.

require "net/http"
require "uri"
require "zlib"
require "stringio"
require "optparse"

OPTS = {
  live: ENV.fetch("LIVE_BASE", "https://harnesslink.com"),
  new:  ENV.fetch("NEW_BASE", "https://staging.harnesslink.com"),
  live_sitemap: nil,     # defaults to <live>/sitemap_index.xml
  new_sitemap: nil,      # defaults to <new>/sitemap.xml
  live_urls: nil,        # optional pre-crawled path list (skips live sitemap walk)
  out: ENV.fetch("CRAWL_DIFF_OUT", "migration/CRAWL_DIFF.md"),
  urls_out: ENV.fetch("CRAWL_URLS_OUT", "migration/live_urls.txt"),
  limit: nil,            # cap live URLs probed (nil = all). Useful for a smoke run.
  probe: true            # HTTP-probe each missing URL on new. Off = inventory diff only.
}

OptionParser.new do |o|
  o.on("--live URL") { |v| OPTS[:live] = v.chomp("/") }
  o.on("--new URL")  { |v| OPTS[:new]  = v.chomp("/") }
  o.on("--live-sitemap URL") { |v| OPTS[:live_sitemap] = v }
  o.on("--new-sitemap URL")  { |v| OPTS[:new_sitemap] = v }
  o.on("--live-urls FILE")   { |v| OPTS[:live_urls] = v }
  o.on("--out FILE")  { |v| OPTS[:out] = v }
  o.on("--urls-out FILE") { |v| OPTS[:urls_out] = v }
  o.on("--limit N", Integer) { |v| OPTS[:limit] = v }
  o.on("--no-probe") { OPTS[:probe] = false }
end.parse!

OPTS[:live] = OPTS[:live].chomp("/")
OPTS[:new]  = OPTS[:new].chomp("/")
OPTS[:live_sitemap] ||= "#{OPTS[:live]}/sitemap_index.xml"
OPTS[:new_sitemap]  ||= "#{OPTS[:new]}/sitemap.xml"

# ---------------------------------------------------------------- fetching

Fetched = Struct.new(:status, :location, :body, :error, keyword_init: true)

# Single request, no redirect following — callers decide what a 3xx means.
def http_get(url, method: Net::HTTP::Get, limit: 6)
  return Fetched.new(status: 0, error: "too many redirects") if limit <= 0

  uri = URI.parse(url)
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = (uri.scheme == "https")
  http.open_timeout = 15
  http.read_timeout = 30

  req = method.new(uri)
  req["User-Agent"] = "HarnesslinkCrawlDiff/1.0"
  req["Accept-Encoding"] = "gzip"
  res = http.request(req)

  body = res.body.to_s
  if res["content-encoding"].to_s.include?("gzip") && !body.empty?
    body = Zlib::GzipReader.new(StringIO.new(body)).read rescue body
  end
  Fetched.new(status: res.code.to_i, location: res["location"], body: body)
rescue StandardError => e
  Fetched.new(status: 0, error: e.message)
end

# Follow redirects to a terminal status — used for the live sitemap fetch only.
def fetch_follow(url, limit = 6)
  res = http_get(url)
  if res.status.between?(300, 399) && res.location && limit.positive?
    nxt = res.location.start_with?("http") ? res.location : URI.join(url, res.location).to_s
    return fetch_follow(nxt, limit - 1)
  end
  res
end

# ---------------------------------------------------------------- sitemap walk

# Returns a Set of absolute URLs. Handles sitemap indexes (nested <sitemap>),
# gzipped .xml.gz children, and plain url sets. Depth-guarded.
def crawl_sitemap(root_url, seen_maps = {}, depth = 0)
  urls = []
  return urls if depth > 4 || seen_maps[root_url]

  seen_maps[root_url] = true
  res = fetch_follow(root_url)
  unless res.status == 200 && res.body && !res.body.empty?
    warn "  [sitemap] #{root_url} -> status #{res.status} #{res.error}".rstrip
    return urls
  end

  body = res.body
  # Gzip by extension even when the server didn't set content-encoding.
  if root_url.end_with?(".gz") && body[0, 2].bytes == [0x1f, 0x8b]
    body = Zlib::GzipReader.new(StringIO.new(body)).read rescue body
  end

  locs = body.scan(%r{<loc>\s*(.*?)\s*</loc>}mi).flatten.map { |l| l.gsub(/<!\[CDATA\[|\]\]>/, "").strip }

  if body =~ /<sitemapindex/i
    # Index of sitemaps — recurse into each child.
    locs.each { |child| urls.concat(crawl_sitemap(child, seen_maps, depth + 1)) }
  else
    urls.concat(locs)
  end
  urls
end

def path_of(url)
  u = URI.parse(url)
  p = u.path.to_s
  p = "/" if p.empty?
  # Keep the trailing-slash form the permalink structure uses; ignore query.
  p
rescue URI::InvalidURIError
  nil
end

def collect_paths(sitemap_url, label)
  warn "[crawl] walking #{label} sitemap: #{sitemap_url}"
  raw = crawl_sitemap(sitemap_url)
  paths = raw.map { |u| path_of(u) }.compact.uniq.sort
  warn "[crawl] #{label}: #{paths.length} URLs"
  paths
end

# ---------------------------------------------------------------- run

live_paths =
  if OPTS[:live_urls]
    File.readlines(OPTS[:live_urls]).map(&:strip).reject { |l| l.empty? || l.start_with?("#") }.uniq.sort
  else
    collect_paths(OPTS[:live_sitemap], "live")
  end

# Always persist the live inventory for the parity harness.
File.write(OPTS[:urls_out], live_paths.join("\n") + "\n")
warn "[crawl] wrote #{live_paths.length} live paths -> #{OPTS[:urls_out]}"

new_paths = collect_paths(OPTS[:new_sitemap], "new")
new_set = new_paths.to_h { |p| [p, true] }

probe_paths = OPTS[:limit] ? live_paths.first(OPTS[:limit]) : live_paths

present   = []   # in new inventory, or probed 200
redirected = []  # probed 3xx -> [path, location]
missing   = []   # probed 404/5xx/error -> [path, status]
in_new_only = new_paths.reject { |p| live_paths.include?(p) } # new URLs with no live equivalent (info)

probe_paths.each_with_index do |path, i|
  if new_set[path]
    present << path
    next
  end

  unless OPTS[:probe]
    missing << [path, "not in new sitemap"]
    next
  end

  warn "  [probe #{i + 1}/#{probe_paths.length}] #{path}" if (i % 25).zero?
  res = http_get("#{OPTS[:new]}#{path}")
  if res.status == 200
    present << path
  elsif res.status.between?(300, 399)
    redirected << [path, res.location.to_s]
  else
    missing << [path, res.status.zero? ? "error: #{res.error}" : res.status.to_s]
  end
end

# ---------------------------------------------------------------- report

accounted = present.length + redirected.length
total = probe_paths.length
pct = total.zero? ? 100.0 : (accounted * 100.0 / total).round(2)

lines = []
lines << "# Crawl Diff Report"
lines << ""
lines << "- Live: `#{OPTS[:live]}`  (sitemap: `#{OPTS[:live_urls] || OPTS[:live_sitemap]}`)"
lines << "- New:  `#{OPTS[:new]}`  (sitemap: `#{OPTS[:new_sitemap]}`)"
lines << "- Live URLs: **#{live_paths.length}**   probed: #{total}#{OPTS[:limit] ? " (--limit #{OPTS[:limit]})" : ''}"
lines << "- Accounted for: **#{accounted}/#{total} (#{pct}%)**  —  present #{present.length}, redirected #{redirected.length}"
lines << "- **Unaccounted (FAIL): #{missing.length}**"
lines << "- New-only URLs (no live equivalent, informational): #{in_new_only.length}"
lines << ""

unless missing.empty?
  lines << "## ❌ Unaccounted-for live URLs (must fix before cutover)"
  lines << ""
  lines << "| live path | new response |"
  lines << "| --- | --- |"
  missing.each { |p, s| lines << "| `#{p}` | #{s} |" }
  lines << ""
end

unless redirected.empty?
  lines << "## ↪️ Deliberately redirected (verify these are intended)"
  lines << ""
  lines << "| live path | redirects to |"
  lines << "| --- | --- |"
  redirected.first(500).each { |p, loc| lines << "| `#{p}` | #{loc} |" }
  lines << "" << "_#{redirected.length} redirects total (showing up to 500)._" << ""
end

unless in_new_only.empty?
  lines << "## ℹ️ New-only URLs (exist on new, not in live sitemap)"
  lines << ""
  lines << "These are fine (new content, or sitemap timing), but skim for accidental dupes."
  lines << ""
  in_new_only.first(100).each { |p| lines << "- `#{p}`" }
  lines << "" << "_#{in_new_only.length} total (showing up to 100)._" << ""
end

File.write(OPTS[:out], lines.join("\n") + "\n")
warn "[crawl] #{accounted}/#{total} accounted (#{pct}%), #{missing.length} unaccounted -> wrote #{OPTS[:out]}"

exit(missing.empty? ? 0 : 1)
