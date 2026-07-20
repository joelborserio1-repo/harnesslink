#!/usr/bin/env ruby
# frozen_string_literal: true

# migration/recon.rb
#
# READ-ONLY reconnaissance of a WordPress database.
#
# This script NEVER writes to the database. It opens a read-only transaction,
# issues only SELECTs, and emits a markdown report to migration/RECON.md.
# It is deliberately standalone (no Rails, no ActiveRecord) so it can be run
# against a read-only replica before any application code exists.
#
# Requirements:
#   gem install mysql2      # the only dependency
#
# Usage:
#   # Point it at a READ-ONLY copy/replica. Never production write creds.
#   WP_DB_HOST=127.0.0.1 \
#   WP_DB_PORT=3306 \
#   WP_DB_NAME=harnesslink \
#   WP_DB_USER=readonly \
#   WP_DB_PASSWORD=secret \
#   WP_TABLE_PREFIX=wp_ \
#   ruby migration/recon.rb
#
#   # Or with a single URL:
#   WP_DATABASE_URL="mysql2://readonly:secret@127.0.0.1:3306/harnesslink" \
#   ruby migration/recon.rb
#
# Options (env):
#   WP_TABLE_PREFIX   default "wp_"
#   WP_DB_SSL         "1" to require SSL
#   RECON_OUT         output path, default "migration/RECON.md"
#   RECON_SAMPLE      number of sample URLs to reconstruct, default 50
#   RECON_SKIP_MEDIA_SCAN  "1" to skip the (heavier) content-reference media scan
#
# What it reports (see the task brief):
#   1.  Permalink structure + reconstructed sample post URLs
#   2.  Post counts by post_type, post_status, and by year
#   3.  All distinct post_type values
#   4.  Category + tag taxonomy trees (counts, slugs, hierarchy)
#   5.  Authors: ids, display names, post counts, near-duplicate flags
#   6.  wp_postmeta: distinct meta_key frequencies (Rank Math etc.)
#   7.  Media: count, size (best-effort from DB), MIME types, referenced vs orphaned
#   8.  Duplicate slugs
#   9.  Comment counts by status
#   10. Date range of published content

require "time"

begin
  require "mysql2"
rescue LoadError
  abort <<~MSG
    [recon] The 'mysql2' gem is required but not installed.
        gem install mysql2
    (This is the only dependency. See the header of this file.)
  MSG
end

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

module Recon
  OUT_PATH        = ENV.fetch("RECON_OUT", "migration/RECON.md")
  SAMPLE_SIZE     = Integer(ENV.fetch("RECON_SAMPLE", "50"))
  SKIP_MEDIA_SCAN = ENV["RECON_SKIP_MEDIA_SCAN"] == "1"

  # Table prefix is operator-supplied config, but validate it hard because it
  # is interpolated into SQL. Anything outside [A-Za-z0-9_] is rejected.
  def self.table_prefix
    tp = ENV.fetch("WP_TABLE_PREFIX", "wp_")
    unless tp.match?(/\A[A-Za-z0-9_]+\z/)
      abort "[recon] WP_TABLE_PREFIX #{tp.inspect} is invalid (expected [A-Za-z0-9_]+)."
    end
    tp
  end

  def self.connect
    if (url = ENV["WP_DATABASE_URL"])
      require "uri"
      u = URI.parse(url)
      opts = {
        host:     u.host,
        port:     u.port || 3306,
        username: u.user,
        password: u.password && URI.decode_www_form_component(u.password),
        database: u.path.sub(%r{\A/}, ""),
      }
    else
      opts = {
        host:     ENV.fetch("WP_DB_HOST", "127.0.0.1"),
        port:     Integer(ENV.fetch("WP_DB_PORT", "3306")),
        username: ENV.fetch("WP_DB_USER") { abort "[recon] set WP_DB_USER (or WP_DATABASE_URL)" },
        password: ENV["WP_DB_PASSWORD"],
        database: ENV.fetch("WP_DB_NAME") { abort "[recon] set WP_DB_NAME (or WP_DATABASE_URL)" },
      }
    end
    opts[:sslmode]  = :required if ENV["WP_DB_SSL"] == "1"
    opts[:encoding] = "utf8mb4"
    opts[:reconnect] = false

    client = Mysql2::Client.new(**opts)
    # Belt and braces: make the whole session read-only so a stray write errors.
    begin
      client.query("SET SESSION TRANSACTION READ ONLY")
      client.query("START TRANSACTION READ ONLY")
    rescue Mysql2::Error => e
      warn "[recon] warning: could not start a READ ONLY transaction (#{e.message}). Continuing; SELECT-only."
    end
    client
  rescue Mysql2::Error => e
    abort "[recon] could not connect: #{e.message}"
  end
