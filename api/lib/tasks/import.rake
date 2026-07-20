# frozen_string_literal: true

namespace :import do
  desc "Import articles from the WordPress DB (env: WP_DB_*, WP_TABLE_PREFIX, WP_POST_TYPES)"
  task wordpress: :environment do
    source = Wordpress::MysqlSource.new(
      prefix: ENV.fetch("WP_TABLE_PREFIX", "wp_"),
      post_types: (ENV["WP_POST_TYPES"] || "post").split(",")
    )
    rewrite =
      if ENV["MEDIA_REWRITE_FROM"].present? && ENV["MEDIA_REWRITE_TO"].present?
        [ENV["MEDIA_REWRITE_FROM"], ENV["MEDIA_REWRITE_TO"]]
      end

    run = Wordpress::Importer.new(source: source, media_rewrite: rewrite).call
    puts "Import #{run.status}. #{run.stats.to_json}"
    puts "last_error: #{run.last_error}" if run.last_error
  end

  desc "Import from an exported JSON file (migration/export_posts.php): rake 'import:json[path]'"
  task :json, [:path] => :environment do |_t, args|
    path = args[:path] || ENV["WP_JSON"] || abort("Usage: rake 'import:json[path/to/posts.json]'")
    run = Wordpress::Importer.new(source: Wordpress::JsonSource.new(path: path)).call
    puts "Import #{run.status}. #{run.stats.to_json}"
    puts "last_error: #{run.last_error}" if run.last_error
  end

  desc "Import WordPress users from an exported JSON file: rake 'import:users[path]'"
  task :users, [:path] => :environment do |_t, args|
    path = args[:path] || ENV["WP_USERS_JSON"] || abort("Usage: rake 'import:users[path/to/users.json]'")
    result = Wordpress::UserImporter.from_json(path)
    puts "Users: created=#{result.created} updated=#{result.updated} " \
         "skipped=#{result.skipped} errors=#{result.errors.size}"
    result.errors.first(10).each { |e| puts "  #{e}" }
  end

  desc "Show the latest import run's progress + stats"
  task status: :environment do
    run = ImportRun.order(:id).last
    if run
      puts "run ##{run.id}  status=#{run.status}  cursor=#{run.cursor_legacy_id}"
      puts JSON.pretty_generate(run.stats)
      puts "last_error: #{run.last_error}" if run.last_error
    else
      puts "No import runs yet."
    end
  end
end
