import Anthropic from '@anthropic-ai/sdk';
import type { Core } from '@strapi/strapi';
import { simpleParser, type Attachment, type ParsedMail } from 'mailparser';
import { inflateRawSync } from 'node:zlib';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CATEGORIES, HOUSE_STYLE } from './house-style';
import { absoluteUrl, searchPhotos } from './photos';

// Emailed stories, step 2: a stored email (hl_email_intake, src/email-intake.ts)
// becomes a draft story.
//
//   1. Sender check: the From address must be on the approved list (or a
//      staff address forwarding a story), and the receiving mail server must
//      have verified it (SPF/DKIM/DMARC), so nobody can pretend to be a sender.
//   2. Claude formats the story in house style (src/house-style.ts), keeping
//      the author's words and byline.
//   3. Chosen photos go into the media library; the first is the lead photo.
//   4. A draft is created, marked needs review, credited "Courtesy of …".
//
// Settings (cms environment):
//   ANTHROPIC_API_KEY        Claude. Unset: emails wait, nothing is lost.
//   EMAIL_INTAKE_SENDERS     approved senders: addresses or @domains, comma separated
//   EMAIL_INTAKE_STAFF       staff domains whose forwards are accepted (default harnesslink.com)

const MODEL = 'claude-opus-5-5';
const MAX_ATTEMPTS = 3;
const MIN_PHOTO_BYTES = 15 * 1024; // smaller images are logos and signatures
const MAX_CLAUDE_IMAGE_BYTES = 3.5 * 1024 * 1024;
const MAX_CLAUDE_IMAGES = 8;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

type Row = { id: number; raw: Buffer; envelope_from: string | null; attempts: number };

type Result = {
  is_story: boolean;
  skip_reason: string;
  title: string;
  excerpt: string;
  seo_title: string;
  seo_description: string;
  body_html: string;
  author_name: string;
  outlet_name: string;
  outlet_url: string;
  category: string;
  lead_photo: number;
  photos: { photo: number; caption: string; alt: string }[];
  photo_search_terms: string[];
  importance: 'major' | 'standard' | 'minor';
  importance_reason: string;
  roundup_html: string;
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'is_story', 'skip_reason', 'title', 'excerpt', 'seo_title', 'seo_description', 'body_html',
    'author_name', 'outlet_name', 'outlet_url', 'category', 'lead_photo', 'photos', 'photo_search_terms',
    'importance', 'importance_reason', 'roundup_html',
  ],
  properties: {
    is_story: { type: 'boolean' },
    skip_reason: { type: 'string', description: 'Why this is not a story; empty when it is.' },
    title: { type: 'string' },
    excerpt: { type: 'string' },
    seo_title: { type: 'string' },
    seo_description: { type: 'string' },
    body_html: { type: 'string' },
    author_name: { type: 'string', description: 'The original author, exactly as written. If no writer is named in the story, the name of the person who sent it to us (the From line of the forwarded message), unless that is a generic or organisation mailbox. Empty if neither gives a person.' },
    outlet_name: { type: 'string', description: 'The organisation or outlet the story comes from.' },
    outlet_url: { type: 'string', description: "The outlet's website if the email shows one, else empty." },
    category: { type: 'string', enum: [...CATEGORIES] },
    lead_photo: { type: 'integer', description: 'Number of the lead photo, or 0 for none.' },
    importance: { type: 'string', enum: ['major', 'standard', 'minor'] },
    importance_reason: { type: 'string' },
    roundup_html: { type: 'string', description: 'The story in two or three sentences as one <p>, for a daily roundup.' },
    photo_search_terms: {
      type: 'array',
      description: 'Names to search our photo archive with if no photo is attached: the main horse first, then its driver or trainer. Full names exactly as written. Up to 4.',
      items: { type: 'string' },
    },
    photos: {
      type: 'array',
      description: 'Every photo used (the lead photo and any [[PHOTO n]] in the body).',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['photo', 'caption', 'alt'],
        properties: {
          photo: { type: 'integer' },
          caption: { type: 'string' },
          alt: { type: 'string' },
        },
      },
    },
  },
} as const;

