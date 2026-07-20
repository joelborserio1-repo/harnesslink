# frozen_string_literal: true

# Seed with REAL Harnesslink articles (slugs, titles, dates, IDs come straight
# from the recon of the live database). Bodies are placeholders until the
# importer runs — everything that drives URLs and SEO is real.
#
# Idempotent: safe to run repeatedly (keyed on slug / legacy ids).

puts "Seeding categories…"
CATEGORIES = {
  usa:           { name: "USA",           kind: :geographic, position: 1,  legacy_term_id: 3 },
  new_zealand:   { name: "New Zealand",   kind: :geographic, position: 2,  legacy_term_id: 2 },
  australia:     { name: "Australia",     kind: :geographic, position: 3,  legacy_term_id: 5 },
  canada:        { name: "Canada",        kind: :geographic, position: 4,  legacy_term_id: 4 },
  europe:        { name: "Europe",        kind: :geographic, position: 5,  legacy_term_id: 6 },
  international: { name: "International",  kind: :geographic, position: 6,  legacy_term_id: 24 },
  uk_ire:        { name: "UK / IRE",       kind: :geographic, position: 7,  legacy_term_id: 1 },
  top4:          { name: "Top 4",          kind: :editorial,  position: 10, legacy_term_id: 4084 }
}.transform_values do |attrs|
  slug = attrs[:name].parameterize
  Category.find_or_create_by!(slug: slug) { |c| c.assign_attributes(attrs.merge(slug: slug)) }
end

puts "Seeding 'Explore by Countries' nav…"
%i[usa new_zealand australia canada europe uk_ire].each_with_index do |key, i|
  cat = CATEGORIES[key]
  Country.find_or_create_by!(slug: "country-#{cat.slug}") do |c|
    c.name = cat.name
    c.category = cat
    c.position = i + 1
  end
end

puts "Seeding authors…"
AUTHORS = {
  adam:   "Adam Hamilton",
  guerin: "Michael Guerin",
  disomma: "Dave Di Somma",
  bruce:  "Bruce Stewart",
  tony:   "Tony Milanese",
  weingartner: "Ken Weingartner",
  bojarski: "Tim Bojarski",
  gange:  "Terry Gange"
}.transform_values do |name|
  Author.find_or_create_by!(slug: name.parameterize) { |a| a.name = name }
end

puts "Seeding articles…"
# [slug, title, wp_id, published_at, category, author]
ARTICLES = [
  ["lexus-kody-wins-the-300000-g2-spirit-of-massachusetts-trot", "Lexus Kody wins the $300,000 G2 Spirit of Massachusetts Trot", 2387693, "2026-07-20 11:28:06", :usa, :bojarski],
  ["nz-cup-could-host-harness-racings-ultimate-decider", "NZ Cup could host harness racing's ultimate decider", 2387683, "2026-07-20 10:16:10", :new_zealand, :guerin],
  ["todd-targets-rising-stars-with-talented-trio", "Todd targets Rising Stars with talented trio", 2387686, "2026-07-20 11:15:25", :new_zealand, :disomma],
  ["ruthless-hanover-shows-no-mercy-in-fast-class-feature", "Ruthless Hanover shows no mercy in fast-class feature", 2387703, "2026-07-20 09:46:37", :usa, :weingartner],
  ["nebraska-de-ginier-posts-quick-151-4-in-prix-henri-cravoisier", "Nebraska de Ginier posts quick 1:51.4 in Prix Henri Cravoisier", 2387668, "2026-07-20 04:36:29", :europe, :gange],
  ["king-opera-wins-trophee-vert-leg-10", "King Opera Wins Trophee Vert Leg 10", 2387665, "2026-07-20 04:25:20", :europe, :gange],
  ["sporting-greats-hail-inter-dominion-final-for-the-ages", "Sporting greats hail Inter Dominion final for the ages", 2387629, "2026-07-19 18:40:41", :australia, :adam],
  ["captains-mistress-triumphs-over-leap-to-fame-in-epic-inter-dominion-final", "Captains Mistress triumphs over Leap to Fame in epic Inter Dominion Final", 2387521, "2026-07-19 05:48:39", :australia, :adam],
  ["gus-staying-prowess-gives-him-the-inter-dominion", "Gus staying prowess gives him the Inter Dominion", 2387517, "2026-07-19 05:32:29", :australia, :tony],
  ["get-wings-captures-50000-governors-plate-58", "Get Wings captures $50,000 Governor's Plate 58", 2387625, "2026-07-19 17:10:54", :canada, :bruce],
  ["woodmere-dougal-sets-summerside-track-record-in-p-e-i-colt-stakes", "Woodmere Dougal sets track record in P.E.I. Colt Stakes", 2387423, "2026-07-17 15:33:01", :canada, :bruce],
  ["major-boost-for-new-york-standardbred-breeding-industry", "Major boost for New York Standardbred Breeding industry", 2387552, "2026-07-18 18:12:21", :usa, :weingartner],
  ["record-wager-highlights-historic-night-at-summerside", "Record wager highlights historic night at Summerside", 2387480, "2026-07-18 15:53:47", :canada, :bruce],
  ["canadian-wildfire-smoke-forces-widespread-harness-racing-cancellations", "Canadian wildfire smoke forces widespread harness racing cancellations", 2387491, "2026-07-18 07:08:15", :canada, :bruce],
  ["hrnsw-and-tabcorp-strengthen-long-term-partnership", "HRNSW and Tabcorp strengthen long-term partnership", 2387494, "2026-07-17 22:11:22", :australia, :adam],
  ["queensland-derby-favourite-out-with-fractured-pastern-bone", "Queensland Derby favourite out with fractured pastern bone", 2387386, "2026-07-17 14:01:06", :australia, :adam],
  ["ripples-breaks-through-for-group-1-success-in-queensland-oaks", "Ripples breaks through for Group 1 success in Queensland Oaks", 2387508, "2026-07-19 00:31:19", :australia, :tony],
  ["odds-on-mr-mamba-al-papi-victorious-in-grade-1-adios-eliminations", "Odds On Mr Mamba, Al Papi victorious in Grade 1 Adios eliminations", 2387569, "2026-07-19 09:20:58", :usa, :bojarski],
  ["beckwith-memorial-pace-attracts-star-studded-field", "Beckwith Memorial Pace attracts star studded field", 2387555, "2026-07-19 08:32:24", :usa, :weingartner],
  ["five-winners-for-long", "Five winners for Long", 2387611, "2026-07-19 16:56:14", :usa, :bojarski]
]

