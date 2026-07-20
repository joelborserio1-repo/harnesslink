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
# urls.txt: one path per line (e.g. /lexus-kody-wins.../). Blank lines/#comments ok.
#
# Exit code is non-zero if any URL fails, so it can gate CI.

require "net/http"
require "uri"
require "json"
require "optparse"

OPTS = {
  live: ENV.fetch("LIVE_BASE", "https://harnesslink.com"),
  new:  ENV.fetch("NEW_BASE", "https://staging.harnesslink.com"),
  out:  ENV.fetch("SEO_PARITY_OUT", "migration/SEO_PARITY.md"),
  paths: nil,
  word_tolerance: 0.05
}

OptionParser.new do |o|
  o.on("--live URL") { |v| OPTS[:live] = v.chomp("/") }
  o.on("--new URL")  { |v| OPTS[:new]  = v.chomp("/") }
  o.on("--paths FILE") { |v| OPTS[:paths] = v }
  o.on("--out FILE") { |v| OPTS[:out] = v }
  o.on("--tolerance F", Float) { |v| OPTS[:word_tolerance] = v }
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
    Fetched.new(status: res.code.to_i, final_url: url, body: res.body.to_s)
  end
rescue StandardError => e
  Fetched.new(status: 0, error: e.message)
end

# ---------------------------------------------------------------- extraction

module Extract
  module_function

  def strip_tags(html)
    html.gsub(%r{<script\b[^>]*>.*?</script>}mi, " ")
        .gsub(%r{<style\b[^>]*>.*?</style>}mi, " ")
        .gsub(/<[^>]+>/, " ")
        .gsub(/&[a-z#0-9]+;/i, " ")
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
def compare(path, live, new)
  live_host = host_of(OPTS[:live])
  new_host  = host_of(OPTS[:new])

  checks = []

  checks << ["status", :fail, new.status == 200,
             "live=#{live.status} new=#{new.status}"]

  lf = live.status == 200 ? Extract.fields(live.body, live_host) : {}
  nf = new.status == 200 ? Extract.fields(new.body, new_host) : {}

  if new.status == 200
    checks << ["title present", :fail, !nf[:title].to_s.empty?, nf[:title].to_s[0, 80]]
    checks << ["title matches live", :warn, norm(nf[:title]) == norm(lf[:title]),
               "live=#{lf[:title].to_s[0, 50].inspect} new=#{nf[:title].to_s[0, 50].inspect}"]
    checks << ["meta description present", :fail, !nf[:description].to_s.empty?, nf[:description].to_s[0, 60]]
    checks << ["canonical present", :fail, !nf[:canonical].to_s.empty?, nf[:canonical].to_s]
    checks << ["canonical == path", :warn,
               nf[:canonical].to_s.end_with?(path) || nf[:canonical].to_s.end_with?("#{path}/"),
               nf[:canonical].to_s]
    checks << ["h1 present", :fail, !nf[:h1].to_s.empty?, nf[:h1].to_s[0, 60]]
    checks << ["h1 matches live", :warn, norm(nf[:h1]) == norm(lf[:h1]),
               "live=#{lf[:h1].to_s[0, 40].inspect} new=#{nf[:h1].to_s[0, 40].inspect}"]
    checks << ["og:title present", :warn, !nf[:og_title].to_s.empty?, nf[:og_title].to_s[0, 50]]
    checks << ["og:description present", :warn, !nf[:og_description].to_s.empty?, ""]
    checks << ["og:image present", :warn, !nf[:og_image].to_s.empty?, nf[:og_image].to_s]
    checks << ["twitter:card present", :info, !nf[:twitter_card].to_s.empty?, nf[:twitter_card].to_s]

    # If live carried NewsArticle schema, new must too.
    if lf[:jsonld_types]&.include?("NewsArticle")
      checks << ["NewsArticle JSON-LD", :fail, nf[:jsonld_types].include?("NewsArticle"),
                 "new types=#{nf[:jsonld_types].inspect}"]
    else
      checks << ["JSON-LD present", :info, !nf[:jsonld_types].to_s.empty?, nf[:jsonld_types].inspect]
    end

    if lf[:word_count].to_i.positive?
      dev = (nf[:word_count].to_i - lf[:word_count].to_i).abs / lf[:word_count].to_f
      checks << ["word count within #{(OPTS[:word_tolerance] * 100).to_i}%", :fail, dev <= OPTS[:word_tolerance],
                 "live=#{lf[:word_count]} new=#{nf[:word_count]} dev=#{(dev * 100).round(1)}%"]
    else
      checks << ["word count", :info, true, "new=#{nf[:word_count]}"]
    end

    checks << ["internal links", :info, true, "live=#{lf[:internal_links]} new=#{nf[:internal_links]}"]
    checks << ["images", :info, true, "live=#{lf[:images]} new=#{nf[:images]}"]
  end

  checks
end

def norm(str)
  str.to_s.gsub(/\s+/, " ").strip.downcase
end

def url_passed?(checks)
  checks.select { |c| c[1] == :fail }.all? { |c| c[2] }
end

# ---------------------------------------------------------------- run

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
