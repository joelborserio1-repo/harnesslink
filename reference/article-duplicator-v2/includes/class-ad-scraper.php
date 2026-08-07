<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class AD_Scraper {

    private $source_url;
    private $max_articles;
    /** @var array|null  Source config from AD_Sources for the active URL */
    private $source_cfg;

    public function __construct() {
        $this->source_url   = get_option( 'ad_source_url', 'https://www.letrot.com/actualites' );
        $this->max_articles = (int) get_option( 'ad_max_articles', 20 );
        $this->source_cfg   = AD_Sources::get( AD_Sources::slug_for_url( $this->source_url ) );
    }

    /* =========================================================
       SHARED REQUEST ARGS
    ========================================================= */

    private function request_args( $extra = [] ) {
        $lang = $this->source_cfg['lang'] ?? 'en';
        $accept_language = ( $lang === 'fr' ) ? 'fr-FR,fr;q=0.9,en-US,en;q=0.7' : 'en-US,en;q=0.9';

        return array_merge( [
            'timeout'    => 30,
            'user-agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
            'headers'    => [
                'Accept-Language' => $accept_language,
                'Accept'          => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Encoding' => 'gzip, deflate',
                'Cache-Control'   => 'no-cache',
                'Referer'         => $this->get_base_domain() . '/',
            ],
            'sslverify'  => false,
        ], $extra );
    }

    /* =========================================================
       LISTING PAGE
    ========================================================= */

    public function fetch_article_list() {
        $response = wp_remote_get( $this->source_url, $this->request_args() );

        if ( is_wp_error( $response ) ) {
            return new WP_Error( 'fetch_failed', $response->get_error_message() );
        }

        $code = wp_remote_retrieve_response_code( $response );
        if ( $code !== 200 ) {
            return new WP_Error( 'bad_response', "HTTP $code received from source." );
        }

        $body = wp_remote_retrieve_body( $response );
        return $this->parse_listing( $body );
    }

    private function parse_listing( $html ) {
        $articles = [];

        libxml_use_internal_errors( true );
        $doc = new DOMDocument();
        $doc->loadHTML( '<?xml encoding="UTF-8">' . $html );
        libxml_clear_errors();

        $xpath = new DOMXPath( $doc );

        // Build ordered selector list: source-specific first, then generic fallbacks
        $selectors = $this->get_listing_selectors();

        $nodes = null;
        foreach ( $selectors as $sel ) {
            $nodes = $xpath->query( $sel );
            if ( $nodes && $nodes->length > 0 ) break;
        }

        if ( ! $nodes || $nodes->length === 0 ) {
            return $this->parse_listing_by_links( $xpath );
        }

        foreach ( $nodes as $node ) {
            if ( count( $articles ) >= $this->max_articles ) break;
            $data = $this->extract_card_data( $node, $xpath );
            if ( ! empty( $data['url'] ) && ! empty( $data['title'] ) && mb_strlen( $data['title'] ) > 4 ) {
                $articles[] = $data;
            }
        }

        $articles = $this->deduplicate( $articles );

        // If very few matched (selector hit a wrapper), try link fallback too
        if ( count( $articles ) < 3 ) {
            $link_articles = $this->parse_listing_by_links( $xpath );
            if ( count( $link_articles ) > count( $articles ) ) {
                $articles = $link_articles;
            }
        }

        return array_slice( $articles, 0, $this->max_articles );
    }

    /** Return the listing selectors for the current source */
    private function get_listing_selectors() {
        $source_selectors = $this->source_cfg['listing'] ?? [];

        // Generic fallbacks always appended
        $generic = [
            '//article[contains(@class,"post")]',
            '//article',
            '//div[contains(@class,"post-item")]',
            '//div[contains(@class,"article-card")]',
            '//div[contains(@class,"news-item")]',
            '//li[contains(@class,"post")]',
        ];

        return array_unique( array_merge( $source_selectors, $generic ) );
    }

    /** Return the article-body selectors for the current source */
    private function get_content_selectors() {
        $source_selectors = $this->source_cfg['content'] ?? [];

        $generic = [
            '//*[@itemprop="articleBody"]',
            '//div[contains(@class,"entry-content")]',
            '//div[contains(@class,"post-content")]',
            '//div[contains(@class,"article-content")]',
            '//div[contains(@class,"article-body")]',
            '//div[contains(@class,"content-body")]',
            '//div[contains(@class,"story-body")]',
            '//section[contains(@class,"article")]',
            '//article',
            '//main',
        ];

        return array_unique( array_merge( $source_selectors, $generic ) );
    }

    /** Fallback: walk all <a> tags pointing to article-like paths */
    private function parse_listing_by_links( DOMXPath $xpath ) {
        $articles = [];
        $seen     = [];

        // Build URL pattern from source config, or use a sensible default
        $pattern = $this->source_cfg['article_url_pattern'] ?? '#/(article|actualite|news|post|20\d\d)/#i';

        $links = $xpath->query( '//a[@href]' );
        if ( ! $links ) return $articles;

        foreach ( $links as $link ) {
            $href = trim( $link->getAttribute('href') );
            if ( empty( $href ) || $href === '#' ) continue;

            $url = $this->resolve_url( $href );

            // Skip obvious non-article URLs (category pages, tag pages, etc.)
            if ( ! $this->looks_like_article_url( $url ) ) continue;
            if ( in_array( $url, $seen, true ) ) continue;
            if ( rtrim( $url, '/' ) === rtrim( $this->source_url, '/' ) ) continue;

            $seen[] = $url;

            // Title: text of link, or nearby heading
            $title = trim( $link->textContent );
            if ( mb_strlen( $title ) < 6 ) {
                $title = $this->find_nearby_heading( $link );
            }
            if ( mb_strlen( $title ) < 5 ) continue;

            // Thumbnail: nearest <img>
            $thumb = $this->find_nearby_image( $link );

            $articles[] = [
                'url'       => $url,
                'title'     => $title,
                'excerpt'   => '',
                'date'      => '',
                'thumbnail' => $thumb,
                'category'  => '',
            ];

            if ( count( $articles ) >= $this->max_articles ) break;
        }

        return $articles;
    }

    private function looks_like_article_url( $url ) {
        if ( empty( $url ) ) return false;
        $base = rtrim( $this->source_url, '/' );
        // Must be on same domain
        if ( strpos( $url, $this->get_base_domain() ) === false ) return false;
        // Must not be the listing page itself
        if ( rtrim( $url, '/' ) === $base ) return false;
        // Must not be a tag/category/author/page/search/attachment URL
        if ( preg_match( '#/(tag|category|author|page|search|feed|wp-content|wp-admin|wp-login|#|mailto:)#i', $url ) ) return false;
        // Source-specific pattern
        if ( isset( $this->source_cfg['article_url_pattern'] ) ) {
            return (bool) preg_match( $this->source_cfg['article_url_pattern'], $url );
        }
        // Generic: must have more than 2 path segments after domain
        $path = parse_url( $url, PHP_URL_PATH ) ?? '';
        return substr_count( trim( $path, '/' ), '/' ) >= 1;
    }

    private function extract_card_data( DOMNode $node, DOMXPath $xpath ) {
        // URL
        $url = '';
        $data_url = '';
        if ( $node instanceof DOMElement ) {
            $data_url = trim( $node->getAttribute( 'data-url' ) );
        }
        if ( ! empty( $data_url ) ) {
            $candidate = $this->resolve_url( $data_url );
            if ( $this->looks_like_article_url( $candidate ) ) {
                $url = $candidate;
            }
        }

        $link_nodes = $xpath->query( './/a[@href]', $node );
        if ( empty( $url ) && $link_nodes ) {
            foreach ( $link_nodes as $ln ) {
                $href = trim( $ln->getAttribute('href') );
                if ( ! empty( $href ) && $href !== '#' ) {
                    $candidate = $this->resolve_url( $href );
                    if ( $this->looks_like_article_url( $candidate ) ) {
                        $url = $candidate;
                        break;
                    }
                }
            }
        }
        // Fallback: any link
        if ( empty( $url ) && $link_nodes && $link_nodes->length > 0 ) {
            $url = $this->resolve_url( $link_nodes->item(0)->getAttribute('href') );
        }

        // Title
        $title = '';
        foreach ( ['h1','h2','h3','h4','h5'] as $tag ) {
            $hn = $xpath->query( ".//$tag", $node );
            if ( $hn && $hn->length > 0 ) {
                $t = trim( $hn->item(0)->textContent );
                if ( mb_strlen( $t ) > 4 ) { $title = $t; break; }
            }
        }
        if ( empty( $title ) && $link_nodes && $link_nodes->length > 0 ) {
            $title = trim( $link_nodes->item(0)->textContent );
        }

        // Excerpt
        $excerpt = '';
        $p_nodes = $xpath->query( './/p', $node );
        if ( $p_nodes ) {
            foreach ( $p_nodes as $p ) {
                $text = trim( $p->textContent );
                if ( mb_strlen( $text ) > 20 && $text !== $title ) { $excerpt = $text; break; }
            }
        }
        if ( empty( $excerpt ) ) {
            $body_nodes = $xpath->query( './/*[contains(concat(" ", normalize-space(@class), " "), " body-content ")]', $node );
            if ( $body_nodes && $body_nodes->length > 0 ) {
                $excerpt = trim( $body_nodes->item(0)->textContent );
            }
        }

        // Date
        $date = '';
        $time_nodes = $xpath->query( './/time', $node );
        if ( $time_nodes && $time_nodes->length > 0 ) {
            $date = $time_nodes->item(0)->getAttribute('datetime') ?: trim( $time_nodes->item(0)->textContent );
        }
        if ( empty( $date ) ) {
            $date_nodes = $xpath->query( './/*[contains(@class,"date") or contains(@class,"posted-on")]', $node );
            if ( $date_nodes && $date_nodes->length > 0 ) {
                $date = trim( $date_nodes->item(0)->textContent );
            }
        }

        // Thumbnail
        $thumbnail = '';
        $img_nodes = $xpath->query( './/img', $node );
        if ( $img_nodes && $img_nodes->length > 0 ) {
            foreach ( $img_nodes as $img ) {
                $src = $this->get_image_src( $img );
                if ( empty( $src ) ) continue;
                $src = $this->resolve_url($src);
                if ( ! $this->is_article_image_node( $img, $src, true ) ) continue;
                $thumbnail = $src;
                break;
            }
        }

        return compact( 'url', 'title', 'excerpt', 'date', 'thumbnail' ) + [ 'category' => '' ];
    }

    /* =========================================================
       SINGLE ARTICLE PAGE
    ========================================================= */

    public function fetch_article_content( $url ) {
        $response = wp_remote_get( $url, $this->request_args() );

        if ( is_wp_error( $response ) ) {
            return new WP_Error( 'fetch_failed', $response->get_error_message() );
        }

        $code = wp_remote_retrieve_response_code( $response );
        if ( $code !== 200 ) {
            return new WP_Error( 'bad_response', "HTTP $code from article URL." );
        }

        $body = wp_remote_retrieve_body( $response );
        if ( empty( $body ) ) {
            return new WP_Error( 'empty_body', 'Empty response body.' );
        }

        // Re-resolve source config for the article's domain (may differ from listing URL)
        $article_cfg = AD_Sources::get( AD_Sources::slug_for_url( $url ) ) ?? $this->source_cfg;

        return $this->parse_article( $body, $url, $article_cfg );
    }

    private function parse_article( $html, $source_url, $cfg ) {
        libxml_use_internal_errors( true );
        $doc = new DOMDocument();
        $doc->loadHTML( '<?xml encoding="UTF-8">' . $html );
        libxml_clear_errors();

        $xpath  = new DOMXPath( $doc );
        $result = [
            'title'     => '',
            'content'   => '',
            'excerpt'   => '',
            'date'      => '',
            'author'    => '',
            'thumbnail' => '',
            'images'    => [],
            'source'    => $source_url,
            'url'       => $source_url,
        ];

        // ── Title ─────────────────────────────────────────────────
        foreach ( [
            '//meta[@property="og:title"]/@content',
            '//meta[@name="twitter:title"]/@content',
        ] as $q ) {
            $n = $xpath->query($q);
            if ($n && $n->length > 0) { $result['title'] = trim($n->item(0)->nodeValue); break; }
        }
        if ( empty($result['title']) ) {
            $h1 = $xpath->query('//h1');
            if ($h1 && $h1->length > 0) $result['title'] = trim($h1->item(0)->textContent);
        }
        if ( empty($result['title']) ) {
            $t = $xpath->query('//title');
            if ($t && $t->length > 0) $result['title'] = trim($t->item(0)->textContent);
        }

        // ── OG Thumbnail ─────────────────────────────────────────
        $og_img = $xpath->query('//meta[@property="og:image"]/@content');
        if ($og_img && $og_img->length > 0) {
            $candidate = $this->resolve_url(trim($og_img->item(0)->nodeValue));
            if ( $this->is_article_image_url( $candidate ) ) {
                $result['thumbnail'] = $candidate;
            }
        }
        // Also try twitter:image
        if ( empty($result['thumbnail']) ) {
            $tw_img = $xpath->query('//meta[@name="twitter:image"]/@content');
            if ($tw_img && $tw_img->length > 0) {
                $candidate = $this->resolve_url(trim($tw_img->item(0)->nodeValue));
                if ( $this->is_article_image_url( $candidate ) ) {
                    $result['thumbnail'] = $candidate;
                }
            }
        }

        // ── Date ──────────────────────────────────────────────────
        // 1. JSON-LD (most reliable)
        $scripts = $xpath->query('//script[@type="application/ld+json"]');
        if ($scripts) {
            foreach ($scripts as $script) {
                $json = @json_decode(trim($script->textContent), true);
                if (!empty($json['datePublished'])) { $result['date'] = $json['datePublished']; break; }
                foreach (($json['@graph'] ?? []) as $item) {
                    if (!empty($item['datePublished'])) { $result['date'] = $item['datePublished']; break 2; }
                }
            }
        }
        // 2. <time datetime="">
        if ( empty($result['date']) ) {
            $tn = $xpath->query('//time[@datetime]');
            if ($tn && $tn->length > 0) $result['date'] = $tn->item(0)->getAttribute('datetime');
        }
        // 3. Web component timestamp used by swedishhorseracing.com
        if ( empty($result['date']) ) {
            $atg_time = $xpath->query('//atg-time[@date]');
            if ($atg_time && $atg_time->length > 0) {
                $millis = (int) $atg_time->item(0)->getAttribute('date');
                if ($millis > 0) $result['date'] = date('c', (int) floor($millis / 1000));
            }
        }
        // 4. meta tags
        if ( empty($result['date']) ) {
            foreach ([
                '//meta[@property="article:published_time"]/@content',
                '//meta[@name="date"]/@content',
                '//meta[@itemprop="datePublished"]/@content',
                '//meta[@name="dcterms.date"]/@content',
            ] as $q) {
                $n = $xpath->query($q);
                if ($n && $n->length > 0) { $result['date'] = trim($n->item(0)->nodeValue); break; }
            }
        }
        // 5. Visible date text
        if ( empty($result['date']) ) {
            $dn = $xpath->query('//*[contains(@class,"entry-date") or contains(@class,"posted-on") or contains(@class,"published-by") or contains(@class,"news-date") or contains(@class,"published-date")]');
            if ($dn && $dn->length > 0) {
                $raw = trim($dn->item(0)->textContent);
                if ($raw) $result['date'] = $raw;
            }
        }

        // ── Author ────────────────────────────────────────────────
	        $author_selectors = $cfg['author'] ?? [];
	        $author_selectors = array_unique( array_merge( $author_selectors, [
	            '//meta[@name="author"]/@content',
	            '//meta[@property="article:author"]/@content',
	            '//*[contains(@class,"author vcard")]//text()',
	            '//*[contains(@class,"entry-author")]//text()',
	            '//*[@itemprop="author"]//text()',
	            '//*[contains(@class,"byline")]//text()',
	        ] ) );
	        foreach ($author_selectors as $q) {
	            $n = $xpath->query($q);
	            if ($n && $n->length > 0) {
	                foreach ($n as $author_node) {
	                    $v = trim(html_entity_decode($author_node->nodeValue, ENT_QUOTES, 'UTF-8'));
	                    if ($v) { $result['author'] = $v; break 2; }
	                }
	            }
	        }

        // ── Article body ─────────────────────────────────────────
        $content_selectors = $cfg['content'] ?? $this->get_content_selectors();
        $content_node = null;
        foreach ($content_selectors as $sel) {
            $nodes = $xpath->query($sel);
            if ($nodes && $nodes->length > 0) { $content_node = $nodes->item(0); break; }
        }

        if ($content_node) {
            $remove_tags = $cfg['unwrap_tags'] ?? ['script','style','nav','header','footer','aside','form','iframe','button'];
            foreach ($remove_tags as $tag) {
                $arr = [];
                if (strpos($tag, '.') === 0) {
                    $class_name = substr($tag, 1);
                    $nodes = $xpath->query('.//*[contains(concat(" ", normalize-space(@class), " "), " ' . $class_name . ' ")]', $content_node);
                    if ($nodes) foreach ($nodes as $t) $arr[] = $t;
                } else {
                    foreach ($content_node->getElementsByTagName($tag) as $t) $arr[] = $t;
                }
                foreach ($arr as $t) { if ($t->parentNode) $t->parentNode->removeChild($t); }
            }
            // Also strip WP-specific junk via class names
            $junk_classes = ['sharedaddy','jp-relatedposts','wpcnt','feedflare','yarpp','related-posts','page-bottom'];
            foreach ($junk_classes as $cls) {
                $junk_nodes = $xpath->query('.//*[contains(@class,"' . $cls . '")]', $content_node);
                $arr = [];
                if ($junk_nodes) foreach ($junk_nodes as $j) $arr[] = $j;
                foreach ($arr as $j) { if ($j->parentNode) $j->parentNode->removeChild($j); }
            }
            $result['content'] = $doc->saveHTML($content_node);
        } else {
            // Absolute fallback: collect <p> tags
            $ps    = $xpath->query('//p');
            $parts = [];
            if ($ps) {
                foreach ($ps as $p) {
                    $text = trim($p->textContent);
                    if (mb_strlen($text) > 50) $parts[] = '<p>' . esc_html($text) . '</p>';
                }
            }
            $result['content'] = implode("\n", $parts);
        }

        $result['content'] = $this->clean_content($result['content']);

        // ── Excerpt ───────────────────────────────────────────────
        foreach ([
            '//meta[@name="description"]/@content',
            '//meta[@property="og:description"]/@content',
            '//meta[@name="twitter:description"]/@content',
        ] as $q) {
            $n = $xpath->query($q);
            if ($n && $n->length > 0) { $result['excerpt'] = trim($n->item(0)->nodeValue); break; }
        }
        if ( empty($result['excerpt']) && ! empty($result['content']) ) {
            $result['excerpt'] = wp_trim_words(wp_strip_all_tags($result['content']), 30, '…');
        }

        // ── Inline images ─────────────────────────────────────────
        $seen_imgs = [];
        $inline_imgs = $content_node ? $content_node->getElementsByTagName( 'img' ) : null;

        if ( ! $inline_imgs || $inline_imgs->length === 0 ) {
            $img_queries = [
                '//*[@itemprop="articleBody"]//img',
                '//div[contains(@class,"entry-content")]//img',
                '//div[contains(@class,"post-content")]//img',
                '//div[contains(@class,"article-content")]//img',
                '//article//img',
            ];
            foreach ( $img_queries as $iq ) {
                $inline_imgs = $xpath->query( $iq );
                if ( $inline_imgs && $inline_imgs->length > 0 ) break;
            }
        }

        if ( $inline_imgs ) {
            foreach ( $inline_imgs as $img ) {
                $src = $this->get_image_src( $img );
                if ( empty( $src ) ) continue;

                $src = $this->resolve_url( $src );
                if ( ! $this->is_article_image_node( $img, $src, false ) ) continue;
                if ( in_array( $src, $seen_imgs, true ) ) continue;

                $seen_imgs[] = $src;
                $result['images'][] = $src;
            }
        }

        if (empty($result['thumbnail']) && !empty($result['images'])) {
            $result['thumbnail'] = $result['images'][0];
        }

        return $result;
    }

    /* =========================================================
       HELPERS
    ========================================================= */

    private function find_nearby_heading( DOMNode $link ) {
        $parent = $link->parentNode;
        for ($i = 0; $i < 5 && $parent; $i++) {
            foreach (['h1','h2','h3','h4'] as $tag) {
                $hn = $parent->getElementsByTagName($tag);
                if ($hn->length > 0) {
                    $t = trim($hn->item(0)->textContent);
                    if (mb_strlen($t) > 5) return $t;
                }
            }
            $parent = $parent->parentNode;
        }
        return '';
    }

    private function find_nearby_image( DOMNode $link ) {
        $parent = $link->parentNode;
        for ($i = 0; $i < 4 && $parent; $i++) {
            $imgs = $parent->getElementsByTagName('img');
            if ($imgs->length > 0) {
                $img = $imgs->item(0);
                $src = $this->get_image_src( $img );
                if ( ! empty( $src ) ) {
                    $src = $this->resolve_url( $src );
                    if ( $this->is_article_image_node( $img, $src, true ) ) return $src;
                }
            }
            $parent = $parent->parentNode;
        }
        return '';
    }

    private function get_image_src( DOMElement $img ) {
        foreach ( [ 'src', 'data-src', 'data-lazy-src', 'data-original', 'data-srcset', 'srcset' ] as $attr ) {
            $value = trim( $img->getAttribute( $attr ) );
            if ( empty( $value ) || strpos( $value, 'data:' ) === 0 ) continue;

            if ( strpos( $attr, 'srcset' ) !== false ) {
                $parts = array_filter( array_map( 'trim', explode( ',', $value ) ) );
                if ( empty( $parts ) ) continue;
                $value = preg_split( '/\s+/', end( $parts ) )[0] ?? '';
            }

            if ( ! empty( $value ) ) return $value;
        }

        return '';
    }

    private function is_article_image_node( DOMElement $img, $url, $strict_size = false ) {
        if ( ! $this->is_article_image_url( $url ) ) return false;

        $class = strtolower( $img->getAttribute( 'class' ) );
        $alt   = strtolower( $img->getAttribute( 'alt' ) );
        $title = strtolower( $img->getAttribute( 'title' ) );

        if ( preg_match( '/\b(icon|logo|avatar|share|social|facebook|twitter|x-twitter|instagram|linkedin|youtube|email|print)\b/i', $class . ' ' . $alt . ' ' . $title ) ) {
            return false;
        }

        $w = (int) $img->getAttribute( 'width' );
        $h = (int) $img->getAttribute( 'height' );
        if ( ( $w > 0 && $w < 120 ) || ( $h > 0 && $h < 120 ) ) return false;
        if ( $strict_size && $w > 0 && $h > 0 && ( $w * $h ) < 30000 ) return false;

        return true;
    }

    private function is_article_image_url( $url ) {
        if ( empty( $url ) || strpos( $url, 'data:' ) === 0 ) return false;

        $path = strtolower( parse_url( $url, PHP_URL_PATH ) ?? '' );
        if ( empty( $path ) ) return false;

        $ext = strtolower( pathinfo( $path, PATHINFO_EXTENSION ) );
        if ( in_array( $ext, [ 'svg', 'ico', 'gif' ], true ) ) return false;

        if ( $ext && ! in_array( $ext, [ 'jpg', 'jpeg', 'png', 'webp' ], true ) ) return false;

        if ( preg_match( '#/(social|share|shares|icons?|logo|logos|avatar|avatars|emoji|sprite|tracking|analytics|fontawesome)(/|$)#i', $path ) ) {
            return false;
        }

        $base = strtolower( pathinfo( $path, PATHINFO_FILENAME ) );
        if ( preg_match( '/^(facebook|fb|twitter|x-twitter|instagram|linkedin|youtube|email|print|share|search|logo|favicon|icon)$/i', $base ) ) {
            return false;
        }

        return true;
    }

    private function clean_content($html) {
        $html = preg_replace('/<script\b[^>]*>.*?<\/script>/is',  '', $html);
        $html = preg_replace('/<style\b[^>]*>.*?<\/style>/is',    '', $html);
        $html = preg_replace('/\s+on\w+="[^"]*"/i',               '', $html);
        $html = preg_replace("/\s+on\w+='[^']*'/i",               '', $html);
        $html = preg_replace('/<p[^>]*>\s*<\/p>/i',               '', $html);
        $html = preg_replace('/<!--.*?-->/s',                      '', $html);
        return trim($html);
    }

    private function resolve_url($url) {
        if (empty($url)) return '';
        $url = trim($url);
        if (strpos($url,'//') === 0) return $this->normalize_url('https:' . $url);
        if (strpos($url,'http') === 0) return $this->normalize_url($url);
        $base = rtrim($this->get_base_domain(), '/');
        return $this->normalize_url($base . '/' . ltrim($url, '/'));
    }

    private function normalize_url($url) {
        $url = preg_replace_callback('/[^\x20-\x7E]/u', function($match) {
            return rawurlencode($match[0]);
        }, $url);
        return str_replace(' ', '%20', $url);
    }

    private function get_base_domain() {
        $parsed = parse_url($this->source_url);
        return ($parsed['scheme'] ?? 'https') . '://' . ($parsed['host'] ?? '');
    }

    private function deduplicate(array $articles) {
        $seen = [];
        $out  = [];
        foreach ($articles as $a) {
            $key = rtrim($a['url'], '/');
            if ($key && !isset($seen[$key])) { $seen[$key] = true; $out[] = $a; }
        }
        return $out;
    }
}
