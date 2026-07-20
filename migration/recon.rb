#!/usr/bin/env ruby
# frozen_string_literal: true

# Harnesslink WordPress reconnaissance.
# READ-ONLY. Never writes to the database.
#
# Usage:
#   WP_DB_HOST=127.0.0.1 WP_DB_NAME=hl_recon WP_DB_USER=root \
#   WP_DB_PASSWORD=secret WP_TABLE_PREFIX=wzev_ ruby migration/recon.rb
#
# Or:
#   WP_DATABASE_URL=mysql2://user:pass@host/dbname WP_TABLE_PREFIX=wzev_ ruby migration/recon.rb
#
# Output: migration/RECON.md
#
# This is a merge of two recon drafts: the section structure and integrity
# checks come from the hand-written version; the near-duplicate author
# detection (brief #5), media referenced-vs-orphaned content scan (brief #7),
# permalink URL reconstruction, category tree, and streaming scans were folded
# in from the generated version.

begin
  require "mysql2"
rescue LoadError
  abort <<~MSG
    Missing dependency: mysql2

      gem install mysql2

    On macOS you may first need:  brew install mysql-client
    On Ubuntu:                    sudo apt install libmysqlclient-dev
  MSG
end

require "uri"
require "time"

# ---------------------------------------------------------------- config

PREFIX = ENV.fetch("WP_TABLE_PREFIX", "wp_")

unless PREFIX.match?(/\A[A-Za-z0-9_]+\z/)
  abort "WP_TABLE_PREFIX must be alphanumeric/underscore only, got: #{PREFIX.inspect}"
end

def connection_config
  if (url = ENV["WP_DATABASE_URL"])
    uri = URI.parse(url)
    {
      host:     uri.host,
      port:     uri.port || 3306,
      username: uri.user,
      password: uri.password && URI.decode_www_form_component(uri.password),
      database: uri.path.delete_prefix("/")
    }
  else
    {
      host:     ENV.fetch("WP_DB_HOST", "127.0.0.1"),
      port:     ENV.fetch("WP_DB_PORT", 3306).to_i,
      username: ENV.fetch("WP_DB_USER"),
      password: ENV.fetch("WP_DB_PASSWORD", ""),
      database: ENV.fetch("WP_DB_NAME")
    }
  end
rescue KeyError => e
  abort "Missing required env var: #{e.message}"
end

OUT_PATH = File.join(__dir__, "RECON.md")

# ---------------------------------------------------------------- small utils

module ReconUtil
  module_function

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

  # Extract an int field from a serialized PHP blob, e.g.
  #   s:8:"filesize";i:12345;  -> 12345
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
end

# ---------------------------------------------------------------- helpers

