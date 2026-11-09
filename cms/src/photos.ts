import type { Core } from '@strapi/strapi';

// Photo archive: every photo in the WordPress media library (≈134k), searchable
// from the newsroom by horse, driver, trainer, track — or by the headline of a
// story it ran with. Filled and kept current by scripts/import-photos.js (run
// from migration/sync_from_wordpress.sh every 10 minutes).
//
// The photos themselves stay where they are (WordPress uploads, R2 after
// cutover); this table only describes them. Rows whose file is missing on
// disk (≈40k old attachment records) are kept but never shown.

export const PHOTO_TABLE = 'hl_photos';

// Words from the file name: "10-8-17-National-Debt-with-Stephane-Gendron.jpg"
// → "10 8 17 National Debt with Stephane Gendron".
const FILE_WORDS = `regexp_replace(regexp_replace(url, '^.*/|\\.[A-Za-z0-9]+$', '', 'g'), '[-_.]+', ' ', 'g')`;

export async function ensurePhotoTable(strapi: Core.Strapi) {
  const db = strapi.db.connection;
  if (await db.schema.hasTable(PHOTO_TABLE)) return;
  await db.schema.createTable(PHOTO_TABLE, (t) => {
    t.bigInteger('wp_id').primary();
    t.text('url').notNullable();
    t.text('thumb');
    t.text('title').notNullable().defaultTo('');
    t.text('alt').notNullable().defaultTo('');
    t.text('caption').notNullable().defaultTo('');
    t.text('description').notNullable().defaultTo('');
    t.string('mime', 40);
    t.integer('width');
    t.integer('height');
    t.timestamp('uploaded_at', { useTz: true });
    t.timestamp('modified_at', { useTz: true });
    t.bigInteger('parent_wp_id');
    t.boolean('on_disk').notNullable().defaultTo(true);
    // Headlines of the stories it appeared in (featured or in the body), and
    // when it was last used — filled by the usage refresh.
    t.text('stories').notNullable().defaultTo('');
    t.integer('story_count').notNullable().defaultTo(0);
    t.timestamp('last_used_at', { useTz: true });
    t.specificType(
      'search',
      `tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(alt, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(caption, '') || ' ' || coalesce(stories, '')), 'B') ||
        setweight(to_tsvector('simple', ${FILE_WORDS}), 'C') ||
        setweight(to_tsvector('simple', coalesce(description, '')), 'D')
      ) STORED`,
    );
    t.timestamp('synced_at', { useTz: true }).notNullable().defaultTo(db.fn.now());
  });
  await db.raw(`CREATE INDEX hl_photos_search ON ${PHOTO_TABLE} USING GIN (search)`);
  await db.raw(`CREATE INDEX hl_photos_recent ON ${PHOTO_TABLE} (uploaded_at DESC) WHERE on_disk`);
  await db.raw(`CREATE INDEX hl_photos_parent ON ${PHOTO_TABLE} (parent_wp_id)`);
}

// "lazarus gold coast" → 'lazarus:* & gold:* & coast:*' (every word, as a prefix,
// so results narrow as you type).
export function photoQuery(q: string) {
  const words = String(q || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .match(/[\p{L}\p{N}]+/gu);
  return words ? words.slice(0, 8).map((w) => `${w}:*`).join(' & ') : '';
}

export async function searchPhotos(strapi: Core.Strapi, q: string, page = 1, pageSize = 24) {
  const db = strapi.db.connection;
  const tsq = photoQuery(q);
  const offset = (Math.max(page, 1) - 1) * pageSize;
  const cols = 'wp_id, url, thumb, title, alt, caption, width, height, uploaded_at, stories, story_count, last_used_at';
  let rows: any[];
  let total: number;
  if (tsq) {
    // Best match, weighted firmly towards recent photos (a horse's current
    // colours, a driver's current face): this year ×1.3, five years ago ×0.47.
    const res = await db.raw(
      `SELECT ${cols}, count(*) OVER () AS total
         FROM ${PHOTO_TABLE}, to_tsquery('simple', ?) q
        WHERE on_disk AND search @@ q
        ORDER BY ts_rank(search, q) * (0.3 + 1 / (1 + extract(epoch FROM now() - coalesce(last_used_at, uploaded_at)) / 31557600)) DESC,
                 uploaded_at DESC
        LIMIT ? OFFSET ?`,
      [tsq, pageSize, offset],
    );
    rows = res.rows;
    total = Number(rows[0]?.total || 0);
  } else {
    rows = await db(PHOTO_TABLE).select(db.raw(cols)).where('on_disk', true).orderBy('uploaded_at', 'desc').limit(pageSize).offset(offset);
    total = Number((await db(PHOTO_TABLE).where('on_disk', true).count({ n: '*' }))[0].n);
  }
  return {
    total,
    page,
    pageSize,
    photos: rows.map((r) => ({
      id: Number(r.wp_id),
      url: r.url,
      thumb: r.thumb || r.url,
      title: r.title,
      alt: r.alt,
      caption: r.caption,
      width: r.width,
      height: r.height,
      uploadedAt: r.uploaded_at,
      stories: r.stories ? String(r.stories).split('\n').filter(Boolean) : [],
      storyCount: r.story_count,
      lastUsedAt: r.last_used_at,
    })),
  };
}

export function registerPhotoRoutes(strapi: Core.Strapi) {
  strapi.server.routes({
    type: 'admin',
    prefix: '',
    routes: [
      {
        // Anyone signed in to the newsroom may search (journalists included).
        method: 'GET',
        path: '/hl-photos/search',
        config: { policies: ['admin::isAuthenticatedAdmin'] },
        handler: async (ctx: any) => {
          const page = Math.min(Math.max(parseInt(String(ctx.query.page || '1'), 10) || 1, 1), 200);
          const size = Math.min(Math.max(parseInt(String(ctx.query.pageSize || '24'), 10) || 24, 1), 60);
          ctx.body = await searchPhotos(strapi, String(ctx.query.q || '').slice(0, 200), page, size);
        },
      },
    ],
  } as any);
}