// ---------- sender check ----------

const list = (v: string | undefined) =>
  (v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

function matches(address: string, entries: string[]) {
  const domain = address.split('@')[1] || '';
  return entries.some((e) =>
    e.startsWith('@') ? domain === e.slice(1) || domain.endsWith(`.${e.slice(1)}`) : e === address
  );
}

// The receiving server's verdict (Authentication-Results). Accept DMARC pass,
// or DKIM/SPF pass for the sender's own domain.
function verified(mail: ParsedMail, address: string): boolean {
  const domain = address.split('@')[1] || '';
  const results = [mail.headers.get('authentication-results'), mail.headers.get('arc-authentication-results')]
    .flat()
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())
    .join(' ');
  if (!results || !domain) return false;
  if (/\bdmarc=pass\b/.test(results)) return true;
  const aligned = (d: string) => d === domain || domain.endsWith(`.${d}`) || d.endsWith(`.${domain}`);
  for (const m of results.matchAll(/\bdkim=pass\b[^;]*?header\.(?:d|i)=@?([a-z0-9.-]+)/g)) if (aligned(m[1])) return true;
  for (const m of results.matchAll(/\bspf=pass\b[^;]*?smtp\.mailfrom=(?:[^@\s;]*@)?([a-z0-9.-]+)/g)) if (aligned(m[1])) return true;
  return false;
}

function senderCheck(mail: ParsedMail): { ok: true; from: string; staff: boolean } | { ok: false; note: string } {
  const from = (mail.from?.value?.[0]?.address || '').toLowerCase();
  if (!from) return { ok: false, note: 'No sender address' };
  const staff = matches(from, list(process.env.EMAIL_INTAKE_STAFF || '@harnesslink.com').map((d) => (d.includes('@') ? d : `@${d}`)));
  if (!staff && !matches(from, list(process.env.EMAIL_INTAKE_SENDERS))) {
    return { ok: false, note: `Sender ${from} is not on the approved list` };
  }
  if (!verified(mail, from)) return { ok: false, note: `Could not verify that the email really came from ${from}` };
  return { ok: true, from, staff };
}

// ---------- attachments ----------

// Files in a zip, read with the zip's own directory and zlib, so no extra
// library is needed. Stops at MAX_UNZIPPED bytes in all (a zip bomb guard).
const MAX_UNZIPPED = 80 * 1024 * 1024;
function zipEntries(buf: Buffer, wanted?: (name: string) => boolean): { name: string; data: Buffer }[] {
  const out: { name: string; data: Buffer }[] = [];
  try {
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return out;
    const count = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);
    let total = 0;
    for (let n = 0; n < count; n++) {
      if (buf.readUInt32LE(p) !== 0x02014b50) break;
      const method = buf.readUInt16LE(p + 10);
      const size = buf.readUInt32LE(p + 20);
      const fullSize = buf.readUInt32LE(p + 24);
      const nameLen = buf.readUInt16LE(p + 28);
      const extra = buf.readUInt16LE(p + 30);
      const comment = buf.readUInt16LE(p + 32);
      const local = buf.readUInt32LE(p + 42);
      const name = buf.subarray(p + 46, p + 46 + nameLen).toString();
      p += 46 + nameLen + extra + comment;
      if (name.endsWith('/') || (wanted && !wanted(name)) || (method !== 0 && method !== 8)) continue;
      total += fullSize;
      if (total > MAX_UNZIPPED) break;
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      out.push({ name, data: method === 8 ? inflateRawSync(data) : Buffer.from(data) });
    }
  } catch {
    // a damaged zip: keep what was read
  }
  return out;
}

// Text of a .docx (a zip holding word/document.xml).
function docxText(buf: Buffer): string | null {
  const doc = zipEntries(buf, (n) => n === 'word/document.xml')[0];
  if (!doc) return null;
  return doc.data
    .toString('utf8')
    .split(/<\/w:p>/)
    .map((para) =>
      [...para.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)]
        .map((m) => (m[1] ?? (m[0].startsWith('<w:tab') ? '\t' : '\n')))
        .join('')
    )
    .map((s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim())
    .filter(Boolean)
    .join('\n\n');
}

