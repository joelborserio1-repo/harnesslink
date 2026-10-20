'use strict';

// Maps one record from migration/export_posts.php to Strapi article/page data.
// Pure functions (no Strapi, no network) so they can be tested on their own.
// Legacy bodies are preserved as sanitised HTML (bodyFormat: legacy_html):
// scriptable markup is removed, everything else is left exactly as WordPress
// stored it.

const sanitizeHtml = require('sanitize-html');

// Same allowlist the Rails importer used — structure and embeds, nothing scriptable.
const ALLOWED_TAGS = [
  'p', 'br', 'a', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'blockquote', 'q',
  'h2', 'h3', 'h4', 'h5', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'img', 'figure', 'figcaption', 'picture', 'source',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'iframe', 'span', 'div', 'hr', 'pre', 'code',
];
const ALLOWED_ATTRS = [
  'href', 'src', 'srcset', 'sizes', 'alt', 'title', 'width', 'height',
  'colspan', 'rowspan', 'target', 'rel', 'loading',
  'allow', 'allowfullscreen', 'frameborder', 'class',
];

// Strapi's slug field accepts only these characters.
const UID_SAFE = /^[A-Za-z0-9\-_.~]+$/;

const EDITORIAL = ['Top 4', 'Blog', 'Articles', 'Podcast', 'Videos'];

function sanitize(html) {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { '*': ALLOWED_ATTRS },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: true,
    // Keep WordPress's markup as written: don't re-encode or reformat.
    parser: { decodeEntities: false },
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
  });
}