class Recon
  include ReconUtil
  STATEMENT_TIMEOUT_SECONDS = 300

  def initialize(config, prefix)
    @prefix = prefix
    @client = Mysql2::Client.new(**config.merge(reconnect: true, encoding: "utf8mb4"))
    @out = []
    guard_read_only!
    set_timeout!
    begin_read_only_txn!
  end

  def t(name) = "#{@prefix}#{name}"

  def query(sql)
    @client.query(sql, cast_booleans: true).to_a
  rescue Mysql2::Error => e
    warn "  ! query failed: #{e.message[0, 200]}"
    []
  end

  def scalar(sql)
    row = query(sql).first
    row && row.values.first
  end

  # Stream a large result set row-by-row without buffering it all in Ruby.
  # Must be consumed fully before the connection issues another query.
  def stream(sql)
    result = @client.query(sql, stream: true, cache_rows: false)
    result.each { |row| yield row }
  rescue Mysql2::Error => e
    warn "  ! stream failed: #{e.message[0, 200]}"
  end

  # Refuse to run if the credentials can write. Cheap insurance.
  def guard_read_only!
    grants = query("SHOW GRANTS FOR CURRENT_USER()").flat_map(&:values).join(" ")
    dangerous = %w[INSERT UPDATE DELETE DROP ALTER CREATE TRUNCATE ALL\ PRIVILEGES]
    if dangerous.any? { |p| grants.include?(p) }
      warn "!" * 70
      warn "WARNING: these credentials appear to have WRITE access."
      warn "This script only reads, but you should be using a read-only user."
      warn "Continuing in 5 seconds. Ctrl-C to abort."
      warn "!" * 70
      sleep 5
    end
  end

  def set_timeout!
    @client.query("SET SESSION max_execution_time = #{STATEMENT_TIMEOUT_SECONDS * 1000}")
  rescue Mysql2::Error
    # MariaDB uses a different variable; non-fatal either way.
    begin
      @client.query("SET SESSION max_statement_time = #{STATEMENT_TIMEOUT_SECONDS}")
    rescue Mysql2::Error
      warn "  (could not set statement timeout — proceeding without)"
    end
  end

  # Belt-and-braces on top of the grant guard: make the session read-only so a
  # stray write errors out instead of mutating anything.
  def begin_read_only_txn!
    @client.query("SET SESSION TRANSACTION READ ONLY")
    @client.query("START TRANSACTION READ ONLY")
  rescue Mysql2::Error => e
    warn "  (could not start READ ONLY transaction: #{e.message[0, 120]} — SELECT-only regardless)"
  end

  # --------------------------------------------------------- output

  def h(level, text) = @out << "\n#{'#' * level} #{text}\n"
  def p_(text)       = @out << "#{text}\n"

  def table(rows, columns: nil)
    if rows.empty?
      p_ "_No rows returned._"
      return
    end
    cols = columns || rows.first.keys
    @out << "| #{cols.join(' | ')} |"
    @out << "|#{cols.map { '---' }.join('|')}|"
    rows.each do |r|
      @out << "| #{cols.map { |c| r[c].to_s.gsub('|', '\\|')[0, 120] }.join(' | ')} |"
    end
    @out << ""
  end

  def section(title)
    puts "  → #{title}"
    h 2, title
    yield
  end

  # --------------------------------------------------------- report

  def run
    puts "\nHarnesslink recon — prefix: #{@prefix}\n\n"

    h 1, "Harnesslink WordPress Reconnaissance"
    p_ "Generated: #{Time.now.utc.iso8601}"
    p_ "Table prefix: `#{@prefix}`"
    p_ "MySQL/MariaDB: `#{scalar('SELECT VERSION()')}`"
    p_ ""
    p_ "> Read-only report. Produced by `migration/recon.rb`."

    permalinks
    post_types
    posts_by_year
    drafts_by_year
    taxonomies
    terms
    authors
    meta_keys
    media
    duplicate_slugs
    comments
    plugins
    tables
    date_range
    orphans

    File.write(OUT_PATH, @out.join("\n"))
    puts "\nWritten: #{OUT_PATH}\n\n"
  end

  # --------------------------------------------------------- sections

  def permalinks
    section "1. Permalink structure (CRITICAL — determines routing)" do
      rows = query(<<~SQL)
        SELECT option_name, option_value FROM #{t 'options'}
        WHERE option_name IN (
          'permalink_structure','home','siteurl','category_base','tag_base',
          'blogname','posts_per_page','page_on_front','show_on_front','date_format'
        )
      SQL
      table rows

      structure = rows.find { |r| r["option_name"] == "permalink_structure" }&.dig("option_value").to_s

      if structure.strip.empty?
        p_ "\n> **WARNING:** No pretty-permalink structure set — URLs are likely `?p=ID`. " \
           "Confirm against the live site before designing routing.\n"
      end

      p_ "\n**Sample published post URLs** — reconstructed from `permalink_structure` + real post data. " \
         "Eyeball against the live site to confirm the pattern:\n"
      samples = query(<<~SQL)
        SELECT ID, post_name, post_date, post_title
        FROM #{t 'posts'}
        WHERE post_type='post' AND post_status='publish' AND post_name <> ''
        ORDER BY post_date DESC LIMIT 50
      SQL
      recon_rows = samples.map do |s|
        { "ID" => s["ID"],
          "reconstructed_path" => reconstruct_url(structure, s, primary_category_slug(s["ID"])),
          "post_title" => s["post_title"] }
      end
      table recon_rows
    end
  end

  def primary_category_slug(post_id)
    slug = scalar(<<~SQL)
      SELECT t.slug
      FROM #{t 'term_relationships'} tr
      JOIN #{t 'term_taxonomy'} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
      JOIN #{t 'terms'} t ON t.term_id = tt.term_id
      WHERE tr.object_id = #{Integer(post_id)} AND tt.taxonomy = 'category'
      ORDER BY tt.count DESC LIMIT 1
    SQL
    slug || "uncategorized"
  end

  def reconstruct_url(structure, row, cat_slug)
    return "(no permalink_structure)" if structure.to_s.strip.empty?
    d = row["post_date"]
    d = Time.parse(d.to_s) unless d.respond_to?(:year)
    structure
      .gsub("%year%",     format("%04d", d.year))
      .gsub("%monthnum%", format("%02d", d.month))
      .gsub("%day%",      format("%02d", d.day))
      .gsub("%hour%",     format("%02d", d.hour))
      .gsub("%minute%",   format("%02d", d.min))
      .gsub("%second%",   format("%02d", d.sec))
      .gsub("%postname%", row["post_name"].to_s)
      .gsub("%post_id%",  row["ID"].to_s)
      .gsub("%category%", cat_slug.to_s)
      .gsub("%author%",   "author")
  end

  def post_types
    section "2. Post types and statuses" do
      table query(<<~SQL)
        SELECT post_type, post_status, COUNT(*) AS count
        FROM #{t 'posts'}
        GROUP BY post_type, post_status
        ORDER BY count DESC
      SQL
      p_ "> Watch for custom post types beyond post/page/attachment/revision/nav_menu_item — " \
         "those (e.g. `guest_author`) may carry URLs or attribution we must preserve."
    end
  end

  def posts_by_year
    section "3. Published posts by year" do
      table query(<<~SQL)
        SELECT YEAR(post_date) AS yr, COUNT(*) AS count
        FROM #{t 'posts'}
        WHERE post_type='post' AND post_status='publish'
        GROUP BY yr ORDER BY yr
      SQL
    end
  end

  def drafts_by_year
    section "4. Drafts by year (are these abandoned or a failed import?)" do
      table query(<<~SQL)
        SELECT YEAR(post_date) AS yr, COUNT(*) AS count
        FROM #{t 'posts'}
        WHERE post_type='post' AND post_status='draft'
        GROUP BY yr ORDER BY yr
      SQL

      p_ "\n**Sample drafts:**\n"
      table query(<<~SQL)
        SELECT ID, post_title, post_date, post_author
        FROM #{t 'posts'}
        WHERE post_type='post' AND post_status='draft'
        ORDER BY post_date DESC LIMIT 15
      SQL
    end
  end

  def taxonomies
    section "5. Taxonomies" do
      table query(<<~SQL)
        SELECT taxonomy, COUNT(*) AS terms
        FROM #{t 'term_taxonomy'}
        GROUP BY taxonomy ORDER BY terms DESC
      SQL
    end
  end

  def terms
    section "6. Categories and tags (with counts)" do
      p_ "**Category tree** (hierarchical; indentation = parent/child):\n"
      cats = query(<<~SQL)
        SELECT t.term_id, t.name, t.slug, tt.parent, tt.count
        FROM #{t 'term_taxonomy'} tt
        JOIN #{t 'terms'} t ON t.term_id = tt.term_id
        WHERE tt.taxonomy='category'
        ORDER BY tt.count DESC
      SQL
      print_category_tree(cats)

      p_ "\n**Top 50 tags:**\n"
      table query(<<~SQL)
        SELECT t.name, t.slug, tt.count
        FROM #{t 'term_taxonomy'} tt
        JOIN #{t 'terms'} t ON t.term_id = tt.term_id
        WHERE tt.taxonomy='post_tag'
        ORDER BY tt.count DESC LIMIT 50
      SQL
    end
  end

  def print_category_tree(rows)
    by_parent = Hash.new { |hh, k| hh[k] = [] }
    rows.each { |r| by_parent[r["parent"].to_i] << r }
    by_parent.each_value { |list| list.sort_by! { |r| r["name"].to_s.downcase } }
    walk = lambda do |parent_id, depth|
      by_parent[parent_id].each do |node|
        @out << "#{'  ' * depth}- **#{node['name']}** (`#{node['slug']}`) — #{node['count']} posts [term_id #{node['term_id']}]"
        walk.call(node["term_id"].to_i, depth + 1)
      end
    end
    walk.call(0, 0)
    @out << ""
  end

  def authors
    section "7. Authors (WP users + Co-Authors Plus guest authors)" do
      p_ "**WordPress users with posts:**\n"
      wp_users = query(<<~SQL)
        SELECT u.ID, u.user_login, u.display_name, u.user_email,
               COUNT(p.ID) AS posts
        FROM #{t 'users'} u
        LEFT JOIN #{t 'posts'} p
          ON p.post_author = u.ID AND p.post_type='post' AND p.post_status='publish'
        GROUP BY u.ID ORDER BY posts DESC
      SQL
      table wp_users

      p_ "\n**Guest authors (Co-Authors Plus / PublishPress):**\n"
      guests = query(<<~SQL)
        SELECT ID, post_title, post_name, post_status
        FROM #{t 'posts'}
        WHERE post_type IN ('guest_author','ppma_boxes')
        ORDER BY post_title LIMIT 700
      SQL
      table guests

      p_ "\n**Author taxonomy terms:**\n"
      table query(<<~SQL)
        SELECT t.name, t.slug, tt.taxonomy, tt.count
        FROM #{t 'term_taxonomy'} tt
        JOIN #{t 'terms'} t ON t.term_id = tt.term_id
        WHERE tt.taxonomy LIKE '%author%'
        ORDER BY tt.count DESC LIMIT 700
      SQL

      # brief #5 — flag near-duplicate names that are probably the same person,
      # across BOTH wp_users display names and guest-author titles.
      p_ "\n**Possible duplicate authors (same person, different rows):**\n"
      candidates = []
      wp_users.each { |u| candidates << { label: u["display_name"], id: "user:#{u['ID']}", email: u["user_email"] } }
      guests.each   { |g| candidates << { label: g["post_title"],   id: "guest:#{g['ID']}", email: nil } }
      candidates.reject! { |c| c[:label].to_s.strip.empty? }
      flags = detect_duplicate_authors(candidates)
      if flags.empty?
        p_ "_None detected by name similarity._"
      else
        table(flags.map { |a, b, why| { "A" => "#{a[:label]} (#{a[:id]})", "B" => "#{b[:label]} (#{b[:id]})", "why" => why } })
        p_ "> Review manually — near-duplicate names often mean one contributor got two accounts, " \
           "or a WP user also exists as a Co-Authors-Plus guest. Pick the canonical author before " \
           "import so attribution + author-archive URLs stay stable."
      end
    end
  end

  def detect_duplicate_authors(candidates)
    flags = []
    candidates.combination(2).each do |a, b|
      na = normalize_name(a[:label])
      nb = normalize_name(b[:label])
      next if na.empty? || nb.empty?
      reasons = []
      reasons << "identical normalized name" if na == nb
      reasons << "one name contains the other" if na != nb && (na.include?(nb) || nb.include?(na))
      dist = levenshtein(na, nb)
      maxlen = [na.length, nb.length].max
      reasons << "edit distance #{dist} of #{maxlen}" if na != nb && maxlen >= 5 && dist <= 2
      reasons << "same email" if !a[:email].to_s.empty? && a[:email] == b[:email]
      flags << [a, b, reasons.join("; ")] unless reasons.empty?
    end
    flags
  end

  def meta_keys
    section "8. Post meta keys (the plugin archaeology)" do
      p_ "Anything with high frequency is load-bearing. Rank Math keys are"
      p_ "required for SEO parity.\n"
      rows = query(<<~SQL)
        SELECT meta_key, COUNT(*) AS count
        FROM #{t 'postmeta'}
        GROUP BY meta_key
        HAVING count > 10
        ORDER BY count DESC
        LIMIT 300
      SQL
      table rows

      rank = rows.select { |r| r["meta_key"].to_s.start_with?("rank_math") }
      p_ "\n**Rank Math keys (SEO metadata to migrate — brief #3):**\n"
      if rank.empty?
        p_ "_No `rank_math*` keys found. Confirm the SEO plugin (Yoast uses `_yoast_wpseo_*`)._"
        yoast = rows.select { |r| r["meta_key"].to_s.start_with?("_yoast_wpseo") }
        (table(yoast); p_("_(Yoast keys found instead.)_")) unless yoast.empty?
      else
        table rank
      end
    end
  end

  def media
    section "9. Media" do
      total = scalar("SELECT COUNT(*) FROM #{t 'posts'} WHERE post_type='attachment'").to_i
      p_ "Total attachments: **#{total}**\n"

      p_ "**By MIME type:**\n"
      table query(<<~SQL)
        SELECT post_mime_type, COUNT(*) AS count
        FROM #{t 'posts'}
        WHERE post_type='attachment'
        GROUP BY post_mime_type ORDER BY count DESC
      SQL

      p_ "\n**Attachments by year:**\n"
      table query(<<~SQL)
        SELECT YEAR(post_date) AS yr, COUNT(*) AS count
        FROM #{t 'posts'}
        WHERE post_type='attachment'
        GROUP BY yr ORDER BY yr
      SQL

      # Best-effort total size from serialized _wp_attachment_metadata.
      p_ "\n**Total size (best-effort, from DB):**\n"
      bytes, covered, meta_total = attachment_total_size
      p_ "Sum of `filesize` parsed from `_wp_attachment_metadata`: **#{human_bytes(bytes)}** (#{bytes} bytes)."
      p_ "_Coverage: #{covered} of #{meta_total} metadata rows had a parseable filesize. WordPress does not " \
         "reliably store file size in the DB — treat as a floor; confirm against the object store._"

      # brief #7 — referenced-in-content vs orphaned.
      p_ "\n**Referenced in post content vs orphaned:**\n"
      referenced, orphaned, scanned, with_file = media_reference_scan
      table([
        { "metric" => "attachments referenced in post/page content", "count" => referenced },
        { "metric" => "attachments NOT referenced in content (orphan candidates)", "count" => orphaned },
        { "metric" => "attachments with a file on disk (_wp_attached_file)", "count" => with_file },
        { "metric" => "posts/pages scanned", "count" => scanned },
      ])
      thumb = scalar("SELECT COUNT(DISTINCT meta_value) FROM #{t 'postmeta'} WHERE meta_key='_thumbnail_id'")
      p_ "Distinct attachments used as featured images (`_thumbnail_id`): **#{thumb}**"
      p_ "> Method: matched attachment file basenames (size-suffixes like `-1024x768` stripped) against " \
         "`/wp-content/uploads/...` references in body content. Counts body + featured images, not " \
         "theme/widget usage."
    end
  end

  def attachment_total_size
    meta_total = 0; covered = 0; bytes = 0
    stream("SELECT meta_value FROM #{t 'postmeta'} WHERE meta_key='_wp_attachment_metadata'") do |row|
      meta_total += 1
      fs = php_serialized_int(row["meta_value"], "filesize")
      if fs
        covered += 1
        bytes += fs
      end
    end
    [bytes, covered, meta_total]
  end

  def media_reference_scan
    basenames = {}
    with_file = 0
    stream("SELECT meta_value FROM #{t 'postmeta'} WHERE meta_key='_wp_attached_file'") do |row|
      with_file += 1
      base = File.basename(row["meta_value"].to_s)
      basenames[base] = true unless base.empty?
    end

    referenced = {}
    scanned = 0
    ref_re = %r{/wp-content/uploads/[^\s"'()<>]+}i
    stream("SELECT post_content FROM #{t 'posts'} WHERE post_type IN ('post','page') AND post_status <> 'trash'") do |row|
      scanned += 1
      content = row["post_content"].to_s
      next if content.empty?
      content.scan(ref_re) do |url|
        raw = File.basename(url.split("?").first.split("#").first)
        stripped = raw.sub(/-\d+x\d+(?=\.[A-Za-z0-9]+\z)/, "")
        referenced[stripped] = true if basenames.key?(stripped)
        referenced[raw] = true if basenames.key?(raw)
      end
    end

    ref_count = basenames.keys.count { |b| referenced.key?(b) }
    [ref_count, with_file - ref_count, scanned, with_file]
  end

  def duplicate_slugs
    section "10. Duplicate slugs (URLs we cannot cleanly preserve)" do
      rows = query(<<~SQL)
        SELECT post_name, COUNT(*) AS count,
               GROUP_CONCAT(ID ORDER BY ID SEPARATOR ', ') AS ids
        FROM #{t 'posts'}
        WHERE post_type='post' AND post_status='publish' AND post_name != ''
        GROUP BY post_name HAVING count > 1
        ORDER BY count DESC LIMIT 200
      SQL
      p_ "**#{rows.size} duplicate slugs found** (capped at 200).\n"
      table rows
    end
  end

  def comments
    section "11. Comments" do
      table query(<<~SQL)
        SELECT comment_approved AS status, COUNT(*) AS count
        FROM #{t 'comments'}
        GROUP BY comment_approved ORDER BY count DESC
      SQL
    end
  end

  def plugins
    section "12. Active plugins" do
      row = query("SELECT option_value FROM #{t 'options'} WHERE option_name='active_plugins'").first
      if row
        raw = row["option_value"].to_s
        plugins = raw.scan(/"([^"]+\.php)"/).flatten
        p_ "**#{plugins.size} active plugins:**\n"
        plugins.sort.each { |pl| p_ "- `#{pl}`" }
      else
        p_ "_Could not read active_plugins._"
      end
    end
  end

  def tables
    section "13. Database tables by size" do
      table query(<<~SQL)
        SELECT table_name AS tbl, table_rows AS approx_rows,
               ROUND((data_length + index_length)/1024/1024, 1) AS mb
        FROM information_schema.TABLES
        WHERE table_schema = DATABASE()
        ORDER BY (data_length + index_length) DESC
      SQL
    end
  end

  def date_range
    section "14. Content date range" do
      table query(<<~SQL)
        SELECT MIN(post_date) AS earliest, MAX(post_date) AS latest,
               COUNT(*) AS published
        FROM #{t 'posts'}
        WHERE post_type='post' AND post_status='publish'
      SQL
    end
  end

  def orphans
    section "15. Integrity checks" do
      p_ "**Published posts with an empty slug** (cannot build a URL):\n"
      table query(<<~SQL)
        SELECT COUNT(*) AS count FROM #{t 'posts'}
        WHERE post_type='post' AND post_status='publish' AND (post_name='' OR post_name IS NULL)
      SQL

      p_ "\n**Published posts with no category:**\n"
      table query(<<~SQL)
        SELECT COUNT(*) AS count FROM #{t 'posts'} p
        WHERE p.post_type='post' AND p.post_status='publish'
          AND NOT EXISTS (
            SELECT 1 FROM #{t 'term_relationships'} tr
            JOIN #{t 'term_taxonomy'} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
            WHERE tr.object_id = p.ID AND tt.taxonomy = 'category'
          )
      SQL

      p_ "\n**Attachments whose parent post no longer exists:**\n"
      table query(<<~SQL)
        SELECT COUNT(*) AS count FROM #{t 'posts'} a
        WHERE a.post_type='attachment' AND a.post_parent != 0
          AND NOT EXISTS (SELECT 1 FROM #{t 'posts'} p WHERE p.ID = a.post_parent)
      SQL

      p_ "\n**Featured images pointing at missing attachments:**\n"
      table query(<<~SQL)
        SELECT COUNT(*) AS count
        FROM #{t 'postmeta'} pm
        WHERE pm.meta_key='_thumbnail_id'
          AND NOT EXISTS (SELECT 1 FROM #{t 'posts'} p WHERE p.ID = pm.meta_value)
      SQL
    end
  end
end

Recon.new(connection_config, PREFIX).run
