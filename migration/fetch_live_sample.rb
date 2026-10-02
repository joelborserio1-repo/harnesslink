#!/usr/bin/env ruby
# frozen_string_literal: true

# DEV ONLY — pulls the most recent published posts from the PUBLIC WordPress
# REST API (read-only, no credentials) and writes them in the same JSON shape
# migration/export_posts.php produces, so the existing importer can load them:
#
#   ruby migration/fetch_live_sample.rb --count 200 --out tmp/live_sample.json
#   cd api && bin/rails runner \
#     'Wordpress::Importer.new(source: Wordpress::JsonSource.new(path: "../tmp/live_sample.json")).call'
#
# This is a local-preview convenience, NOT the migration. The REST API does not
# expose Rank Math meta, raw post_content or old slugs, so the authoritative
# import remains export_posts.php against the database. Two live-site quirks
# this script works around (both matter for the real migration too):
#
#   * Leaky Paywall meters per REQUEST: only the first 3 posts of a REST page
#     come back with a full body, the rest are the sign-in teaser. So we page
#     3 at a time.
#   * The REST `author` embed is unreliable: nearly every post belongs to one
#     WP user and the Molongui Authorship plugin swaps in the real byline at
#     render time. The byline the site prints is in the article page's
#     <meta name="author">, so we read it from there (one page fetch per post).

require "json"
require "net/http"
require "optparse"
require "uri"

opts = { count: 200, out: "tmp/live_sample.json", site: "https://harnesslink.com", pages: nil }
OptionParser.new do |o|
  o.on("--count N", Integer) { |v| opts[:count] = v }
  o.on("--out PATH") { |v| opts[:out] = v }
  o.on("--site URL") { |v| opts[:site] = v }
  # --pages privacy-policy,terms-conditions : fetch those static pages instead
  # of posts (load the result with Wordpress::PageImporter).
  o.on("--pages SLUGS") { |v| opts[:pages] = v.split(",") }
end.parse!

# Same editorial/geographic split as export_posts.php.
EDITORIAL = ["Top 4", "Blog", "Articles", "Podcast", "Videos"].freeze

def get_json(url)
  uri = URI(url)
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: true, read_timeout: 60) do |http|
    http.get(uri.request_uri, "User-Agent" => "harnesslink-dev-sample/1.0")
  end
  raise "HTTP #{res.code} for #{url}" unless res.is_a?(Net::HTTPSuccess)
  JSON.parse(res.body)
end

def strip_tags(html)
  html.to_s.gsub(/<[^>]+>/, "").gsub("&hellip;", "…").gsub("&#8217;", "’").gsub("&#8216;", "‘")
      .gsub("&#8220;", "“").gsub("&#8221;", "”").gsub("&#8211;", "–").gsub("&#8212;", "—")
      .gsub("&amp;", "&").gsub("&nbsp;", " ").gsub("&#038;", "&").gsub("&#36;", "$")
      .gsub(/\s+/, " ").strip
end

def to_export(post)
  embedded = post["_embedded"] || {}
  terms = (embedded["wp:term"] || []).flatten

  cats = terms.select { |t| t["taxonomy"] == "category" }.map do |t|
    { "name" => t["name"], "slug" => t["slug"], "legacy_term_id" => t["id"],
      "kind" => EDITORIAL.include?(t["name"]) ? "editorial" : "geographic" }
  end
  # A specific region first, so the primary category is "USA" rather than
  # the catch-all "International" or the editorial "Top 4".
  cats = cats.sort_by do |c|
    next 2 if c["kind"] == "editorial"
    c["name"] == "International" ? 1 : 0
  end

  tags = terms.select { |t| t["taxonomy"] == "post_tag" }.map do |t|
    { "name" => t["name"], "slug" => t["slug"], "legacy_term_id" => t["id"] }
  end

  authors = (embedded["author"] || []).select { |a| a["name"] }.map do |a|
    { "name" => a["name"], "slug" => a["slug"], "refs" => { "wp_user_id" => a["id"] } }
  end

  media = (embedded["wp:featuredmedia"] || []).first
  featured =
    if media && media["source_url"]
      details = media["media_details"] || {}
      { "legacy_id" => media["id"], "url" => media["source_url"], "width" => details["width"],
        "height" => details["height"], "alt" => media["alt_text"], "mime_type" => media["mime_type"] }
    end

  {
    "id" => post["id"],
    "post_name" => post["slug"],
    "post_title" => strip_tags(post.dig("title", "rendered")),
    "post_content" => post.dig("content", "rendered"),
    "post_excerpt" => strip_tags(post.dig("excerpt", "rendered")),
    "post_date" => "#{post['date_gmt']}Z",
    "post_modified" => "#{post['modified_gmt']}Z",
    "post_status" => post["status"],
    "post_type" => post["type"],
    "meta" => {},
    "categories" => cats,
    "tags" => tags,
    "authors" => authors,
    "old_slugs" => [],
    "featured" => featured
  }
end

if opts[:pages]
  pages = opts[:pages].flat_map do |slug|
    get_json("#{opts[:site]}/wp-json/wp/v2/pages?slug=#{slug}&_embed=1").map do |p|
      to_export(p).merge("path" => URI(p["link"]).path, "authors" => [])
    end
  end
  File.write(opts[:out], JSON.pretty_generate(pages))
  warn "wrote #{pages.size} pages to #{opts[:out]}"
  exit
end

posts = []
page = 1
per_page = 3 # see the paywall note above; constant so offsets never overlap
while posts.size < opts[:count]
  batch = get_json("#{opts[:site]}/wp-json/wp/v2/posts?per_page=#{per_page}&page=#{page}&_embed=1")
  break if batch.empty?
  posts.concat(batch.map { |p| to_export(p) })
  warn "fetched #{posts.size}/#{opts[:count]}" if (page % 10).zero?
  page += 1
  sleep 0.15 # be polite to the production site
end

posts = posts.first(opts[:count])

# Bylines: take the name the live page prints (see the note at the top).
posts.each_with_index do |p, i|
  uri = URI("#{opts[:site]}/#{p['post_name']}/")
  html = Net::HTTP.start(uri.host, uri.port, use_ssl: true, read_timeout: 60) do |http|
    http.get(uri.request_uri, "User-Agent" => "harnesslink-dev-sample/1.0").body.to_s
  end
  name = html[/<meta name="author" content="([^"]+)"/, 1]
  if name
    name = strip_tags(name)
    slug = name.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-|-\z/, "")
    p["authors"] = [{ "name" => name, "slug" => slug, "refs" => { "source" => "live_meta_author" } }]
  end
  warn "bylines #{i + 1}/#{posts.size}" if ((i + 1) % 50).zero?
  sleep 0.1
end

paywalled = posts.count { |p| p["post_content"].to_s.include?("leaky_paywall_message") }
warn "WARNING: #{paywalled} posts came back as the paywall teaser" if paywalled.positive?
File.write(opts[:out], JSON.pretty_generate(posts))
warn "wrote #{posts.size} posts to #{opts[:out]}"