// WordPress exports GMT times as "YYYY-MM-DD HH:MM:SS" without a zone.
function parseGmt(value) {
  if (!value) return null;
  const iso = String(value).includes('T') ? String(value) : `${String(value).replace(' ', 'T')}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Rank Math stores robots as a serialized PHP array: a:2:{i:0;s:5:"index";…}
function parseRobots(value) {
  if (!value) return null;
  const s = String(value);
  let tokens = [...s.matchAll(/s:\d+:"([^"]+)"/g)].map((m) => m[1]);
  if (tokens.length === 0) tokens = s.split(',');
  const out = [...new Set(tokens.map((t) => t.trim()).filter(Boolean))].join(',');
  return out || null;
}

// The common Rank Math template variables, as the live site renders them.
function expandVars(value, post, siteName = 'Harnesslink') {
  if (!value) return null;
  const primary = (post.categories || [])[0];
  const year = (parseGmt(post.post_date) || new Date().toISOString()).slice(0, 4);
  const out = String(value)
    .replaceAll('%title%', post.post_title || '')
    .replaceAll('%sitename%', siteName)
    .replaceAll('%sep%', '-') // Rank Math separator on the live site is a hyphen
    .replaceAll('%page%', '')
    .replace(/%category%|%primary_category%/g, primary ? primary.name : '')
    .replaceAll('%currentyear%', year)
    .replace(/\s{2,}/g, ' ')
    .trim();
  return out || null;
}

// Hand-written excerpt, else WordPress's own auto-summary from the export.
function excerptOf(post) {
  return (post.post_excerpt || post.post_excerpt_auto || '').trim() || null;
}

function seoFrom(post) {
  const meta = post.meta || {};
  const seo = {
    // Explicit Rank Math title, else the site-wide format "%title% %sep% %sitename%".
    metaTitle: expandVars(meta.rank_math_title, post) || expandVars('%title% %sep% %sitename%', post),
    metaDescription: expandVars(meta.rank_math_description, post) || excerptOf(post),
    focusKeyword: meta.rank_math_focus_keyword || null,
    canonicalUrl: meta.rank_math_canonical_url || null,
    robots: parseRobots(meta.rank_math_robots) || 'index,follow',
    ogTitle: expandVars(meta.rank_math_facebook_title, post),
    ogDescription: expandVars(meta.rank_math_facebook_description, post),
    twitterTitle: expandVars(meta.rank_math_twitter_title, post),
    twitterDescription: expandVars(meta.rank_math_twitter_description, post),
    schemaType: 'NewsArticle',
  };
  for (const k of Object.keys(seo)) if (seo[k] === null) delete seo[k];
  return seo;
}

// The export carries the body as WordPress renders it (paragraphs, captions,
// embeds); fall back to the stored text for older exports.
function bodyOf(post) {
  return String(post.post_content_rendered ?? post.post_content ?? '');
}

function flagsFor(post) {
  const raw = bodyOf(post);
  const flags = [];
  if (raw.trim() === '') flags.push('empty_body');
  // A shortcode still present after WordPress rendered the body belongs to a
  // plugin that isn't coming across — it would show as literal text.
  // Editorial brackets like "[the horse]" are fine; flag only shortcode syntax:
  // attributes ([gallery ids="…"]) or a closing tag ([/caption]).
  const text = raw.replace(/<[^>]+>/g, '');
  if (/\[[a-z][a-z0-9_-]*\s+[a-z_-]+=/i.test(text) || /\[\/[a-z][a-z0-9_-]*\]/i.test(text)) flags.push('shortcodes');
  if (!post.post_content_rendered && !/<p[\s>]/i.test(raw) && /\r?\n\r?\n/.test(raw)) flags.push('unrendered_paragraphs');
  if (post.meta && post.meta._elementor_data) flags.push('elementor');
  return flags;
}

function legacyImage(featured) {
  if (!featured || !featured.url) return null;
  return {
    url: featured.url,
    width: featured.width || null,
    height: featured.height || null,
    alt: featured.alt || null,
    legacyWpId: featured.legacy_id || null,
  };
}

// → { data, refs, flags, skip } for one exported post.
function mapArticle(post) {
  const slug = String(post.post_name || '');
  if (!UID_SAFE.test(slug)) {
    return { skip: `slug "${slug}" has characters Strapi slugs cannot hold` };
  }
  const flags = flagsFor(post);
  const meta = post.meta || {};
  return {
    flags,
    refs: {
      categories: (post.categories || []).map((c) => ({
        name: c.name,
        slug: c.slug,
        legacyTermId: c.legacy_term_id || null,
        kind: c.kind || (EDITORIAL.includes(c.name) ? 'editorial' : 'geographic'),
      })),
      tags: (post.tags || []).map((t) => ({ name: t.name, slug: t.slug, legacyTermId: t.legacy_term_id || null })),
      authors: (post.authors || []).map((a) => ({ name: a.name, slug: a.slug, bio: a.bio || null, refs: a.refs || {} })),
      oldSlugs: post.old_slugs || [],
    },
    data: {
      title: post.post_title || slug,
      slug,
      subtitle: meta.post_subtitle || null,
      excerpt: excerptOf(post),
      bodyFormat: 'legacy_html',
      bodyHtml: sanitize(bodyOf(post)),
      publishDate: parseGmt(post.post_date),
      modifiedDate: parseGmt(post.post_modified),
      legacyImage: legacyImage(post.featured),
      seo: seoFrom(post),
      needsReview: flags.length > 0,
      importFlags: flags,
      legacyWpId: Number(post.id),
      legacyUrl: `/${slug}/`,
    },
  };
}

function mapPage(post) {
  const path = String(post.path || `/${post.post_name}/`).replace(/^\/+|\/+$/g, '');
  const seo = seoFrom(post);
  return {
    path,
    data: {
      title: post.post_title || path,
      path,
      bodyFormat: 'legacy_html',
      bodyHtml: sanitize(bodyOf(post)),
      modifiedDate: parseGmt(post.post_modified),
      seo,
      legacyWpId: Number(post.id),
    },
  };
}

module.exports = { mapArticle, mapPage, sanitize, parseGmt, parseRobots, expandVars, UID_SAFE };
