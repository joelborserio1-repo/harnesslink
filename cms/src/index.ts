import type { Core } from '@strapi/strapi';
import { LAYOUTS, LAYOUT_VERSION } from './admin-layouts';
import { seedMenus } from './menus';
import { applyPluginSettings } from './plugin-settings';

// What the public website may read without a token (Users & Permissions
// "Public" role). Ads, subscribers, redirects and the 404 log are only reached
// through their own narrow routes, never listed.
const PUBLIC_READ = [
  'api::article.article',
  'api::author.author',
  'api::category.category',
  'api::tag.tag',
  'api::page.page',
  'api::country.country',
];

// Plugin endpoints the website calls: menus, and reader comments (read and
// post; posts wait for an editor's approval before they show).
const PUBLIC_PLUGIN_ACTIONS = [
  'plugin::navigation.client.render',
  'plugin::navigation.client.renderChild',
  'plugin::comments.client.findAllFlat',
  'plugin::comments.client.findAllInHierarchy',
  'plugin::comments.client.post',
  'plugin::comments.client.reportAbuse',
];

async function grantPublicRead(strapi: Core.Strapi) {
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'public' } });
  if (!role) return;
  const actions = [...PUBLIC_READ.flatMap((uid) => [`${uid}.find`, `${uid}.findOne`]), ...PUBLIC_PLUGIN_ACTIONS];
  for (const action of actions) {
    const exists = await strapi.db
      .query('plugin::users-permissions.permission')
      .findOne({ where: { action, role: role.id } });
    if (!exists) {
      await strapi.db.query('plugin::users-permissions.permission').create({ data: { action, role: role.id } });
    }
  }
}

// Journalists use Strapi's built-in "Author" role: they write and edit their
// own stories but only editors (built-in "Editor" role) and admins publish.
async function authorsCannotPublish(strapi: Core.Strapi) {
  const author = await strapi.db.query('admin::role').findOne({ where: { code: 'strapi-author' } });
  if (!author) return;
  await strapi.db.query('admin::permission').deleteMany({
    where: {
      role: author.id,
      action: 'plugin::content-manager.explorer.publish',
      subject: { $in: ['api::article.article', 'api::page.page'] },
    },
  });
}

// Indexes Strapi doesn't create on its own. With 64,000+ stories, lookups by
// URL slug, WordPress id and publish date must never scan the table (the site
// filters and sorts on them on every page; the importer looks up by id).
const INDEXES: Array<[name: string, table: string, columns: string]> = [
  ['hl_articles_slug', 'articles', 'slug'],
  ['hl_articles_legacy_wp_id', 'articles', 'legacy_wp_id'],
  ['hl_articles_legacy_url', 'articles', 'legacy_url'], // checked for uniqueness on every publish
  ['hl_articles_publish_date', 'articles', 'publish_date DESC'],
  ['hl_articles_published_at', 'articles', 'published_at'],
  ['hl_redirects_from_path', 'redirects', 'from_path'],
  ['hl_authors_slug', 'authors', 'slug'],
  ['hl_categories_slug', 'categories', 'slug'],
  ['hl_tags_slug', 'tags', 'slug'],
  ['hl_directory_listings_legacy_id', 'directory_listings', 'legacy_id'],
  ['hl_directory_listings_type', 'directory_listings', 'directory_type, is_featured'],
];

async function ensureIndexes(strapi: Core.Strapi) {
  if (strapi.db.dialect.client !== 'postgres') return;
  for (const [name, table, columns] of INDEXES) {
    await strapi.db.connection.raw(`CREATE INDEX IF NOT EXISTS ${name} ON ${table} (${columns})`);
  }
}

// Apply the newsroom editing layouts (src/admin-layouts.ts) once per version.
async function applyEditorLayouts(strapi: Core.Strapi) {
  const store = strapi.store({ type: 'plugin', name: 'harnesslink' });
  if ((await store.get({ key: 'layout_version' })) === LAYOUT_VERSION) return;

  const cm = strapi.store({ type: 'plugin', name: 'content_manager' });
  for (const layout of LAYOUTS) {
    const key = `configuration_content_types::${layout.uid}`;
    const config = (await cm.get({ key })) as {
      settings: Record<string, unknown>;
      metadatas: Record<string, { edit: Record<string, unknown>; list: Record<string, unknown> }>;
      layouts: { list: string[]; edit: Array<Array<{ name: string; size: number }>> };
    } | null;
    if (!config) continue; // Strapi writes defaults on first boot; we refine them next start

    const known = new Set(Object.keys(config.metadatas));
    const rows = layout.edit
      .map((row) => row.filter(([name]) => known.has(name)).map(([name, size]) => ({ name, size })))
      .filter((row) => row.length > 0);
    // Anything not placed above keeps a slot at the end rather than vanishing.
    const placed = new Set(rows.flat().map((f) => f.name));
    const editable = new Set(config.layouts.edit.flat().map((f) => f.name));
    for (const name of editable) if (!placed.has(name)) rows.push([{ name, size: 6 }]);

    config.settings = {
      ...config.settings,
      defaultSortBy: layout.sortBy,
      defaultSortOrder: layout.sortOrder,
      ...(layout.pageSize ? { pageSize: layout.pageSize } : {}),
    };
    config.layouts = { ...config.layouts, list: layout.list.filter((f) => known.has(f) || f === 'id'), edit: rows };
    for (const [name, meta] of Object.entries(layout.fields)) {
      if (!config.metadatas[name]) continue;
      config.metadatas[name].edit = {
        ...config.metadatas[name].edit,
        label: meta.label,
        ...(meta.description !== undefined ? { description: meta.description } : {}),
        ...(meta.editable === false ? { editable: false } : {}),
      };
      config.metadatas[name].list = { ...config.metadatas[name].list, label: meta.label };
    }
    await cm.set({ key, value: config });
  }
  await store.set({ key: 'layout_version', value: LAYOUT_VERSION });
  strapi.log.info(`[harnesslink] editor layouts applied (${LAYOUT_VERSION})`);
}

// A story's date is `publishDate` (migrated stories keep their WordPress
// date). One published for the first time from the admin — by hand or by
// Publisher's schedule — gets the moment it went live; later edits keep it.
const DATED = ['api::article.article'];

function datePublishedStories(strapi: Core.Strapi) {
  strapi.documents.use(async (ctx, next) => {
    if (ctx.action === 'publish' && DATED.includes(ctx.uid)) {
      const documentId = (ctx.params as { documentId?: string }).documentId;
      if (documentId) {
        const docs = strapi.documents(ctx.uid as 'api::article.article');
        const draft = await docs.findOne({ documentId, status: 'draft', fields: ['publishDate'] });
        if (draft && !draft.publishDate) {
          await docs.update({ documentId, data: { publishDate: new Date().toISOString() } as never });
        }
      }
    }
    return next();
  });
}

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    datePublishedStories(strapi);
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureIndexes(strapi);
    await grantPublicRead(strapi);
    await authorsCannotPublish(strapi);
    await applyEditorLayouts(strapi);
    await applyPluginSettings(strapi);
    await seedMenus(strapi);
  },
};