end

# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

class DB
  def initialize(client, prefix)
    @client = client
    @prefix = prefix
  end

  # Interpolate the validated table prefix. %-placeholders let us write
  # readable SQL: q("SELECT * FROM %{posts}")
  def q(sql, as: :hash)
    resolved = format_tables(sql)
    @client.query(resolved, as: as, cast: true, symbolize_keys: (as == :hash))
  end

  def scalar(sql)
    row = q(sql, as: :array).first
    row && row.first
  end

  def escape(str)
    @client.escape(str.to_s)
  end

  def table(name) = "#{@prefix}#{name}"

  private

  def format_tables(sql)
    sql.gsub(/%\{(\w+)\}/) { table(Regexp.last_match(1)) }
  end
end

# Pure-Ruby Levenshtein for author near-duplicate detection (few dozen names).
def levenshtein(a, b)
  a = a.to_s; b = b.to_s
  return b.length if a.empty?
  return a.length if b.empty?
  prev = (0..b.length).to_a
  a.each_char.with_index do |ca, i|
    cur = [i + 1]
    b.each_char.with_index do |cb, j|
      cost = ca == cb ? 0 : 1
      cur << [prev[j + 1] + 1, cur[j] + 1, prev[j] + cost].min
    end
    prev = cur
  end
  prev.last
end

def normalize_name(name)
  name.to_s.downcase.gsub(/[^a-z0-9]+/, " ").strip.squeeze(" ")
end

# Best-effort extraction of an integer field from a serialized PHP string,
# e.g. s:8:"filesize";i:12345;  -> 12345
def php_serialized_int(blob, key)
  return nil unless blob
  m = blob.match(/s:\d+:"#{Regexp.escape(key)}";i:(\d+);/)
  m && m[1].to_i
end

def human_bytes(n)
  return "unknown" if n.nil?
  units = %w[B KB MB GB TB]
  size = n.to_f
  i = 0
  while size >= 1024 && i < units.length - 1
    size /= 1024
    i += 1
  end
  format("%.2f %s", size, units[i])
end

# ---------------------------------------------------------------------------
# Report builder
# ---------------------------------------------------------------------------

class Report
  def initialize
    @lines = []
  end

  def h1(t) = @lines << "# #{t}\n"
  def h2(t) = @lines << "\n## #{t}\n"
  def h3(t) = @lines << "\n### #{t}\n"
  def p(t)  = @lines << "#{t}\n"
  def raw(t) = @lines << t
  def blank = @lines << ""

  def table(headers, rows)
    @lines << "| #{headers.join(' | ')} |"
    @lines << "| #{headers.map { '---' }.join(' | ')} |"
    rows.each { |r| @lines << "| #{r.map { |c| md_cell(c) }.join(' | ')} |" }
    @lines << ""
  end

  def to_s = @lines.join("\n") + "\n"

  private

  def md_cell(c)
    c.to_s.gsub("|", "\\|").gsub("\n", " ").strip
  end
end

# ---------------------------------------------------------------------------
# Recon sections
# ---------------------------------------------------------------------------

