# frozen_string_literal: true

module Wordpress
  # Reads posts from the legacy WordPress MySQL database (READ-ONLY) and yields
  # them as record hashes for the Importer. Batches by primary key (keyset) so
  # it scales to 60k+ rows and resumes cleanly.
  #
  # mysql2 is required only here, loaded lazily (same as migration/recon.rb), so
  # the production app doesn't depend on it. Install with: gem install mysql2
  class MysqlSource
    META_KEYS = %w[
      post_subtitle
      rank_math_title rank_math_description rank_math_focus_keyword
      rank_math_canonical_url rank_math_robots
      rank_math_facebook_title rank_math_facebook_description
      rank_math_twitter_title rank_math_twitter_description
      _molongui_main_author _thumbnail_id _elementor_data
    ].freeze
    EDITORIAL = ["Top 4", "Blog", "Articles", "Podcast", "Videos"].freeze

    def initialize(config: nil, prefix: nil, post_types: %w[post], batch_size: 500)
      begin
        require "mysql2"
      rescue LoadError
        abort "[import] the 'mysql2' gem is required. Run: gem install mysql2"
      end
      @prefix = prefix || ENV.fetch("WP_TABLE_PREFIX", "wp_")
      unless @prefix.match?(/\A[A-Za-z0-9_]+\z/)
        raise ArgumentError, "WP_TABLE_PREFIX #{@prefix.inspect} is invalid"
      end
      @client = Mysql2::Client.new(**(config || env_config))
      @client.query("SET SESSION TRANSACTION READ ONLY") rescue nil
      @post_types = post_types
      @batch_size = batch_size
      @users = {}
    end

    def each_post(after_id: 0)
      cursor = after_id.to_i
      loop do
        posts = fetch_posts(cursor)
        break if posts.empty?
        ids = posts.map { |p| p["ID"] }
        meta = meta_for(ids)
        terms = terms_for(ids)
        old_slugs = old_slugs_for(ids)

        posts.each do |p|
          yield build_record(p, meta[p["ID"]] || {}, terms[p["ID"]] || { cats: [], tags: [] }, old_slugs[p["ID"]] || [])
          cursor = p["ID"]
        end
      end
    end

    private

    def t(name) = "#{@prefix}#{name}"

    def env_config
      {
        host: ENV.fetch("WP_DB_HOST", "127.0.0.1"),
        port: Integer(ENV.fetch("WP_DB_PORT", "3306")),
        username: ENV.fetch("WP_DB_USER"),
        password: ENV["WP_DB_PASSWORD"],
        database: ENV.fetch("WP_DB_NAME"),
        encoding: "utf8mb4"
      }
    end

    def q(sql) = @client.query(sql, cast: true)

    def fetch_posts(cursor)
      types = @post_types.map { |x| "'#{@client.escape(x)}'" }.join(",")
      q(<<~SQL).to_a
        SELECT ID, post_name, post_title, post_content, post_excerpt,
               post_date, post_modified, post_status, post_type, post_author
        FROM #{t 'posts'}
        WHERE ID > #{cursor.to_i} AND post_type IN (#{types}) AND post_status <> 'trash'
        ORDER BY ID ASC
        LIMIT #{@batch_size.to_i}
      SQL
    end

    def meta_for(ids)
      keys = META_KEYS.map { |k| "'#{@client.escape(k)}'" }.join(",")
      out = Hash.new { |h, k| h[k] = {} }
      q(<<~SQL).each { |r| out[r["post_id"]][r["meta_key"]] = r["meta_value"] }
        SELECT post_id, meta_key, meta_value FROM #{t 'postmeta'}
        WHERE post_id IN (#{ids.join(',')})
          AND (meta_key IN (#{keys}) OR meta_key LIKE 'rank_math%')
      SQL
      out
    end

    def terms_for(ids)
      out = Hash.new { |h, k| h[k] = { cats: [], tags: [] } }
      q(<<~SQL).each do |r|
        SELECT tr.object_id AS oid, tt.taxonomy AS tax, tt.term_id, tt.parent,
               t.name, t.slug
        FROM #{t 'term_relationships'} tr
        JOIN #{t 'term_taxonomy'} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
        JOIN #{t 'terms'} t ON t.term_id = tt.term_id
        WHERE tr.object_id IN (#{ids.join(',')}) AND tt.taxonomy IN ('category','post_tag')
      SQL
        descriptor = { name: r["name"], slug: r["slug"], legacy_term_id: r["term_id"] }
        if r["tax"] == "category"
          descriptor[:kind] = EDITORIAL.include?(r["name"]) ? :editorial : :geographic
          out[r["oid"]][:cats] << descriptor
        else
          out[r["oid"]][:tags] << descriptor
        end
      end
      out
    end

    def old_slugs_for(ids)
      out = Hash.new { |h, k| h[k] = [] }
      q(<<~SQL).each { |r| out[r["post_id"]] << r["meta_value"] }
        SELECT post_id, meta_value FROM #{t 'postmeta'}
        WHERE meta_key = '_wp_old_slug' AND post_id IN (#{ids.join(',')})
      SQL
      out
    end

    # Baseline byline from post_author (WP user). NOTE: the live site's canonical
    # bylines are Co-Authors/Molongui — resolving those is a follow-up once the
    # canonical-author decision is made and we can see the meta shape in fixtures.
    def author_for(post)
      uid = post["post_author"]
      @users[uid] ||= begin
        row = q("SELECT ID, display_name, user_nicename FROM #{t 'users'} WHERE ID = #{uid.to_i} LIMIT 1").first
        if row
          { name: row["display_name"], slug: row["user_nicename"], refs: { "wp_user_id" => row["ID"] } }
        end
      end
      @users[uid] ? [@users[uid]] : []
    end

    def build_record(post, meta, terms, old_slugs)
      {
        id: post["ID"],
        post_name: post["post_name"],
        post_title: post["post_title"],
        post_content: post["post_content"],
        post_excerpt: post["post_excerpt"],
        post_date: post["post_date"],
        post_modified: post["post_modified"],
        post_status: post["post_status"],
        post_type: post["post_type"],
        meta: meta,
        categories: terms[:cats],
        tags: terms[:tags],
        authors: author_for(post),
        old_slugs: old_slugs
      }
    end
  end
end