// A zipped attachment (a Google Drive or OneDrive download, or "send as zip")
// is unpacked: the Word documents, PDFs and photos inside are treated as if
// they had been attached on their own.
const ZIP_TYPES: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};
const zipExt = (name: string) => (name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
const isZip = (a: Attachment) =>
  ['application/zip', 'application/x-zip-compressed'].includes(a.contentType) || /\.zip$/i.test(a.filename || '');

export function unzipAttachments(mail: ParsedMail) {
  const expanded: Attachment[] = [];
  for (const a of mail.attachments) {
    if (!isZip(a)) {
      expanded.push(a);
      continue;
    }
    const files = zipEntries(a.content, (n) => {
      const base = n.split('/').pop() || '';
      return !n.startsWith('__MACOSX/') && !base.startsWith('.') && !!ZIP_TYPES[zipExt(base)];
    });
    for (const f of files) {
      const filename = f.name.split('/').pop() || f.name;
      expanded.push({
        ...a,
        filename,
        contentType: ZIP_TYPES[zipExt(filename)],
        content: f.data,
        size: f.data.length,
        contentDisposition: 'attachment',
        related: false,
        cid: undefined,
        contentId: undefined,
        checksum: '',
      } as Attachment);
    }
  }
  mail.attachments = expanded;
}

// Attachments that are photos in disguise: a photo sent as a plain file
// ("application/octet-stream"), and photos inside a Word document
// (word/media/), which are added as attachments of their own.
const IMAGE_EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
function sniffImage(buf: Buffer): string | null {
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) return 'image/png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length > 4 && buf.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  return null;
}
export function normaliseAttachments(mail: ParsedMail) {
  const extra: Attachment[] = [];
  for (const a of mail.attachments) {
    if (!PHOTO_TYPES.includes(a.contentType)) {
      const byName = IMAGE_EXT[zipExt(a.filename || '')];
      const sniffed = sniffImage(a.content);
      if (sniffed && (byName || /octet-stream|^image\//.test(a.contentType))) a.contentType = sniffed;
    }
    if (isDocx(a)) {
      const base = (a.filename || 'document').replace(/\.docx$/i, '');
      zipEntries(a.content, (n) => n.startsWith('word/media/') && !!IMAGE_EXT[zipExt(n)]).forEach((f, i) => {
        const type = sniffImage(f.data) || IMAGE_EXT[zipExt(f.name)];
        if (!PHOTO_TYPES.includes(type) || f.data.length < MIN_PHOTO_BYTES) return;
        extra.push({ ...a, filename: `${base} photo ${i + 1}.${zipExt(f.name)}`, contentType: type, content: f.data, size: f.data.length, contentDisposition: 'attachment', related: false, cid: undefined, contentId: undefined, checksum: '' } as Attachment);
      });
    }
  }
  mail.attachments = [...mail.attachments, ...extra];
}

// The email text for Claude: no embedded images (base64 "data:" sources can run to
// millions of tokens), styles or scripts, and a sensible length cap.
const MAX_BODY_CHARS = 150_000;
export function bodyForClaude(mail: ParsedMail) {
  let body = mail.html ? String(mail.html) : mail.text || '';
  body = body
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/src\s*=\s*["']data:[^"']*["']/gi, 'src="(embedded image)"')
    .replace(/url\(\s*['"]?data:[^)]*\)/gi, 'none')
    .replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]{200,}/gi, '(embedded file)');
  return body.length > MAX_BODY_CHARS ? `${body.slice(0, MAX_BODY_CHARS)}\n[…email shortened]` : body;
}

const isPdf = (a: Attachment) => a.contentType === 'application/pdf' || /\.pdf$/i.test(a.filename || '');
const isDocx = (a: Attachment) =>
  a.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || /\.docx$/i.test(a.filename || '');
export const isPhoto = (a: Attachment) => PHOTO_TYPES.includes(a.contentType) && a.size >= MIN_PHOTO_BYTES;

// ---------- Claude ----------

async function format(mail: ParsedMail, photos: Attachment[]): Promise<Result> {
  const client = new Anthropic();
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  const notes: string[] = [];

  for (const a of mail.attachments) {
    if (isPdf(a)) {
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.content.toString('base64') }, title: a.filename || 'attachment.pdf' });
    } else if (isDocx(a)) {
      const text = docxText(a.content);
      notes.push(text ? `Word attachment "${a.filename}":\n${text}` : `Word attachment "${a.filename}" could not be read.`);
    }
  }
  photos.forEach((a, i) => {
    notes.push(`Photo ${i + 1}: ${a.filename || 'unnamed'} (${Math.round(a.size / 1024)} KB)`);
    if (i < MAX_CLAUDE_IMAGES && a.size <= MAX_CLAUDE_IMAGE_BYTES) {
      content.push({ type: 'text', text: `Photo ${i + 1}:` });
      content.push({ type: 'image', source: { type: 'base64', media_type: a.contentType as 'image/jpeg', data: a.content.toString('base64') } });
    }
  });

  const body = bodyForClaude(mail);
  content.push({
    type: 'text',
    text: [
      'Here is the emailed submission. Format it as a Harnesslink draft.',
      `<email>\nFrom: ${mail.from?.text || ''}\nDate: ${mail.date?.toISOString() || ''}\nSubject: ${mail.subject || ''}\n\n${body}\n</email>`,
      notes.length ? `<attachments>\n${notes.join('\n\n')}\n</attachments>` : 'No attachments.',
    ].join('\n\n'),
  });

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: HOUSE_STYLE,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
    messages: [{ role: 'user', content }],
  });
  if (response.stop_reason === 'refusal') throw new Error('Claude declined to format this email');
  if (response.stop_reason === 'max_tokens') throw new Error('Story too long to format in one go');
  const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  return JSON.parse(text) as Result;
}