class Recon::Run
  def initialize(db, report)
    @db = db
    @r  = report
  end

  def call
    @r.h1("Harnesslink — WordPress Recon Report")
    @r.p("_Read-only inspection. Generated by `migration/recon.rb`._")
    @r.p("Table prefix: `#{@db.table('')}`  ·  MySQL/MariaDB: `#{@db.scalar('SELECT VERSION()')}`")
    @r.p("Sample size for URL reconstruction: #{Recon::SAMPLE_SIZE}")

    section_permalinks
    section_post_counts
    section_post_types
    section_taxonomy
    section_authors
    section_postmeta
    section_media
    section_duplicate_slugs
    section_comments
    section_date_range
    section_notes
  end

  # --- 1. Permalink structure ------------------------------------------------
  def section_permalinks
    @r.h2("1. Permalink structure")

    structure = @db.scalar("SELECT option_value FROM %{options} WHERE option_name = 'permalink_structure'")
    siteurl   = @db.scalar("SELECT option_value FROM %{options} WHERE option_name = 'siteurl'")
    home      = @db.scalar("SELECT option_value FROM %{options} WHERE option_name = 'home'")
    cat_base  = @db.scalar("SELECT option_value FROM %{options} WHERE option_name = 'category_base'")
    tag_base  = @db.scalar("SELECT option_value FROM %{options} WHERE option_name = 'tag_base'")

    @r.table(%w[option value], [
      ["permalink_structure", structure.nil? ? "(empty — plain ?p=ID permalinks!)" : "`#{structure}`"],
      ["siteurl", siteurl],
      ["home", home],
      ["category_base", cat_base.to_s.empty? ? "(default: /category/)" : "`#{cat_base}`"],
      ["tag_base", tag_base.to_s.empty? ? "(default: /tag/)" : "`#{tag_base}`"],
    ])

    if structure.nil? || structure.strip.empty?
      @r.p("> **WARNING:** No pretty-permalink structure is set. URLs are likely `?p=ID`. " \
           "Confirm against the live site before designing routing.")
      return
    end

    @r.p("Reconstructed sample post URLs (built from `permalink_structure` + real post data). " \
         "Eyeball these against the live site to confirm the pattern:")

    rows = @db.q(<<~SQL)
      SELECT p.ID, p.post_name, p.post_date, p.post_type
      FROM %{posts} p
      WHERE p.post_status = 'publish'
        AND p.post_type = 'post'
        AND p.post_name <> ''
      ORDER BY p.post_date DESC
      LIMIT #{Recon::SAMPLE_SIZE}
    SQL

    sample = rows.map do |row|
      cat = primary_category_slug(row[:ID])
      [row[:ID], reconstruct_url(structure, row, cat)]
    end
    @r.table(%w[post_id reconstructed_path], sample)
  end

  def primary_category_slug(post_id)
    slug = @db.scalar(<<~SQL)
      SELECT t.slug
      FROM %{term_relationships} tr
      JOIN %{term_taxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
      JOIN %{terms} t ON t.term_id = tt.term_id
      WHERE tr.object_id = #{Integer(post_id)}
        AND tt.taxonomy = 'category'
      ORDER BY tt.count DESC
      LIMIT 1
    SQL
    slug || "uncategorized"
  end

  def reconstruct_url(structure, row, cat_slug)
    d = row[:post_date]
    d = Time.parse(d.to_s) unless d.respond_to?(:year)
    structure
      .gsub("%year%",     format("%04d", d.year))
      .gsub("%monthnum%", format("%02d", d.month))
      .gsub("%day%",      format("%02d", d.day))
      .gsub("%hour%",     format("%02d", d.hour))
      .gsub("%minute%",   format("%02d", d.min))
      .gsub("%second%",   format("%02d", d.sec))
      .gsub("%postname%", row[:post_name].to_s)
      .gsub("%post_id%",  row[:ID].to_s)
      .gsub("%category%", cat_slug.to_s)
      .gsub("%author%",   "author")
  end

  # --- 2. Post counts --------------------------------------------------------
  def section_post_counts
    @r.h2("2. Post counts")

    @r.h3("By post_type × post_status")
    rows = @db.q(<<~SQL)
      SELECT post_type, post_status, COUNT(*) AS n
      FROM %{posts}
      GROUP BY post_type, post_status
      ORDER BY post_type, n DESC
    SQL
    @r.table(%w[post_type post_status count], rows.map { |x| [x[:post_type], x[:post_status], x[:n]] })

    @r.h3("Published posts by year (post_type='post')")
    rows = @db.q(<<~SQL)
      SELECT YEAR(post_date) AS yr, COUNT(*) AS n
      FROM %{posts}
      WHERE post_type = 'post' AND post_status = 'publish'
      GROUP BY yr
      ORDER BY yr
    SQL
    @r.table(%w[year count], rows.map { |x| [x[:yr], x[:n]] })
  end

  # --- 3. Distinct post types ------------------------------------------------
  def section_post_types
    @r.h2("3. Distinct post_type values")
    rows = @db.q(<<~SQL)
      SELECT post_type, COUNT(*) AS n
      FROM %{posts}
      GROUP BY post_type
      ORDER BY n DESC
    SQL
    @r.table(%w[post_type count], rows.map { |x| [x[:post_type], x[:n]] })
    @r.p("> Watch for custom post types beyond `post`/`page`/`attachment`/`revision`/`nav_menu_item` — " \
         "those may carry URLs we must preserve.")
  end

  # --- 4. Taxonomy -----------------------------------------------------------
  def section_taxonomy
    @r.h2("4. Taxonomy (categories + tags)")

    %w[category post_tag].each do |tax|
      label = tax == "category" ? "Categories" : "Tags"
      @r.h3(label)
      rows = @db.q(<<~SQL)
        SELECT t.term_id, t.name, t.slug, tt.parent, tt.count
        FROM %{term_taxonomy} tt
        JOIN %{terms} t ON t.term_id = tt.term_id
        WHERE tt.taxonomy = '#{@db.escape(tax)}'
        ORDER BY tt.count DESC
      SQL

      if tax == "category"
        print_category_tree(rows)
      else
        @r.table(%w[name slug count term_id], rows.first(200).map { |x| [x[:name], x[:slug], x[:count], x[:term_id]] })
        @r.p("_Showing up to 200 tags by count; #{rows.length} total._") if rows.length > 200
      end
    end

    @r.h3("Other taxonomies present")
    rows = @db.q(<<~SQL)
      SELECT taxonomy, COUNT(*) AS terms
      FROM %{term_taxonomy}
      GROUP BY taxonomy
      ORDER BY terms DESC
    SQL
    @r.table(%w[taxonomy term_count], rows.map { |x| [x[:taxonomy], x[:terms]] })
  end

  def print_category_tree(rows)
    by_parent = Hash.new { |h, k| h[k] = [] }
    rows.each { |r| by_parent[r[:parent].to_i] << r }
    by_parent.each_value { |list| list.sort_by! { |r| r[:name].to_s.downcase } }

    lines = []
    walk = lambda do |parent_id, depth|
      by_parent[parent_id].each do |node|
        indent = "  " * depth
        lines << "#{indent}- **#{node[:name]}** (`#{node[:slug]}`) — #{node[:count]} posts [term_id #{node[:term_id]}]"
        walk.call(node[:term_id].to_i, depth + 1)
      end
    end
    walk.call(0, 0)
    @r.raw(lines.join("\n"))
    @r.blank
  end

  # --- 5. Authors ------------------------------------------------------------
  def section_authors
    @r.h2("5. Authors")

    rows = @db.q(<<~SQL)
      SELECT u.ID, u.display_name, u.user_login, u.user_email,
             COUNT(p.ID) AS posts
      FROM %{users} u
      LEFT JOIN %{posts} p
        ON p.post_author = u.ID
       AND p.post_type = 'post'
       AND p.post_status = 'publish'
      GROUP BY u.ID, u.display_name, u.user_login, u.user_email
      ORDER BY posts DESC
    SQL

    @r.table(%w[id display_name user_login posts email],
             rows.map { |x| [x[:ID], x[:display_name], x[:user_login], x[:posts], x[:user_email]] })

    # Also: post_author IDs that reference no user row (orphaned attribution).
    orphans = @db.q(<<~SQL)
      SELECT p.post_author AS author_id, COUNT(*) AS posts
      FROM %{posts} p
      LEFT JOIN %{users} u ON u.ID = p.post_author
      WHERE p.post_type = 'post' AND p.post_status = 'publish' AND u.ID IS NULL
      GROUP BY p.post_author
    SQL
    unless orphans.empty?
      @r.h3("⚠️ Posts with author_id not present in users table")
      @r.table(%w[author_id posts], orphans.map { |x| [x[:author_id], x[:posts]] })
    end

    @r.h3("Possible duplicate authors (same person, different rows)")
    flags = detect_duplicate_authors(rows)
    if flags.empty?
      @r.p("_None detected by name similarity._")
    else
      @r.table(["author A", "author B", "why"],
               flags.map { |a, b, why| ["#{a[:display_name]} (id #{a[:ID]})", "#{b[:display_name]} (id #{b[:ID]})", why] })
      @r.p("> Review manually — near-duplicate names often mean one contributor got two accounts. " \
           "Decide the canonical author before import so attribution + archive URLs stay stable.")
    end
  end

  def detect_duplicate_authors(rows)
    named = rows.reject { |r| r[:display_name].to_s.strip.empty? }
    flags = []
    named.combination(2).each do |a, b|
      na = normalize_name(a[:display_name])
      nb = normalize_name(b[:display_name])
      next if na.empty? || nb.empty?
      reasons = []
      reasons << "identical normalized name" if na == nb
      reasons << "one name contains the other" if na != nb && (na.include?(nb) || nb.include?(na))
      dist = levenshtein(na, nb)
      maxlen = [na.length, nb.length].max
      reasons << "edit distance #{dist} of #{maxlen}" if na != nb && maxlen >= 5 && dist <= 2
      # Same email is a strong signal.
      reasons << "same email" if !a[:user_email].to_s.empty? && a[:user_email] == b[:user_email]
      flags << [a, b, reasons.join("; ")] unless reasons.empty?
    end
    flags
  end

  # --- 6. postmeta keys ------------------------------------------------------
  def section_postmeta
    @r.h2("6. wp_postmeta — distinct meta_key frequencies")
    rows = @db.q(<<~SQL)
      SELECT meta_key, COUNT(*) AS n
      FROM %{postmeta}
      GROUP BY meta_key
      ORDER BY n DESC
    SQL
    @r.table(%w[meta_key count], rows.map { |x| [x[:meta_key], x[:n]] })

    rank_math = rows.select { |x| x[:meta_key].to_s.start_with?("rank_math") }
    @r.h3("Rank Math keys (SEO metadata to migrate)")
    if rank_math.empty?
      @r.p("_No `rank_math*` keys found. Confirm the SEO plugin in use (Yoast uses `_yoast_wpseo_*`)._")
      yoast = rows.select { |x| x[:meta_key].to_s.start_with?("_yoast_wpseo") }
      unless yoast.empty?
        @r.p("Found Yoast keys instead:")
        @r.table(%w[meta_key count], yoast.map { |x| [x[:meta_key], x[:n]] })
      end
    else
      @r.table(%w[meta_key count], rank_math.map { |x| [x[:meta_key], x[:n]] })
    end
  end

  # --- 7. Media --------------------------------------------------------------
  def section_media
    @r.h2("7. Media (attachments)")

    total = @db.scalar("SELECT COUNT(*) FROM %{posts} WHERE post_type = 'attachment'")
    @r.p("Total attachments: **#{total}**")

    @r.h3("By MIME type")
    rows = @db.q(<<~SQL)
      SELECT post_mime_type AS mime, COUNT(*) AS n
      FROM %{posts}
      WHERE post_type = 'attachment'
      GROUP BY post_mime_type
      ORDER BY n DESC
    SQL
    @r.table(%w[mime_type count], rows.map { |x| [x[:mime].to_s.empty? ? "(none)" : x[:mime], x[:n]] })

    @r.h3("Total size (best-effort, from DB)")
    size_bytes, covered, meta_total = attachment_total_size
    @r.p("Sum of `filesize` fields parsed from `_wp_attachment_metadata`: **#{human_bytes(size_bytes)}** " \
         "(#{size_bytes} bytes)")
    @r.p("_Coverage: #{covered} of #{meta_total} metadata rows carried a parseable `filesize`. " \
         "WordPress does not reliably store file size in the DB — treat this as a floor and confirm " \
         "against the object store / filesystem._")

    @r.h3("Referenced vs orphaned")
    if Recon::SKIP_MEDIA_SCAN
      @r.p("_Content-reference scan skipped (RECON_SKIP_MEDIA_SCAN=1). Reporting attachment→parent linkage only._")
      linked   = @db.scalar("SELECT COUNT(*) FROM %{posts} WHERE post_type='attachment' AND post_parent <> 0")
      unlinked = total.to_i - linked.to_i
      @r.table(["metric", "count"],
               [["attached to a parent post (post_parent<>0)", linked],
                ["not attached to any parent", unlinked]])
    else
      referenced, orphaned, scanned_posts, total_att = media_reference_scan
      @r.table(["metric", "count"], [
        ["attachments referenced in post_content", referenced],
        ["attachments NOT referenced in post_content (orphan candidates)", orphaned],
        ["attachments with a filename on disk", total_att],
        ["posts scanned for references", scanned_posts],
      ])
      @r.p("> Method: collected every attachment's file basename from `_wp_attached_file`, streamed all " \
           "`post`/`page` content, extracted `/wp-content/uploads/...` references, and intersected by basename. " \
           "This counts references in body content only — not those set via theme options, widgets, or " \
           "post-meta (e.g. featured images via `_thumbnail_id`). Featured-image usage is reported separately below.")

      thumb = @db.scalar("SELECT COUNT(DISTINCT meta_value) FROM %{postmeta} WHERE meta_key = '_thumbnail_id'")
      @r.p("Distinct attachments used as featured images (`_thumbnail_id`): **#{thumb}**")
    end
  end

  def attachment_total_size
    meta_total = 0
    covered = 0
    total_bytes = 0
    stream_rows(<<~SQL) do |row|
      SELECT meta_value
      FROM %{postmeta}
      WHERE meta_key = '_wp_attachment_metadata'
    SQL
      meta_total += 1
      fs = php_serialized_int(row[:meta_value], "filesize")
      if fs
        covered += 1
        total_bytes += fs
      end
    end
    [total_bytes, covered, meta_total]
  end

  def media_reference_scan
    # 1) Build set of attachment basenames (and the count of attachments).
    basenames = {}      # basename => attachment_id (last wins; fine for presence)
    total_att = 0
    stream_rows(<<~SQL) do |row|
      SELECT pm.post_id AS att_id, pm.meta_value AS path
      FROM %{postmeta} pm
      WHERE pm.meta_key = '_wp_attached_file'
    SQL
      total_att += 1
      base = File.basename(row[:path].to_s)
      basenames[base] = row[:att_id] unless base.empty?
    end

    # 2) Stream post/page content, collect referenced basenames.
    referenced_bases = {}
    scanned_posts = 0
    ref_re = %r{/wp-content/uploads/[^\s"'()<>]+}i
    stream_rows(<<~SQL) do |row|
      SELECT post_content
      FROM %{posts}
      WHERE post_type IN ('post','page') AND post_status <> 'trash'
    SQL
      scanned_posts += 1
      content = row[:post_content].to_s
      next if content.empty?
      content.scan(ref_re) do |url|
        b = File.basename(url.split("?").first.split("#").first)
        # Strip WP size suffixes like -1024x768 so resized variants map back to the original.
        b = b.sub(/-\d+x\d+(?=\.[A-Za-z0-9]+\z)/, "")
        referenced_bases[b] = true if basenames.key?(b)
        referenced_bases[File.basename(url)] = true if basenames.key?(File.basename(url))
      end
    end

    referenced = basenames.keys.count { |b| referenced_bases.key?(b) }
    orphaned = total_att - referenced
    [referenced, orphaned, scanned_posts, total_att]
  end

  # --- 8. Duplicate slugs ----------------------------------------------------
  def section_duplicate_slugs
    @r.h2("8. Duplicate slugs")
    rows = @db.q(<<~SQL)
      SELECT post_name, post_type, COUNT(*) AS n
      FROM %{posts}
      WHERE post_status = 'publish' AND post_name <> ''
      GROUP BY post_name, post_type
      HAVING n > 1
      ORDER BY n DESC
      LIMIT 500
    SQL
    if rows.empty?
      @r.p("_No duplicate slugs among published posts._")
    else
      @r.p("Duplicate `post_name` within the same `post_type` (published). " \
           "WordPress disambiguates these by date/parent in the URL — routing must too.")
      @r.table(%w[slug post_type occurrences], rows.map { |x| [x[:post_name], x[:post_type], x[:n]] })
      @r.p("_Showing up to 500._") if rows.length >= 500
    end
  end

  # --- 9. Comments -----------------------------------------------------------
  def section_comments
    @r.h2("9. Comments by status")
    rows = @db.q(<<~SQL)
      SELECT comment_approved AS status, COUNT(*) AS n
      FROM %{comments}
      GROUP BY comment_approved
      ORDER BY n DESC
    SQL
    legend = { "1" => "approved", "0" => "unapproved/pending", "spam" => "spam", "trash" => "trash", "post-trashed" => "post-trashed" }
    @r.table(%w[status meaning count],
             rows.map { |x| [x[:status], legend[x[:status].to_s] || "?", x[:n]] })
    @r.p("_v1 does not migrate comments (out of scope), but this sizes the future job._")
  end

  # --- 10. Date range --------------------------------------------------------
  def section_date_range
    @r.h2("10. Date range of published content")
    row = @db.q(<<~SQL).first
      SELECT MIN(post_date) AS first_pub, MAX(post_date) AS last_pub, COUNT(*) AS n
      FROM %{posts}
      WHERE post_type = 'post' AND post_status = 'publish'
    SQL
    @r.table(%w[metric value], [
      ["earliest published post", row[:first_pub]],
      ["latest published post", row[:last_pub]],
      ["total published posts", row[:n]],
    ])
  end

  def section_notes
    @r.h2("Notes & caveats")
    @r.p("- This report is generated read-only; no writes were issued.")
    @r.p("- Media total size is a DB-derived floor; authoritative size comes from the object store.")
    @r.p("- Reference scan covers body content + featured images, not theme/widget usage.")
    @r.p("- Reconstructed URLs are derived from `permalink_structure`; verify against the live site.")
  end

  private

  # Stream large result sets row-by-row without buffering the whole set in Ruby.
  def stream_rows(sql)
    resolved = sql.gsub(/%\{(\w+)\}/) { @db.table(Regexp.last_match(1)) }
    client = @db.instance_variable_get(:@client)
    result = client.query(resolved, stream: true, cache_rows: false, symbolize_keys: true, as: :hash)
    result.each { |row| yield row }
  end
end

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

prefix = Recon.table_prefix
client = Recon.connect
db     = DB.new(client, prefix)
report = Report.new

warn "[recon] connected. Running read-only inspection (prefix=#{prefix})…"
Recon::Run.new(db, report).call

File.write(Recon::OUT_PATH, report.to_s)
warn "[recon] wrote #{Recon::OUT_PATH}"
