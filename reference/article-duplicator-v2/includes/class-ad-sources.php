<?php
/**
 * AD_Sources — Registry of scrape sources.
 *
 * Each source defines:
 *   label          – human-readable name shown in the UI
 *   url            – default listing URL
 *   listing        – XPath selectors to find article cards on the listing page
 *   article_link   – XPath to pull a link href from inside a card
 *   article_url_pattern – regex the URL must match to be treated as an article (not a category page etc.)
 *   content        – ordered list of XPath selectors to try for the article body
 *   unwrap_tags    – tags to strip out of the body node before saving
 *   country        – WordPress country/countries taxonomy term to assign on import
 *   lang           – ISO language code (informational)
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class AD_Sources {

    /**
     * Return the full source registry.
     * Plugins / themes can filter 'artdup_sources' to add their own.
     *
     * @return array[]
     */
    public static function get_all() {
        $sources = [

            /* -------------------------------------------------------
               letrot.com  –  French trotting news (original source)
            ------------------------------------------------------- */
            'letrot' => [
                'label'               => 'Le Trot (letrot.com)',
                'url'                 => 'https://www.letrot.com/actualites',
                'lang'                => 'fr',
                'country'             => 'Europe',
                'article_url_pattern' => '#/actualite[s]?/#i',
                'listing'             => [
                    '//*[@data-testid="news-item"]',
                    '//*[@data-testid="article-card"]',
                    '//article[contains(@class,"card")]',
                    '//article[contains(@class,"news")]',
                    '//div[contains(@class,"news-card")]',
                    '//div[contains(@class,"article-card")]',
                    '//div[contains(@class,"news-item")]',
                    '//div[contains(@class,"actualite")]',
                    '//li[contains(@class,"news")]',
                    '//article',
                ],
	                'content'             => [
                    '//*[@itemprop="articleBody"]',
                    '//div[contains(@class,"article-content")]',
                    '//div[contains(@class,"article-body")]',
                    '//div[contains(@class,"news-content")]',
                    '//div[contains(@class,"news-body")]',
                    '//div[contains(@class,"post-content")]',
                    '//div[contains(@class,"entry-content")]',
                    '//article',
                    '//main',
	                ],
	                'author'              => [
	                    '//meta[@name="author"]/@content',
	                    '//meta[@property="article:author"]/@content',
	                    '//*[contains(@class,"author vcard")]//text()',
	                    '//*[contains(@class,"entry-author")]//text()',
	                    '//*[contains(@class,"byline")]//text()',
	                ],
	                'unwrap_tags'         => ['script','style','nav','header','footer','aside','form','iframe','button'],
	            ],

            /* -------------------------------------------------------
               ustrottingnews.com  –  US trotting / harness racing news
               WordPress-based site → standard WP theme selectors apply.
            ------------------------------------------------------- */
            'ustrottingnews' => [
                'label'               => 'US Trotting News (ustrottingnews.com)',
                'url'                 => 'https://ustrottingnews.com',
                'lang'                => 'en',
                'country'             => 'USA',
                // Articles typically live at /YYYY/MM/DD/slug or /category/slug
                'article_url_pattern' => '#ustrottingnews\.com/(20\d\d/|\w+/.+)#i',
                'listing'             => [
                    // WordPress standard article list
                    '//article[contains(@class,"post")]',
                    '//article[contains(@class,"type-post")]',
                    '//div[contains(@class,"post-item")]',
                    '//div[contains(@class,"post-card")]',
                    '//div[contains(@class,"blog-post")]',
                    '//div[contains(@class,"entry")]',
                    // Generic fallback
                    '//article',
                    '//div[contains(@class,"loop-item")]',
                ],
	                'content'             => [
                    // WordPress standard content wrappers
                    '//div[contains(@class,"entry-content")]',
                    '//div[contains(@class,"post-content")]',
                    '//div[contains(@class,"article-content")]',
                    '//*[@itemprop="articleBody"]',
                    '//div[contains(@class,"the-content")]',
                    '//div[contains(@class,"td-post-content")]',
                    '//div[contains(@class,"mvp-content")]',
                    '//article//div[contains(@class,"content")]',
                    '//article',
                    '//main',
	                ],
	                'author'              => [
	                    '//meta[@name="author"]/@content',
	                    '//meta[@property="article:author"]/@content',
	                    '//*[contains(@class,"author vcard")]//text()',
	                    '//*[contains(@class,"entry-author")]//text()',
	                    '//*[contains(@class,"posted-by")]//text()',
	                    '//*[contains(@class,"byline")]//text()',
	                ],
	                'unwrap_tags'         => ['script','style','nav','header','footer','aside','form','iframe','button','.sharedaddy','.jp-relatedposts'],
	            ],

            /* -------------------------------------------------------
               swedishhorseracing.com  –  Swedish harness racing news & tips
               Listing cards live under /newstips as .tip-box blocks.
            ------------------------------------------------------- */
            'swedishhorseracing' => [
                'label'               => 'Swedish Horse Racing (swedishhorseracing.com)',
                'url'                 => 'https://www.swedishhorseracing.com/newstips',
                'lang'                => 'en',
                'country'             => 'Europe',
                'article_url_pattern' => '#swedishhorseracing\.com(?::\d+)?/(hub/preview|tips)/#i',
                'listing'             => [
                    '//*[@id="target"]/div[contains(concat(" ", normalize-space(@class), " "), " tip-box ")]',
                    '//div[contains(concat(" ", normalize-space(@class), " "), " tip-container ")]/div[contains(concat(" ", normalize-space(@class), " "), " tip-box ") and not(contains(concat(" ", normalize-space(@class), " "), " tip-box-inner "))]',
                ],
	                'content'             => [
                    '//div[contains(concat(" ", normalize-space(@class), " "), " body-content ")]',
                    '//div[contains(concat(" ", normalize-space(@class), " "), " flex-col ") and contains(concat(" ", normalize-space(@class), " "), " two-thirds ")]',
                    '//div[contains(concat(" ", normalize-space(@class), " "), " c-tips ")]//div[contains(concat(" ", normalize-space(@class), " "), " tip-container ")]',
                    '//div[contains(concat(" ", normalize-space(@class), " "), " tip-box-inner ")]',
	                ],
	                'author'              => [
	                    '//meta[@name="author"]/@content',
	                    '//*[contains(concat(" ", normalize-space(@class), " "), " published-by ")]//text()',
	                    '//*[contains(concat(" ", normalize-space(@class), " "), " news-date ")]//text()',
	                    '//*[contains(concat(" ", normalize-space(@class), " "), " byline ")]//text()',
	                ],
	                'unwrap_tags'         => [
                    'script','style','nav','header','footer','aside','form','iframe','button',
                    '.info-box','.dropdown','.expand-image','.shade','.partnerlist','.facebook','.twitter','.gplus',
                    '.nav-bettype-list','.date','.e-btn',
                ],
            ],

            /* -------------------------------------------------------
               standardbredcanada.ca  –  Canadian harness racing news
               Drupal-based site with /news and /notices article paths.
            ------------------------------------------------------- */
            'standardbredcanada' => [
                'label'               => 'Standardbred Canada (standardbredcanada.ca)',
                'url'                 => 'https://standardbredcanada.ca/news/archive',
                'lang'                => 'en',
                'country'             => 'Canada',
                'article_url_pattern' => '#standardbredcanada\.ca/(news|notices)/\d{1,2}-\d{1,2}-\d{2}/[^/]+\.html#i',
                'listing'             => [
                    '//article[contains(@class,"node--story--teaser")]',
                    '//article[contains(@class,"node--notice--teaser")]',
                    '//article[contains(@class,"slideshow-article-item")]',
                    '//article[contains(@class,"node--story")]',
                    '//article[contains(@class,"node--notice")]',
                ],
	                'content'             => [
                    '//article[contains(@class,"node--story--full")]//div[contains(@class,"field--name-body")]',
                    '//article[contains(@class,"node--notice--full")]//div[contains(@class,"field--name-body")]',
                    '//div[contains(@class,"field--name-body") and contains(@class,"field__item")]',
                    '//article[contains(@class,"node--story--full")]//div[contains(@class,"node--content")]',
                    '//article[contains(@class,"node--notice--full")]//div[contains(@class,"node--content")]',
	                ],
	                'author'              => [
	                    '//meta[@name="author"]/@content',
	                    '//meta[@property="article:author"]/@content',
	                    '//div[contains(@class,"field--name-field-author")]//text()',
	                    '//div[contains(@class,"field--name-field-news-source")]//text()',
	                    '//div[contains(@class,"field--name-field-source")]//text()',
	                    '//*[contains(@class,"submitted")]//text()',
	                    '//*[contains(@class,"byline")]//text()',
	                ],
	                'unwrap_tags'         => [
                    'script','style','nav','header','footer','aside','form','iframe','button','svg',
                    '.top-links','.published-date','.field--name-field-list-sales-results',
                    '.field--name-field-news','.comment-wrapper','.addtoany_list',
                ],
            ],

        ];

        /**
         * Filter: artdup_sources
         * Allows third-party code to register additional sources or override defaults.
         *
         * @param array $sources  Associative array keyed by source slug.
         */
        return apply_filters( 'artdup_sources', $sources );
    }

    /**
     * Get a single source config by slug.
     *
     * @param  string $slug
     * @return array|null
     */
    public static function get( $slug ) {
        $all = self::get_all();
        return $all[ $slug ] ?? null;
    }

    /**
     * Return [slug => label] pairs — used for <select> dropdowns.
     *
     * @return string[]
     */
    public static function dropdown_options() {
        $options = [ '' => __( '— Custom URL —', 'article-duplicator' ) ];
        foreach ( self::get_all() as $slug => $source ) {
            $options[ $slug ] = $source['label'];
        }
        return $options;
    }

    /**
     * Given any URL, return the slug of the matching source (or '' for custom).
     *
     * @param  string $url
     * @return string
     */
    public static function slug_for_url( $url ) {
        foreach ( self::get_all() as $slug => $source ) {
            if ( strpos( $url, parse_url( $source['url'], PHP_URL_HOST ) ) !== false ) {
                return $slug;
            }
        }
        return '';
    }

    /**
     * Return the configured country taxonomy term for a source URL or slug.
     *
     * @param  string $url
     * @param  string $fallback_slug
     * @return string
     */
    public static function country_for_url_or_slug( $url, $fallback_slug = '' ) {
        $slug = self::slug_for_url( $url );
        if ( empty( $slug ) && ! empty( $fallback_slug ) ) {
            $slug = $fallback_slug;
        }

        $source = self::get( $slug );
        return $source['country'] ?? '';
    }
}
