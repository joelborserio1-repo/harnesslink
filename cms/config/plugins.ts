import type { Core } from '@strapi/strapi';

const allowedMediaTypes = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.*',
  'text/plain',
  'text/csv',
];

const deniedTypes = [
  'image/svg+xml',
  'application/vnd.microsoft.portable-executable',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-dosexec',
  'application/x-sh',
  'text/x-shellscript',
  'application/x-mach-binary',
];

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'users-permissions': {
    config: {
      jwtManagement: 'refresh',
      sessions: {
        httpOnly: true,
      },
    },
  },
  // Header/footer menus, edited under Navigation. Items can point at a
  // section, page, writer or story, or at any URL.
  navigation: {
    enabled: true,
    config: {
      contentTypes: ['api::category.category', 'api::page.page', 'api::author.author', 'api::article.article'],
      defaultContentTypes: 'api::category.category',
      contentTypesNameFields: {
        'api::category.category': ['name'],
        'api::page.page': ['title'],
        'api::author.author': ['name'],
        'api::article.article': ['title'],
      },
      pathDefaultFields: {
        'api::category.category': ['slug'],
        'api::page.page': ['path'],
        'api::author.author': ['slug'],
        'api::article.article': ['slug'],
      },
      allowedLevels: 3,
      additionalFields: [
        {
          name: 'flag',
          label: 'Flag',
          description: 'Shows a country flag beside the item (au, nz, us, ca, eu, gb, se, fr).',
          type: 'select',
          multi: false,
          enabled: true,
          options: ['au', 'nz', 'us', 'ca', 'eu', 'gb', 'se', 'fr'],
        },
      ],
    },
  },
  // Embeds (YouTube, Vimeo, X, Instagram, Facebook …) pasted as a link.
  oembed: { enabled: true },
  // Reader comments on stories. New comments wait for an editor's approval.
  comments: {
    enabled: true,
    config: {
      enabledCollections: ['api::article.article'],
      approvalFlow: ['api::article.article'],
      entryLabel: { '*': ['title', 'name'] },
      blockedAuthorProps: ['email'],
      badWords: true,
    },
  },
  // Scheduled publish and unpublish dates on stories and pages.
  publisher: { enabled: true },
  // Site search. Headline, standfirst, byline, section and date only — the
  // story text stays out of the index to keep it small.
  meilisearch: {
    enabled: env('MEILI_HOST', '') !== '',
    config: {
      host: env('MEILI_HOST', ''),
      apiKey: env('MEILI_MASTER_KEY', ''),
      article: {
        indexName: 'articles',
        entriesQuery: {
          limit: 1000,
          status: 'published',
          fields: ['title', 'slug', 'subtitle', 'excerpt', 'publishDate', 'publishedAt'],
          populate: {
            authors: { fields: ['name', 'slug'] },
            primaryCategory: { fields: ['name', 'slug'] },
            featuredImage: { fields: ['url', 'formats'] },
            legacyImage: true,
          },
        },
        transformEntry({ entry }: { entry: Record<string, any> }) {
          const img = entry.featuredImage;
          // id, documentId and publishedAt are what the plugin keys and syncs on.
          return {
            id: entry.id,
            documentId: entry.documentId,
            publishedAt: entry.publishedAt,
            title: entry.title,
            slug: entry.slug,
            subtitle: entry.subtitle || '',
            excerpt: entry.excerpt || '',
            authors: (entry.authors || []).map((a: { name: string }) => a.name),
            authorSlugs: (entry.authors || []).map((a: { slug: string }) => a.slug),
            category: entry.primaryCategory?.name || '',
            categorySlug: entry.primaryCategory?.slug || '',
            image: img?.formats?.small?.url || img?.url || entry.legacyImage?.url || '',
            publishDate: entry.publishDate,
            publishTs: entry.publishDate ? Math.floor(new Date(entry.publishDate).getTime() / 1000) : 0,
          };
        },
        settings: {
          searchableAttributes: ['title', 'subtitle', 'authors', 'excerpt', 'category'],
          filterableAttributes: ['categorySlug', 'authors', 'publishTs'],
          sortableAttributes: ['publishTs'],
          rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness', 'publishTs:desc'],
        },
      },
    },
  },
  upload: {
    config: {
      security: {
        allowedTypes: allowedMediaTypes,
        deniedTypes,
      },
    },
  },
});

export default config;
