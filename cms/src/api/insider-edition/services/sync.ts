import type { Core } from '@strapi/strapi';

// Copies The Insider from Mailchimp's public campaign archive into "Insider
// edition" entries, served at /edition/<slug>/ as on the old site (cron every
// 6 hours). No API key needed: the archive page lists every campaign sent to
// the list, and each links to the email as sent. The editions that existed in
// WordPress were brought across by scripts/import-insider-editions.js, which
// uses copy() below.
//
// - Only campaigns whose subject names The Insider are taken; one-off
//   announcements are skipped.
// - Re-sends ("In case you missed…", resends to non-openers) share a subject
//   with the original, so each edition is created once, from its first send.
// - The stored email has Mailchimp's archive bar, scripts and the personal
//   "update preferences / unsubscribe" footer removed. The site shows it in a
//   sandboxed frame, so nothing in it can run.
// - An edition whose date is already here (e.g. from WordPress) is skipped;
//   editions already copied are never changed, so editors' edits stick.

const UID = 'api::insider-edition.insider-edition';
const ARCHIVE =
  process.env.MAILCHIMP_ARCHIVE_URL || 'https://us12.campaign-archive.com/home/?u=edf4452953733a169ad8027d5&id=2773562eef';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

type Campaign = { sent: string; subject: string; url: string };

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#8211;|&ndash;/g, '–');

// "In case you missed the HarnessLink | The Insider - 1st October 2026" → the
// original subject.
const baseSubject = (s: string) => decode(s).replace(/^in case you missed( it)?[:\s-]*(the\s+)?/i, '').trim();

// "… The Insider - 5th November 2026" → 2026-11-05
export function editionDate(subject: string): string | null {
  const m = subject.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLowerCase());
  if (month < 0) return null;
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

const slugOf = (subject: string) =>
  'harnesslink-insider-' +
  subject
    .replace(/^.*the insider\s*[-–|:]\s*/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

async function get(url: string): Promise<string> {
  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Harnesslink site (archive copy)' }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
}

function parseArchive(html: string): Campaign[] {
  const out: Campaign[] = [];
  const re = /(\d{2})\/(\d{2})\/(\d{4})\s*-\s*<a href="([^"]+)"[^>]*title="([^"]*)"/g;
  for (let m; (m = re.exec(html)); ) out.push({ sent: `${m[3]}-${m[1]}-${m[2]}`, url: m[4], subject: decode(m[5]) });
  return out;
}

export function cleanEmail(html: string): string {
  let s = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*archivebar[^>]*>/gi, '')
    .replace(/<link\b[^>]*campaign-archive[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/(href|src)\s*=\s*"javascript:[^"]*"/gi, '$1="#"')
    // The personal footer: "Want to change how you receive these emails? You
    // can update your preferences or unsubscribe from this list."
    .replace(/Want to change how you receive these emails\?[\s\S]*?unsubscribe from this list<\/span><\/a>(?:<span[^>]*>\.<\/span>)?/i, '')
    .replace(/<a\b[^>]*list-manage\.com\/(?:unsubscribe|profile)[^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/\*\|[A-Z_:]+\|\*/g, '');
  // Hide Mailchimp's archive bar; open links in a new tab.
  const head = '<base target="_blank"><style>#awesomewrap{display:none!important}body{margin:0!important}</style>';
  s = /<head[^>]*>/i.test(s) ? s.replace(/<head[^>]*>/i, (m) => m + head) : head + s;
  return s;
}

export const previewText = (html: string) => {
  const m = html.match(/class="mcnPreviewText"[^>]*>([\s\S]*?)<\/span>/i);
  return m ? decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim().slice(0, 300) || null : null;
};

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  // Creates one published edition from its Mailchimp page.
  async copy(e: { title: string; slug: string; date: string; url: string; sentAt?: string | null; legacyWpId?: number | null; subject?: string | null; seo?: Record<string, unknown> | null }) {
    const res = await fetch(e.url, { redirect: 'follow', headers: { 'User-Agent': 'Harnesslink site (archive copy)' }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`${e.url} answered ${res.status}`);
    const raw = await res.text();
    return strapi.documents(UID).create({
      data: {
        title: e.title,
        slug: e.slug,
        editionDate: e.date,
        sentAt: e.sentAt || new Date(`${e.date}T00:00:00Z`).toISOString(),
        summary: previewText(raw),
        html: cleanEmail(raw),
        mailchimpUrl: res.url || e.url,
        mailchimpTitle: e.subject || null,
        legacyWpId: e.legacyWpId ?? null,
        seo: e.seo || undefined,
      } as any,
      status: 'published',
    });
  },

  async run() {
    let campaigns: Campaign[];
    try {
      campaigns = parseArchive(await get(ARCHIVE));
    } catch (e) {
      strapi.log.warn(`[insider] archive unavailable: ${(e as Error).message}`);
      return { created: 0 };
    }
    // Oldest first, so the first send of each subject wins.
    campaigns.sort((a, b) => a.sent.localeCompare(b.sent));
    const seen = new Set<string>();
    let created = 0;
    for (const c of campaigns) {
      const subject = baseSubject(c.subject);
      if (!/the insider/i.test(subject) || seen.has(subject)) continue;
      seen.add(subject);
      const date = editionDate(subject) || c.sent;
      const exists = await strapi.db.query(UID).findOne({ where: { $or: [{ mailchimpTitle: subject }, { editionDate: date }] }, select: ['id'] });
      if (exists) continue;
      let slug = slugOf(subject);
      if (await strapi.db.query(UID).findOne({ where: { slug }, select: ['id'] })) slug = `${slug}-${date}`;
      try {
        await this.copy({ title: subject.replace(/^HarnessLink\s*\|\s*/i, ''), slug, date, url: c.url, sentAt: new Date(`${c.sent}T00:00:00Z`).toISOString(), subject });
        created += 1;
        strapi.log.info(`[insider] added "${subject}"`);
      } catch (e) {
        strapi.log.warn(`[insider] couldn't copy "${subject}": ${(e as Error).message}`);
      }
    }
    return { created };
  },
});
