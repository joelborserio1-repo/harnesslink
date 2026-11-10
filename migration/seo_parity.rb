#!/usr/bin/env ruby
# frozen_string_literal: true

# migration/seo_parity.rb
#
# The SEO parity harness — our objective "no regression" gate (BUILD_V1 Step 4).
# For each path, it fetches the LIVE WordPress site and our NEW site and diffs
# the SEO-load-bearing fields, then writes a pass/fail report.
#
# Stdlib only (net/http, uri, json) — no gems.
#
# NOTE: run this from a machine with network access to both sites (your Mac or
# the server). The build/CI box here is network-restricted.
#
# Usage:
#   ruby migration/seo_parity.rb --paths urls.txt
#   ruby migration/seo_parity.rb --live https://harnesslink.com \
#        --new https://staging.harnesslink.com --paths urls.txt --out migration/SEO_PARITY.md
#   printf '/some-article/\n/category/usa/\n' | ruby migration/seo_parity.rb
#
# Full runs (tens of thousands of URLs): add --jsonl results.jsonl --threads 4.
# Each URL's result is appended to the JSONL as it finishes, so a rerun with the
# same file resumes where it stopped; the report is then a summary (failures
# grouped by check, with examples) instead of one table per URL.
#   ruby migration/seo_parity.rb --paths live_urls.txt --jsonl parity.jsonl \
#        --threads 4 --out SEO_PARITY.md
#   ruby migration/seo_parity.rb --jsonl parity.jsonl --report-only --out SEO_PARITY.md
#
# urls.txt: one path per line (e.g. /lexus-kody-wins.../). Blank lines/#comments ok.
#
# Exit code is non-zero if any URL fails, so it can gate CI.

require "net/http"
require "uri"
require "json"
require "optparse"
require "set"
require "cgi"

OPTS = {
  live: ENV.fetch("LIVE_BASE", "https://harnesslink.com"),
  new:  ENV.fetch("NEW_BASE", "https://staging.harnesslink.com"),
  out:  ENV.fetch("SEO_PARITY_OUT", "migration/SEO_PARITY.md"),
  paths: nil,
  word_tolerance: 0.05,
  jsonl: nil,
  threads: 1,
  report_only: false
}

OptionParser.new do |o|
  o.on("--live URL") { |v| OPTS[:live] = v.chomp("/") }
  o.on("--new URL")  { |v| OPTS[:new]  = v.chomp("/") }
  o.on("--paths FILE") { |v| OPTS[:paths] = v }
  o.on("--out FILE") { |v| OPTS[:out] = v }
  o.on("--tolerance F", Float) { |v| OPTS[:word_tolerance] = v }
  o.on("--jsonl FILE") { |v| OPTS[:jsonl] = v }
  o.on("--threads N", Integer) { |v| OPTS[:threads] = [[v, 1].max, 16].min }
  o.on("--report-only") { OPTS[:report_only] = true }
end.parse!

OPTS[:live] = OPTS[:live].chomp("/")
OPTS[:new]  = OPTS[:new].chomp("/")

def load_paths
  raw =
    if OPTS[:paths]
      File.readlines(OPTS[:paths])
    elsif !$stdin.tty?
      $stdin.readlines
    else
      ["/"]
    end
  raw.map(&:strip).reject { |l| l.empty? || l.start_with?("#") }.uniq
end

# ---------------------------------------------------------------- fetching

Fetched = Struct.new(:status, :final_url, :body, :error, keyword_init: true)

def fetch(url, limit = 6)
  return Fetched.new(status: 0, error: "too many redirects") if limit <= 0

  uri = URI.parse(url)
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = (uri.scheme == "https")
  http.open_timeout = 15
  http.read_timeout = 30

  req = Net::HTTP::Get.new(uri)
  req["User-Agent"] = "HarnesslinkSEOParity/1.0"
  res = http.request(req)

  case res
  when Net::HTTPRedirection
    loc = res["location"]
    loc = URI.join(url, loc).to_s unless loc.start_with?("http")
    fetch(loc, limit - 1)
  else
    # Net::HTTP returns bytes; treat them as UTF-8 so titles with curly quotes
    # or dashes can be compared and written to the report.
    body = res.body.to_s.dup.force_encoding(Encoding::UTF_8)
    body = body.scrub("?") unless body.valid_encoding?
    Fetched.new(status: res.code.to_i, final_url: url, body: body)
  end
