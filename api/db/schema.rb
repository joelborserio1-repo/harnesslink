# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_07_20_065815) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "admin_users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.datetime "remember_created_at"
    t.datetime "reset_password_sent_at"
    t.string "reset_password_token"
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_admin_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_admin_users_on_reset_password_token", unique: true
  end

  create_table "ads", force: :cascade do |t|
    t.string "alt", default: "", null: false
    t.bigint "clicks", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "ends_at"
    t.text "html"
    t.string "image_url", default: "", null: false
    t.bigint "impressions", default: 0, null: false
    t.boolean "is_active", default: true, null: false
    t.string "link_url", default: "", null: false
    t.string "name", null: false
    t.string "size", default: "mpu", null: false
    t.datetime "starts_at"
    t.datetime "updated_at", null: false
    t.integer "weight", default: 1, null: false
    t.string "zone", null: false
    t.index ["zone", "is_active"], name: "index_ads_on_zone_and_is_active"
  end

  create_table "article_authors", force: :cascade do |t|
    t.bigint "article_id", null: false
    t.bigint "author_id", null: false
    t.datetime "created_at", null: false
    t.integer "position", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["article_id", "author_id"], name: "index_article_authors_on_article_id_and_author_id", unique: true
    t.index ["article_id"], name: "index_article_authors_on_article_id"
    t.index ["author_id"], name: "index_article_authors_on_author_id"
  end

  create_table "article_categories", force: :cascade do |t|
    t.bigint "article_id", null: false
    t.bigint "category_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["article_id", "category_id"], name: "index_article_categories_on_article_id_and_category_id", unique: true
    t.index ["article_id"], name: "index_article_categories_on_article_id"
    t.index ["category_id"], name: "index_article_categories_on_category_id"
  end

  create_table "article_revisions", force: :cascade do |t|
    t.bigint "article_id", null: false
    t.integer "body_format", default: 0, null: false
    t.text "body_html"
    t.jsonb "body_json", default: {}, null: false
    t.datetime "created_at", null: false
    t.bigint "editor_id"
    t.string "subtitle"
    t.string "title"
    t.datetime "updated_at", null: false
    t.index ["article_id"], name: "index_article_revisions_on_article_id"
    t.index ["editor_id"], name: "index_article_revisions_on_editor_id"
  end

  create_table "article_tags", force: :cascade do |t|
    t.bigint "article_id", null: false
    t.datetime "created_at", null: false
    t.bigint "tag_id", null: false
    t.datetime "updated_at", null: false
    t.index ["article_id", "tag_id"], name: "index_article_tags_on_article_id_and_tag_id", unique: true
    t.index ["article_id"], name: "index_article_tags_on_article_id"
    t.index ["tag_id"], name: "index_article_tags_on_tag_id"
  end

  create_table "articles", force: :cascade do |t|
    t.integer "body_format", default: 0, null: false
    t.text "body_html"
    t.jsonb "body_json", default: {}, null: false
    t.string "byline_text"
    t.string "canonical_url"
    t.datetime "created_at", null: false
    t.text "excerpt"
    t.string "featured_image_caption"
    t.string "featured_image_credit"
    t.bigint "featured_media_id"
    t.string "focus_keyword"
    t.jsonb "import_flags", default: [], null: false
    t.datetime "legacy_modified_at"
    t.string "legacy_source"
    t.string "legacy_url"
    t.bigint "legacy_wp_id"
    t.boolean "needs_review", default: false, null: false
    t.text "og_description"
    t.bigint "og_image_id"
    t.string "og_title"
    t.bigint "primary_category_id"
    t.datetime "published_at"
    t.integer "reading_time_minutes"
    t.string "robots"
    t.datetime "scheduled_for"
    t.string "schema_type", default: "NewsArticle", null: false
    t.text "seo_description"
    t.string "seo_title"
    t.string "slug", null: false
    t.integer "status", default: 0, null: false
    t.string "subtitle"
    t.string "title", null: false
    t.text "twitter_description"
    t.bigint "twitter_image_id"
    t.string "twitter_title"
    t.datetime "updated_at", null: false
    t.bigint "view_count", default: 0, null: false
    t.index ["featured_media_id"], name: "index_articles_on_featured_media_id"
    t.index ["legacy_url"], name: "index_articles_on_legacy_url", unique: true
    t.index ["legacy_wp_id"], name: "index_articles_on_legacy_wp_id", unique: true
    t.index ["needs_review"], name: "index_articles_on_needs_review"
    t.index ["og_image_id"], name: "index_articles_on_og_image_id"
    t.index ["primary_category_id", "published_at"], name: "index_articles_on_primary_category_id_and_published_at"
    t.index ["primary_category_id"], name: "index_articles_on_primary_category_id"
    t.index ["published_at"], name: "index_articles_on_published_at", order: :desc
    t.index ["slug"], name: "index_articles_on_slug", unique: true
    t.index ["status"], name: "index_articles_on_status"
    t.index ["twitter_image_id"], name: "index_articles_on_twitter_image_id"
  end

  create_table "authors", force: :cascade do |t|
    t.string "avatar_url"
    t.text "bio"
    t.datetime "created_at", null: false
    t.string "email"
    t.jsonb "legacy_refs", default: {}, null: false
    t.bigint "merged_into_id"
    t.string "name", null: false
    t.integer "position", default: 0, null: false
    t.string "role_title"
    t.string "slug", null: false
    t.string "twitter"
    t.datetime "updated_at", null: false
    t.index ["legacy_refs"], name: "index_authors_on_legacy_refs", using: :gin
    t.index ["merged_into_id"], name: "index_authors_on_merged_into_id"
    t.index ["slug"], name: "index_authors_on_slug", unique: true
  end

  create_table "categories", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description"
    t.integer "kind", default: 0, null: false
    t.bigint "legacy_term_id"
    t.string "name", null: false
    t.bigint "parent_id"
    t.integer "position", default: 0, null: false
    t.integer "posts_count", default: 0, null: false
    t.string "slug", null: false
    t.datetime "updated_at", null: false
    t.index ["legacy_term_id"], name: "index_categories_on_legacy_term_id", unique: true
    t.index ["parent_id"], name: "index_categories_on_parent_id"
    t.index ["slug"], name: "index_categories_on_slug", unique: true
  end

  create_table "countries", force: :cascade do |t|
    t.bigint "category_id"
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.integer "position", default: 0, null: false
    t.string "slug", null: false
    t.datetime "updated_at", null: false
    t.index ["category_id"], name: "index_countries_on_category_id"
    t.index ["slug"], name: "index_countries_on_slug", unique: true
  end

  create_table "directory_enquiries", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "directory_listing_id"
    t.string "email", default: "", null: false
    t.string "listing_type", default: "", null: false
    t.text "message"
    t.string "name", default: "", null: false
    t.string "phone", default: "", null: false
    t.string "status", default: "new", null: false
    t.datetime "updated_at", null: false
    t.index ["directory_listing_id"], name: "index_directory_enquiries_on_directory_listing_id"
    t.index ["status"], name: "index_directory_enquiries_on_status"
  end

  create_table "directory_listings", force: :cascade do |t|
    t.text "contact_address"
    t.string "contact_email", default: "", null: false
    t.string "contact_phone", default: "", null: false
    t.string "contact_website", default: "", null: false
    t.string "country", default: "", null: false
    t.text "coverage"
    t.datetime "created_at", null: false
    t.string "directory_type", default: "stallion", null: false
    t.string "gait", default: "Pacer", null: false
    t.string "industry", default: "", null: false
    t.boolean "is_featured", default: false, null: false
    t.boolean "is_paying", default: false, null: false
    t.bigint "legacy_id"
    t.string "name", null: false
    t.text "profile_bio"
    t.string "profile_image", default: "", null: false
    t.text "progeny_note"
    t.string "race_record", default: "", null: false
    t.string "region", default: "", null: false
    t.string "service_fee", default: "", null: false
    t.string "slug", null: false
    t.string "status_note", default: "", null: false
    t.string "stud_master", default: "", null: false
    t.string "stud_name", default: "", null: false
    t.string "stud_website", default: "", null: false
    t.string "suburb", default: "", null: false
    t.datetime "updated_at", null: false
    t.index ["country"], name: "index_directory_listings_on_country"
    t.index ["directory_type", "is_featured"], name: "index_directory_listings_on_directory_type_and_is_featured"
    t.index ["legacy_id"], name: "index_directory_listings_on_legacy_id", unique: true
    t.index ["slug"], name: "index_directory_listings_on_slug"
  end

  create_table "directory_progeny", force: :cascade do |t|
    t.string "broodmare_sire", default: "", null: false
    t.string "country", default: "", null: false
    t.string "dam", default: "", null: false
    t.bigint "directory_listing_id", null: false
    t.string "foaling_date", default: "", null: false
    t.string "mile_rate", default: "", null: false
    t.string "name", default: "", null: false
    t.string "prizemoney", default: "", null: false
    t.bigint "prizemoney_num", default: 0, null: false
    t.string "sex", default: "", null: false
    t.integer "sort_order", default: 0, null: false
    t.integer "starts", default: 0, null: false
    t.integer "wins", default: 0, null: false
    t.index ["directory_listing_id", "prizemoney_num"], name: "idx_on_directory_listing_id_prizemoney_num_c2e2ed8718"
    t.index ["directory_listing_id"], name: "index_directory_progeny_on_directory_listing_id"
  end

  create_table "import_runs", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "cursor_legacy_id", default: 0, null: false
    t.datetime "finished_at"
    t.text "last_error"
    t.string "source", default: "wordpress", null: false
    t.datetime "started_at"
    t.jsonb "stats", default: {}, null: false
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
  end

  create_table "media_assets", force: :cascade do |t|
    t.string "alt"
    t.string "blurhash"
    t.bigint "byte_size"
    t.text "caption"
    t.datetime "created_at", null: false
    t.string "credit"
    t.integer "height"
    t.string "legacy_url"
    t.bigint "legacy_wp_id"
    t.string "mime_type"
    t.integer "status", default: 0, null: false
    t.string "storage_key"
    t.string "title"
    t.datetime "updated_at", null: false
    t.integer "width"
    t.index ["legacy_url"], name: "index_media_assets_on_legacy_url"
    t.index ["legacy_wp_id"], name: "index_media_assets_on_legacy_wp_id", unique: true
  end

  create_table "missed_paths", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "hits", default: 0, null: false
    t.datetime "last_seen_at"
    t.string "path", null: false
    t.string "referer"
    t.datetime "updated_at", null: false
    t.index ["path"], name: "index_missed_paths_on_path", unique: true
  end

  create_table "redirects", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "from_path", null: false
    t.bigint "hit_count", default: 0, null: false
    t.datetime "last_hit_at"
    t.string "reason"
    t.integer "status_code", default: 301, null: false
    t.string "to_path", null: false
    t.datetime "updated_at", null: false
    t.index ["from_path"], name: "index_redirects_on_from_path", unique: true
  end

  create_table "tags", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "legacy_term_id"
    t.string "name", null: false
    t.integer "posts_count", default: 0, null: false
    t.string "slug", null: false
    t.datetime "updated_at", null: false
    t.index ["legacy_term_id"], name: "index_tags_on_legacy_term_id", unique: true
    t.index ["slug"], name: "index_tags_on_slug", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.bigint "legacy_wp_user_id"
    t.string "name"
    t.string "password_digest"
    t.integer "role", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "article_authors", "articles"
  add_foreign_key "article_authors", "authors"
  add_foreign_key "article_categories", "articles"
  add_foreign_key "article_categories", "categories"
  add_foreign_key "article_revisions", "articles"
  add_foreign_key "article_revisions", "users", column: "editor_id"
  add_foreign_key "article_tags", "articles"
  add_foreign_key "article_tags", "tags"
  add_foreign_key "articles", "categories", column: "primary_category_id"
  add_foreign_key "articles", "media_assets", column: "featured_media_id"
  add_foreign_key "articles", "media_assets", column: "og_image_id"
  add_foreign_key "articles", "media_assets", column: "twitter_image_id"
  add_foreign_key "authors", "authors", column: "merged_into_id"
  add_foreign_key "categories", "categories", column: "parent_id"
  add_foreign_key "countries", "categories"
  add_foreign_key "directory_enquiries", "directory_listings"
  add_foreign_key "directory_progeny", "directory_listings"
end