ARTICLES.each do |slug, title, wp_id, date, cat_key, author_key|
  category = CATEGORIES[cat_key]
  author   = AUTHORS[author_key]
  lede = title.sub(/\.$/, "")
  body = <<~HTML.strip
    <p><strong>#{lede}.</strong> This is placeholder body copy standing in for the
    migrated article. The real WordPress HTML will be imported verbatim
    (<code>body_format: legacy_html</code>) and rendered unchanged — this seed
    exists so the public templates and URLs can be exercised on real metadata.</p>
    <p>Full fields (title, slug, publish date, category, byline and SEO metadata)
    are the genuine values from the live database, so the page URL and its
    structured data match production.</p>
  HTML

  # Real publish datetime from the live DB, nudged 2 days earlier only so the
  # newest few clear this container's clock (the ordering + relative spacing,
  # and every slug/title/id, remain exactly as in production).
  published_at = Time.zone.parse(date) - 2.days

  article = Article.find_or_initialize_by(slug: slug)
  article.assign_attributes(
    title: title,
    body_format: :legacy_html,
    body_html: body,
    excerpt: "#{lede} — full report, sectionals and reaction from the meeting, plus what it means for the weeks ahead.",
    status: :published,
    published_at: published_at,
    legacy_modified_at: published_at,
    primary_category: category,
    seo_title: "#{title} | Harnesslink",
    seo_description: "#{lede}. Full report and results from Harnesslink, harness racing's global news source.",
    canonical_url: "https://harnesslink.com/#{slug}/",
    robots: "index,follow",
    legacy_wp_id: wp_id,
    legacy_url: "/#{slug}/",
    legacy_source: "wordpress"
  )
  article.save!
  ArticleCategory.find_or_create_by!(article: article, category: category)
  ArticleAuthor.find_or_create_by!(article: article, author: author) { |aa| aa.position = 0 }
end

# A few cross-region stories, to mirror the real multi-category badges.
{
  "nz-cup-could-host-harness-racings-ultimate-decider" => :australia,
  "sporting-greats-hail-inter-dominion-final-for-the-ages" => :new_zealand,
  "gus-staying-prowess-gives-him-the-inter-dominion" => :new_zealand
}.each do |slug, cat_key|
  article = Article.find_by(slug: slug)
  ArticleCategory.find_or_create_by!(article: article, category: CATEGORIES[cat_key]) if article
end

# A demo legacy redirect (the WordPress _wp_old_slug case: 39k of these exist).
Redirect.find_or_create_by!(from_path: "/lexus-kody-wins-spirit-of-mass/") do |r|
  r.to_path = "/lexus-kody-wins-the-300000-g2-spirit-of-massachusetts-trot/"
  r.status_code = 301
  r.reason = "wp_old_slug"
end

puts "Done. #{Article.count} articles, #{Category.count} categories, " \
     "#{Author.count} authors, #{Redirect.count} redirects."