// ---------- building the draft ----------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const slugify = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

export async function freeSlug(strapi: Core.Strapi, base: string, table: string, column = 'slug') {
  const db = strapi.db.connection;
  const root = base || 'story';
  for (let n = 1; n < 100; n++) {
    const slug = n === 1 ? root : `${root}-${n}`;
    const taken = await db(table).where(column, slug).first('id');
    const page = table === 'articles' ? await db('pages').where('path', slug).first('id') : null;
    if (!taken && !page) return slug;
  }
  return `${root}-${Date.now()}`;
}

async function uploadPhoto(strapi: Core.Strapi, a: Attachment, caption: string, alt: string) {
  const dir = await mkdtemp(join(tmpdir(), 'hl-intake-'));
  try {
    const name = (a.filename || `photo.${a.contentType.split('/')[1]}`).replace(/[^\w.-]+/g, '-');
    const filepath = join(dir, name);
    await writeFile(filepath, a.content);
    const [file] = await strapi.plugin('upload').service('upload').upload({
      data: { fileInfo: { name, caption, alternativeText: alt } },
      files: { filepath, originalFilename: name, mimetype: a.contentType, size: a.size },
    });
    return file as { id: number; url: string; width?: number; height?: number };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// No photo attached: the best recent archive photo whose title, caption or alt
// text actually names the horse (or person), so a loose match is never used.
async function archivePhoto(strapi: Core.Strapi, terms: string[]) {
  for (const raw of terms.slice(0, 4)) {
    const term = raw.trim();
    if (term.length < 3) continue;
    const words = term.toLowerCase().split(/\s+/).filter(Boolean);
    const { photos } = await searchPhotos(strapi, term, 1, 10);
    const hit = photos.find((p) => {
      const text = `${p.title || ''} ${p.caption || ''} ${p.alt || ''}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
    if (hit) return { ...hit, term };
  }
  return null;
}

async function findOrCreateAuthor(strapi: Core.Strapi, name: string) {
  const clean = name.replace(/^by\s+/i, '').trim().slice(0, 120);
  if (!clean) return null;
  const existing = await strapi.db.connection('authors').whereRaw('lower(name) = lower(?)', [clean]).first('document_id');
  if (existing) return existing.document_id as string;
  const slug = await freeSlug(strapi, slugify(clean), 'authors');
  const created = await strapi.documents('api::author.author').create({
    data: { name: clean, slug, legacyRefs: { source: 'email-intake' } } as never,
  });
  return created.documentId;
}

async function createDraft(strapi: Core.Strapi, row: Row, mail: ParsedMail, from: string, photos: Attachment[], r: Result) {
  const db = strapi.db.connection;
  const uploaded = new Map<number, { id: number; url: string; width?: number; height?: number; caption: string; alt: string }>();
  for (const p of r.photos) {
    const a = photos[p.photo - 1];
    if (!a || uploaded.has(p.photo)) continue;
    const file = await uploadPhoto(strapi, a, p.caption, p.alt);
    uploaded.set(p.photo, { ...file, caption: p.caption, alt: p.alt });
  }

  let body = r.body_html.replace(/<p>\s*\[\[PHOTO (\d+)\]\]\s*<\/p>|\[\[PHOTO (\d+)\]\]/g, (_m, a, b) => {
    const f = uploaded.get(Number(a || b));
    if (!f) return '';
    const size = f.width && f.height ? ` width="${f.width}" height="${f.height}"` : '';
    return `<figure class="image"><img src="${esc(absoluteUrl(f.url))}" alt="${esc(f.alt)}"${size}>${f.caption ? `<figcaption><strong>${esc(f.caption)}</strong></figcaption>` : ''}</figure>`;
  });
  const outlet = r.outlet_name.trim();
  // Our own stories (staff sending them in) get no "Courtesy of" line.
  if (outlet && !/^harness\s*link\b/i.test(outlet)) {
    const url = /^https?:\/\//i.test(r.outlet_url) ? r.outlet_url : '';
    body += `\n<p><em>Courtesy of ${url ? `<a href="${esc(url)}">${esc(outlet)}</a>` : esc(outlet)}</em></p>`;
  }

  const category = await db('categories').where('name', r.category).whereNotNull('published_at').first('document_id');
  const author = await findOrCreateAuthor(strapi, r.author_name);
  const lead = uploaded.get(r.lead_photo);
  const suggested = lead ? null : await archivePhoto(strapi, r.photo_search_terms || []);

  const doc = await strapi.documents('api::article.article').create({
    data: {
      title: r.title.slice(0, 250),
      slug: await freeSlug(strapi, slugify(r.title), 'articles'),
      excerpt: r.excerpt,
      bodyFormat: 'legacy_html',
      bodyHtml: body,
      needsReview: true,
      priority: r.importance,
      ...(category ? { primaryCategory: category.document_id, categories: [category.document_id] } : {}),
      ...(author ? { authors: [author] } : {}),
      ...(lead ? { featuredImage: lead.id } : {}),
      ...(suggested?.fileId ? { featuredImage: suggested.fileId } : {}),
      ...(suggested && !suggested.fileId
        ? { legacyImage: { url: suggested.url, width: suggested.width, height: suggested.height, alt: suggested.alt || suggested.term, caption: suggested.caption } }
        : {}),
      seo: { metaTitle: r.seo_title.slice(0, 70), metaDescription: r.seo_description.slice(0, 170) },
      importFlags: {
        source: 'email',
        intakeId: row.id,
        from,
        subject: mail.subject || null,
        outlet: outlet || null,
        author: r.author_name || null,
        importance: `${r.importance}: ${r.importance_reason}`,
        ...(suggested
          ? {
              editorNote: `No photo was attached. The lead photo was picked from our archive by searching "${suggested.term}". Check it shows the right horse or person before publishing.`,
              suggestedPhoto: suggested.url,
            }
          : !lead
            ? { editorNote: 'No photo was attached and none was found in the archive. Add a lead photo from the Photos panel.' }
            : {}),
      },
    } as never,
  });
  return doc.documentId;
}

// ---------- the step ----------

async function finish(strapi: Core.Strapi, id: number, status: string, note: string | null, documentId: string | null = null) {
  await strapi.db.connection('hl_email_intake').where({ id }).update({
    status,
    note,
    article_document_id: documentId,
    processed_at: strapi.db.connection.fn.now(),
  });
  strapi.log.info(`[email-intake] #${id} ${status}${note ? `: ${note}` : ''}${documentId ? ` → ${documentId}` : ''}`);
}

export async function processEmail(strapi: Core.Strapi, id: number) {
  const db = strapi.db.connection;
  if (!process.env.ANTHROPIC_API_KEY) return; // waits in 'received' until the key is set
  // Claim the row, so two runs never work on the same email.
  const [row] = (await db('hl_email_intake')
    .where({ id })
    .where((q) =>
      q.where('status', 'received').orWhere((q2) =>
        q2.where('status', 'processing').where('claimed_at', '<', db.raw("now() - interval '15 minutes'"))
      )
    )
    .update({ status: 'processing', claimed_at: db.fn.now(), attempts: db.raw('attempts + 1') })
    .returning(['id', 'raw', 'envelope_from', 'attempts'])) as Row[];
  if (!row) return;

  try {
    const mail = await simpleParser(row.raw);
    unzipAttachments(mail);
    normaliseAttachments(mail);
    const sender = senderCheck(mail);
    if (!sender.ok) return await finish(strapi, id, 'skipped', sender.note);

    // The same story forwarded twice: one draft is enough.
    const subject = String(mail.subject || '').replace(/^\s*((fwd?|re)\s*:\s*)+/i, '').trim().toLowerCase();
    if (subject.length > 8) {
      const twin = await db('hl_email_intake')
        .whereNot({ id })
        .whereIn('status', ['drafted', 'roundup', 'rounded', 'processing'])
        .where('received_at', '>', db.raw("now() - interval '2 days'"))
        .whereRaw("lower(regexp_replace(coalesce(subject,''), '^\\s*((fw|fwd|re)\\s*:\\s*)+', '', 'i')) = ?", [subject])
        .first('id');
      if (twin) return await finish(strapi, id, 'skipped', `Duplicate of email #${twin.id} (same subject within 2 days)`);
    }

    const photos = mail.attachments.filter(isPhoto);
    const result = await format(mail, photos);
    if (!result.is_story) return await finish(strapi, id, 'skipped', result.skip_reason || 'Not a story');

    // Minor news waits for the morning roundup instead of its own draft.
    if (result.importance === 'minor') {
      await db('hl_email_intake').where({ id }).update({
        roundup: JSON.stringify({
          title: result.title,
          category: result.category,
          html: result.roundup_html,
          outlet: result.outlet_name,
          outletUrl: result.outlet_url,
          terms: result.photo_search_terms || [],
          reason: result.importance_reason,
        }),
      });
      return await finish(strapi, id, 'roundup', `Minor: ${result.importance_reason}`);
    }

    const documentId = await createDraft(strapi, row, mail, sender.from, photos, result);
    await finish(strapi, id, 'drafted', null, documentId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const retryable =
      err instanceof Anthropic.RateLimitError ||
      err instanceof Anthropic.InternalServerError ||
      err instanceof Anthropic.APIConnectionError;
    if (retryable && row.attempts < MAX_ATTEMPTS) {
      await db('hl_email_intake').where({ id }).update({ status: 'received', note: `Will retry: ${message}` });
      strapi.log.warn(`[email-intake] #${id} will retry: ${message}`);
    } else {
      await finish(strapi, id, 'failed', message.slice(0, 500));
    }
  }
}

// Cron: anything still waiting (CMS restarted, Claude busy, key added later).
export async function processWaiting(strapi: Core.Strapi) {
  if (!process.env.ANTHROPIC_API_KEY) return;
  const db = strapi.db.connection;
  const rows = await db('hl_email_intake')
    .where((q) =>
      q.where('status', 'received').orWhere((q2) =>
        q2.where('status', 'processing').where('claimed_at', '<', db.raw("now() - interval '15 minutes'"))
      )
    )
    .where('attempts', '<', MAX_ATTEMPTS)
    .orderBy('id')
    .limit(5)
    .select('id');
  for (const r of rows) await processEmail(strapi, r.id);
}

// ---------- daily roundups ----------

// Minor emailed news (status 'roundup') becomes one draft per region group,
// built each morning (config/cron-tasks.ts): a short item per story with its
// credit, instead of a stream of thin separate stories.
const ROUNDUP_GROUPS: { name: string; categories: string[] }[] = [
  { name: 'North American', categories: ['USA', 'Canada'] },
  { name: 'Australia & New Zealand', categories: ['Australia', 'New Zealand'] },
  { name: 'International', categories: ['Europe', 'UK / IRE', 'International'] },
];

type RoundupItem = { title: string; category: string; html: string; outlet: string; outletUrl: string; terms: string[] };

const stripTags = (h: string) => h.replace(/<\/?(?!(?:strong|em|a)\b)[a-z][^>]*>/gi, '').trim();

export async function buildRoundups(strapi: Core.Strapi) {
  const db = strapi.db.connection;
  const rows = (await db('hl_email_intake').where('status', 'roundup').orderBy('id').select('id', 'roundup')) as {
    id: number;
    roundup: RoundupItem | string;
  }[];
  if (!rows.length) return;
  const date = new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Australia/Sydney' }).format(new Date());

  for (const group of ROUNDUP_GROUPS) {
    const items = rows
      .map((r) => ({ id: r.id, ...(typeof r.roundup === 'string' ? JSON.parse(r.roundup) : r.roundup) as RoundupItem }))
      .filter((r) => group.categories.includes(r.category));
    if (!items.length) continue;

    const body = items
      .map((it) => {
        const url = /^https?:\/\//i.test(it.outletUrl || '') ? it.outletUrl : '';
        const credit = it.outlet ? `<p><em>Courtesy of ${url ? `<a href="${esc(url)}">${esc(it.outlet)}</a>` : esc(it.outlet)}</em></p>` : '';
        const text = /^\s*<p>/i.test(it.html) ? it.html : `<p>${stripTags(it.html)}</p>`;
        return `<h3>${esc(it.title)}</h3>${text}${credit}`;
      })
      .join('\n');

    const title = `${group.name} Roundup: ${date}`;
    const cats = await db('categories').whereIn('name', [...new Set(items.map((i) => i.category))]).whereNotNull('published_at').select('name', 'document_id');
    const main = cats.find((c: any) => c.name === items[0].category) || cats[0];
    const photo = await archivePhoto(strapi, items.flatMap((i) => i.terms || []));

    const doc = await strapi.documents('api::article.article').create({
      data: {
        title,
        slug: await freeSlug(strapi, slugify(title), 'articles'),
        excerpt: `${items.length} ${items.length === 1 ? 'story' : 'stories'} from around the ${group.name === 'International' ? 'world' : 'region'}: ${items.slice(0, 3).map((i) => i.title).join('; ')}.`.slice(0, 300),
        bodyFormat: 'legacy_html',
        bodyHtml: body,
        needsReview: true,
        priority: 'standard',
        ...(main ? { primaryCategory: main.document_id, categories: cats.map((c: any) => c.document_id) } : {}),
        ...(photo?.fileId ? { featuredImage: photo.fileId } : {}),
        ...(photo && !photo.fileId ? { legacyImage: { url: photo.url, width: photo.width, height: photo.height, alt: photo.alt || photo.term, caption: photo.caption } } : {}),
        importFlags: {
          source: 'email-roundup',
          intakeIds: items.map((i) => i.id),
          editorNote: `Daily roundup of ${items.length} minor emailed ${items.length === 1 ? 'story' : 'stories'}. Cut or reorder items as you like.${photo ? ` Lead photo picked from the archive ("${photo.term}"): check it.` : ' Add a lead photo.'}`,
        },
      } as never,
    });
    await db('hl_email_intake').whereIn('id', items.map((i) => i.id)).update({
      status: 'rounded',
      article_document_id: doc.documentId,
      processed_at: db.fn.now(),
    });
    strapi.log.info(`[email-intake] ${title}: ${items.length} items → ${doc.documentId}`);
  }
}