rescue StandardError => e
  Fetched.new(status: 0, error: e.message)
end

# ---------------------------------------------------------------- extraction

module Norm
  module_function

  # Entities decoded, lower case, punctuation (dashes, pipes, quotes) folded to
  # spaces — so "Title - Harnesslink" and "Title | Harnesslink" compare equal;
  # the separator itself is a site-wide setting, not a per-page difference.
  def text(str)
    CGI.unescapeHTML(CGI.unescapeHTML(str.to_s))
       .tr("\u2018\u2019\u201C\u201D\u2013\u2014\u00A0", "''\"\"-- ")
       .gsub(/&[a-z#0-9]+;/i, " ")
       .downcase.gsub(/[^a-z0-9']+/, " ").gsub(/\s+/, " ").strip
  end
end

module Extract
  module_function

  def strip_tags(html)
    html.gsub(%r{<script\b[^>]*>.*?</script>}mi, " ")
        .gsub(%r{<iframe\b[^>]*>.*?</iframe>}mi, " ") # fallback text inside an iframe is never shown
        .gsub(%r{<style\b[^>]*>.*?</style>}mi, " ")
        .gsub(/<[^>]+>/, " ")
        .gsub(/\s+/, " ").strip
  end

  def title(html)
    html[%r{<title[^>]*>(.*?)</title>}mi, 1]&.strip
  end

  def meta(html, key, attr: "name")
    # tolerate attribute order (name/property before or after content)
    html[%r{<meta[^>]*#{attr}=["']#{Regexp.escape(key)}["'][^>]*content=["']([^"']*)["']}i, 1] ||
      html[%r{<meta[^>]*content=["']([^"']*)["'][^>]*#{attr}=["']#{Regexp.escape(key)}["']}i, 1]
  end

  def canonical(html)
    html[%r{<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']}i, 1] ||
      html[%r{<link[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["']}i, 1]
  end

  def h1(html)
    raw = html[%r{<h1[^>]*>(.*?)</h1>}mi, 1]
    raw && strip_tags(raw)
  end

  def h1s(html)
    html.scan(%r{<h1[^>]*>(.*?)</h1>}mi).map { |m| strip_tags(m[0]) }
  end

  def robots(html)
    meta(html, "robots").to_s.downcase.split(",").map(&:strip).reject(&:empty?).sort
  end

  # The story/page body only — not menus, sidebars or related-story cards.
  # Live: the Elementor post-content widget; new: .prose-article.
  def body_region(html)
    i = html.index("elementor-widget-theme-post-content")
    if i
      j = html.index("elementor-element elementor-element-", i + 40) || html.length
      return html[i...j]
    end
    i = html.index("prose-article")
    if i
      j = [html.index("<article", i), html.index("</article>", i)].compact.min || html.length
      return html[i...j]
    end
    nil
  end

  def paragraphs(html)
    region = body_region(html) or return nil
    # Cloudflare hides email addresses on live as "[email protected]".
    region.scan(%r{<p\b[^>]*>(.*?)</p>}mi).map { |m| Norm.text(strip_tags(m[0])).sub(/ ?email protected.*\z/, "") }.select { |t| t.length >= 40 }
  end

  def jsonld_types(html)
    types = []
    html.scan(%r{<script[^>]*type=["']application/ld\+json["'][^>]*>(.*?)</script>}mi).each do |m|
      begin
        data = JSON.parse(m[0])
        nodes = data.is_a?(Array) ? data : [data]
        nodes.each { |node| collect_types(node, types) }
      rescue JSON::ParserError
        next
      end
    end
    types.uniq
  end

  # NB: don't use Array() on a Hash — Ruby explodes it into key/value pairs.
  def collect_types(node, acc)
    return unless node.is_a?(Hash)
    acc.concat(Array(node["@type"]))
    node.each_value do |v|
      case v
      when Hash then collect_types(v, acc)
      when Array then v.each { |c| collect_types(c, acc) if c.is_a?(Hash) }
      end
    end
  end

  def main_text(html)
    region = html[%r{<article\b[^>]*>(.*?)</article>}mi, 1] ||
             html[%r{<main\b[^>]*>(.*?)</main>}mi, 1] ||
             html[%r{<body\b[^>]*>(.*?)</body>}mi, 1] ||
             html
    strip_tags(region)
  end

  def word_count(html)
    main_text(html).split(/\s+/).reject(&:empty?).length
  end

  def internal_links(html, host)
    html.scan(/<a\b[^>]*href=["']([^"']+)["']/i).flatten.count do |href|
      href.start_with?("/") || href.include?(host)
    end
  end

  def images(html)
    html.scan(/<img\b/i).length
  end

  def fields(html, host)
    {
      title: title(html),
      description: meta(html, "description"),
      canonical: canonical(html),
      h1: h1(html),
      og_title: meta(html, "og:title", attr: "property"),
      og_description: meta(html, "og:description", attr: "property"),
      og_image: meta(html, "og:image", attr: "property"),
      twitter_card: meta(html, "twitter:card"),
      jsonld_types: jsonld_types(html),
      h1s: h1s(html),
      robots: robots(html),
      paragraphs: paragraphs(html),
      text: Norm.text(strip_tags(html)),
      word_count: word_count(html),
      internal_links: internal_links(html, host),
      images: images(html)
    }
  end
end

# ---------------------------------------------------------------- comparison

def host_of(base)
  URI.parse(base).host.to_s
end

# Each check returns [label, severity(:fail/:warn/:info), ok_bool, detail]
ARTICLE_TYPES = %w[Article NewsArticle BlogPosting ReportageNewsArticle].freeze

def compare(path, live, new)
  live_host = host_of(OPTS[:live])
  new_host  = host_of(OPTS[:new])

  checks = []

  # A page that is gone/redirecting on live may be gone/redirecting on new too.
  if live.status != 200
    checks << ["status (live not 200)", :warn, new.status == live.status || new.status == 200, "live=#{live.status} new=#{new.status}"]
    return checks
  end
  checks << ["status", :fail, new.status == 200, "live=#{live.status} new=#{new.status} #{new.error}".strip]
  checks << ["no redirect on new", :warn, new.final_url.to_s.end_with?(path), "ends at #{new.final_url}"] if new.status == 200
  return checks unless new.status == 200

  lf = Extract.fields(live.body, live_host)
  nf = Extract.fields(new.body, new_host)

  checks << ["title present", :fail, !nf[:title].to_s.empty?, nf[:title].to_s[0, 80]]
  checks << ["title matches live", :warn, norm(nf[:title]) == norm(lf[:title]),
             "live=#{Norm.text(lf[:title])[0, 70].inspect} new=#{Norm.text(nf[:title])[0, 70].inspect}"]
  checks << ["meta description present", :fail, !nf[:description].to_s.empty?, ""]
  checks << ["meta description matches live", :info, norm(nf[:description]) == norm(lf[:description]),
             "live=#{Norm.text(lf[:description])[0, 60].inspect} new=#{Norm.text(nf[:description])[0, 60].inspect}"]
  checks << ["canonical present", :fail, !nf[:canonical].to_s.empty?, ""]
  if !lf[:canonical].to_s.empty?
    lc = URI.parse(lf[:canonical]).path rescue lf[:canonical]
    nc = URI.parse(nf[:canonical].to_s).path rescue nf[:canonical]
    checks << ["canonical path matches live", :fail, nf[:canonical].to_s.empty? || lc == nc, "live=#{lc} new=#{nc}"]
  end
  live_noindex = lf[:robots].include?("noindex")
  new_noindex = nf[:robots].include?("noindex")
  checks << ["indexable as on live", :fail, live_noindex == new_noindex, "live=#{lf[:robots].join(',')} new=#{nf[:robots].join(',')}"]
  checks << ["robots directives match", :warn, (lf[:robots] - nf[:robots]).empty?,
             "missing on new: #{(lf[:robots] - nf[:robots]).join(', ')}"]
  checks << ["h1 present", :fail, !nf[:h1s].empty?, ""]
  checks << ["h1 matches live", :warn, (nf[:h1s].map { |h| norm(h) } & lf[:h1s].map { |h| norm(h) }).any?,
             "live=#{lf[:h1s].map { |h| h[0, 40] }.inspect} new=#{nf[:h1s].map { |h| h[0, 40] }.inspect}"]
  %i[og_title og_description og_image].each do |k|
    label = k.to_s.sub("_", ":")
    checks << ["#{label} present", :warn, lf[k].to_s.empty? || !nf[k].to_s.empty?, ""]
  end

  if (lf[:jsonld_types] & ARTICLE_TYPES).any?
    checks << ["article JSON-LD", :fail, (nf[:jsonld_types] & ARTICLE_TYPES).any?,
               "live=#{(lf[:jsonld_types] & ARTICLE_TYPES).inspect} new=#{nf[:jsonld_types].inspect}"]
  end

  # Content: every substantial paragraph of the live story must appear on new.
  if lf[:paragraphs]&.any?
    found = lf[:paragraphs].count { |p| nf[:text].include?(p[0, 120]) }
    cov = found.to_f / lf[:paragraphs].length
    missing = lf[:paragraphs].find { |p| !nf[:text].include?(p[0, 120]) }
    checks << ["story text present (>=90% of paragraphs)", :fail, cov >= 0.9,
               "#{found}/#{lf[:paragraphs].length} paragraphs; first missing: #{missing.to_s[0, 70].inspect}"]
    checks << ["story text complete", :warn, cov == 1.0, "#{found}/#{lf[:paragraphs].length}; missing: #{missing.to_s[0, 70].inspect}"] if cov >= 0.9
  end

  checks
end

def norm(str)
  Norm.text(str)
end

def url_passed?(checks)
  checks.select { |c| c[1] == :fail }.all? { |c| c[2] }
end

# ---------------------------------------------------------------- run (full, JSONL)

def summary_report(records)
  total = records.length
  passed = records.count { |r| r["ok"] }
  by_check = Hash.new { |h, k| h[k] = [] }
  warn_check = Hash.new { |h, k| h[k] = [] }
  records.each do |r|
    (r["fails"] || []).each { |label, detail| by_check[label] << [r["path"], detail] }
    (r["warns"] || []).each { |label, detail| warn_check[label] << [r["path"], detail] }
  end
  pct = total.zero? ? 0 : (passed * 100.0 / total).round(2)
  lines = ["# SEO Parity Report", "",
           "- Live: `#{OPTS[:live]}`", "- New:  `#{OPTS[:new]}`",
           "- Checked: #{total} URLs", "",
           "**Result: #{passed}/#{total} URLs passed (#{pct}%)**", ""]
  section = lambda do |title, groups, limit|
    return if groups.empty?
    lines << "## #{title}" << ""
    lines << "| check | URLs |" << "| --- | --- |"
    groups.sort_by { |_, v| -v.length }.each { |label, v| lines << "| #{label} | #{v.length} |" }
    lines << ""
    groups.sort_by { |_, v| -v.length }.each do |label, v|
      lines << "### #{label} (#{v.length})" << ""
      v.first(limit).each { |path, detail| lines << "- `#{path}` #{detail.to_s.gsub("|", "\\|")[0, 140]}" }
      lines << "- … #{v.length - limit} more" if v.length > limit
      lines << ""
    end
  end
  section.call("Failures (must fix)", by_check, 60)
  section.call("Warnings (review)", warn_check, 25)
  lines.join("\n") + "\n"
end

def read_jsonl(file)
  return [] unless File.exist?(file)
  File.readlines(file).filter_map { |l| JSON.parse(l) rescue nil }
end

if OPTS[:jsonl]
  if OPTS[:report_only]
    records = read_jsonl(OPTS[:jsonl])
  else
    done = read_jsonl(OPTS[:jsonl]).map { |r| r["path"] }.to_set
    paths = load_paths.map { |p| p.start_with?("/") ? p : "/#{p}" }.reject { |p| done.include?(p) }
    warn "[seo_parity] live=#{OPTS[:live]} new=#{OPTS[:new]} to check=#{paths.length} (already done #{done.size}) threads=#{OPTS[:threads]}"
    queue = Queue.new
    paths.each { |p| queue << p }
    lock = Mutex.new
    count = 0
    started = Time.now
    File.open(OPTS[:jsonl], "a") do |out|
      workers = Array.new(OPTS[:threads]) do
        Thread.new do
          loop do
            path = begin
              queue.pop(true)
            rescue ThreadError
              break
            end
            live = fetch("#{OPTS[:live]}#{path}")
            new = fetch("#{OPTS[:new]}#{path}")
            checks = compare(path, live, new)
            rec = {
              path: path, ok: url_passed?(checks), live_status: live.status, new_status: new.status,
              fails: checks.select { |c| c[1] == :fail && !c[2] }.map { |c| [c[0], c[3]] },
              warns: checks.select { |c| c[1] == :warn && !c[2] }.map { |c| [c[0], c[3]] }
            }
            lock.synchronize do
              out.puts(JSON.generate(rec))
              out.flush
              count += 1
              if (count % 200).zero?
                rate = count / (Time.now - started)
                warn "  #{count}/#{paths.length}  #{rate.round(2)}/s  eta #{((paths.length - count) / rate / 3600).round(1)}h"
              end
            end
          end
        end
      end
      workers.each(&:join)
    end
    records = read_jsonl(OPTS[:jsonl])
  end
  File.write(OPTS[:out], summary_report(records))
  passed = records.count { |r| r["ok"] }
  warn "[seo_parity] #{passed}/#{records.length} passed -> wrote #{OPTS[:out]}"
  exit(passed == records.length ? 0 : 1)
end

# ---------------------------------------------------------------- run (small, one table per URL)

paths = load_paths
warn "[seo_parity] live=#{OPTS[:live]}  new=#{OPTS[:new]}  paths=#{paths.length}"

lines = []
lines << "# SEO Parity Report"
lines << ""
lines << "- Live: `#{OPTS[:live]}`"
lines << "- New:  `#{OPTS[:new]}`"
lines << "- Paths: #{paths.length}"
lines << ""

passed = 0
failed_urls = []

paths.each_with_index do |path, i|
  path = "/#{path}" unless path.start_with?("/")
  warn "  [#{i + 1}/#{paths.length}] #{path}"
  live = fetch("#{OPTS[:live]}#{path}")
  new  = fetch("#{OPTS[:new]}#{path}")
  checks = compare(path, live, new)
  ok = url_passed?(checks)
  ok ? (passed += 1) : failed_urls << path

  lines << "## #{ok ? '✅' : '❌'} `#{path}`"
  lines << ""
  lines << "| check | severity | result | detail |"
  lines << "| --- | --- | --- | --- |"
  checks.each do |label, severity, good, detail|
    mark = good ? "pass" : (severity == :fail ? "**FAIL**" : "warn")
    lines << "| #{label} | #{severity} | #{mark} | #{detail.to_s.gsub('|', '\\|')[0, 90]} |"
  end
  lines << ""
end

summary = "#{passed}/#{paths.length} URLs passed"
lines.insert(6, "**Result: #{summary}**\n")

File.write(OPTS[:out], lines.join("\n") + "\n")
warn "[seo_parity] #{summary} -> wrote #{OPTS[:out]}"
warn "[seo_parity] FAILED: #{failed_urls.join(', ')}" unless failed_urls.empty?

exit(failed_urls.empty? ? 0 : 1)
