// How the Strapi editing screens are laid out for the newsroom: plain-English
// labels and help text, the fields journalists use first, migration-only
// fields grouped at the bottom, and story lists newest-first.
//
// Applied at startup only when LAYOUT_VERSION changes, so rearrangements made
// in the admin later are kept until we deliberately ship a new version.

type FieldMeta = { label: string; description?: string; editable?: boolean };
type Row = Array<[name: string, size: number]>;
type Layout = {
  uid: string;
  list: string[];
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
  pageSize?: number;
  edit: Row[];
  fields: Record<string, FieldMeta>;
};

export const LAYOUT_VERSION = '2026-10-20.1';

const SEO_HELP = 'Search and social-media title/description. Leave blank to use the headline and standfirst.';

export const LAYOUTS: Layout[] = [
  {
    uid: 'api::article.article',
    list: ['title', 'primaryCategory', 'authors', 'publishDate'],
    sortBy: 'publishDate',
    sortOrder: 'DESC',
    pageSize: 20,
    edit: [
      [['title', 12]],
      [['subtitle', 12]],
      [['excerpt', 8], ['slug', 4]],
      [['body', 12]],
      [['featuredImage', 6], ['authors', 6]],
      [['primaryCategory', 6], ['categories', 6]],
      [['tags', 12]],
      [['publishDate', 4], ['scheduledFor', 4], ['modifiedDate', 4]],
      [['seo', 12]],
      [['bodyFormat', 4], ['needsReview', 4], ['viewCount', 4]],
      [['bodyHtml', 12]],
      [['legacyImage', 12]],
      [['legacyWpId', 4], ['legacyUrl', 8]],
      [['importFlags', 12]],
    ],
    fields: {
      title: { label: 'Headline' },
      subtitle: { label: 'Subheading', description: 'Optional line under the headline.' },
      excerpt: { label: 'Standfirst / summary', description: 'One or two sentences. Used on story cards, in search results and social shares.' },
      slug: { label: 'URL', description: 'The story lives at harnesslink.com/<this>/. Never change it after publishing.' },
      body: { label: 'Story', description: 'Write the story here.' },
      featuredImage: { label: 'Lead photo', description: 'Shown on story cards and at the top of the story. Fill in the alt text in the media library.' },
      authors: { label: 'Byline', description: 'First writer listed is the main byline.' },
      primaryCategory: { label: 'Main section', description: 'The country/section shown above the headline (e.g. Australia).' },
      categories: { label: 'All sections', description: 'Every section the story should appear in, including Top 4.' },
      tags: { label: 'Tags', description: 'Horses, drivers, trainers, tracks and races mentioned.' },
      publishDate: { label: 'Publish date', description: 'Shown on the story. Filled in automatically when published.' },
      scheduledFor: { label: 'Schedule for', description: 'Leave the story as a draft and set a time: it publishes itself within a minute of then.' },
      modifiedDate: { label: 'Last updated' },
      seo: { label: 'Search & social', description: SEO_HELP },
      bodyFormat: { label: 'Body type', description: 'blocks = written in Strapi. legacy_html = migrated from WordPress (edit in the HTML box below).' },
      needsReview: { label: 'Needs a check', description: 'Set by the migration when something in the old story may not display correctly.' },
      viewCount: { label: 'Views', editable: false },
      bodyHtml: { label: 'Migrated story HTML', description: 'Only for stories brought over from WordPress. Edit with care — this is the exact HTML the page shows.' },
      legacyImage: { label: 'Migrated lead photo', description: 'Photo still served from the old WordPress uploads. Replace it by adding a Lead photo above.' },
      legacyWpId: { label: 'WordPress ID', editable: false },
      legacyUrl: { label: 'Original URL', editable: false },
      importFlags: { label: 'Migration notes', editable: false },
    },
  },
  {
    uid: 'api::ad.ad',
    list: ['name', 'zone', 'active', 'endsAt', 'clicks'],
    sortBy: 'zone',
    sortOrder: 'ASC',
    edit: [
      [['name', 6], ['zone', 6]],
      [['image', 6], ['linkUrl', 6]],
      [['imageWidth', 3], ['imageHeight', 3], ['alt', 6]],
      [['imageUrl', 12]],
      [['active', 3], ['weight', 3], ['startsAt', 3], ['endsAt', 3]],
      [['html', 12]],
      [['impressions', 6], ['clicks', 6]],
    ],
    fields: {
      name: { label: 'Name', description: 'For your reference, e.g. "Lazarus — box, Oct".' },
      zone: { label: 'Placement', description: 'billboard = full-width 1360×150 · banners = 800×120 · rails = 300×250 boxes (three shown at once).' },
      image: { label: 'Creative', description: 'Upload the artwork at the placement size.' },
      linkUrl: { label: 'Click-through URL' },
      imageWidth: { label: 'Width (px)', description: 'Lets the page reserve space so nothing jumps while the ad loads.' },
      imageHeight: { label: 'Height (px)' },
      alt: { label: 'Alt text' },
      imageUrl: { label: 'Creative URL (instead of uploading)', description: 'Only if the artwork is hosted elsewhere.' },
      active: { label: 'Running' },
      weight: { label: 'Share', description: 'Relative share against other ads in the same placement (2 = twice as often as 1).' },
      startsAt: { label: 'Starts' },
      endsAt: { label: 'Ends' },
      html: { label: 'HTML creative (optional)', description: 'Third-party ad code. Replaces the image if filled in.' },
      impressions: { label: 'Impressions', editable: false },
      clicks: { label: 'Clicks', editable: false },
    },
  },
  {
    uid: 'api::author.author',
    list: ['name', 'roleTitle', 'slug'],
    sortBy: 'name',
    sortOrder: 'ASC',
    edit: [[['name', 6], ['slug', 6]], [['roleTitle', 6], ['email', 6]], [['bio', 12]], [['avatar', 6]], [['articles', 12]], [['legacyRefs', 12]]],
    fields: {
      name: { label: 'Name' },
      slug: { label: 'URL', description: 'Writer page: harnesslink.com/writers/<this>/' },
      roleTitle: { label: 'Role', description: 'e.g. Senior Writer, Australia' },
      bio: { label: 'Bio', description: 'Shown at the end of their stories.' },
      avatar: { label: 'Photo' },
      email: { label: 'Email (private)' },
      articles: { label: 'Stories' },
      legacyRefs: { label: 'WordPress references', editable: false },
    },
  },
  {
    uid: 'api::page.page',
    list: ['title', 'path', 'updatedAt'],
    sortBy: 'path',
    sortOrder: 'ASC',
    edit: [[['title', 8], ['path', 4]], [['body', 12]], [['seo', 12]], [['bodyFormat', 4], ['modifiedDate', 4], ['legacyWpId', 4]], [['bodyHtml', 12]]],
    fields: {
      title: { label: 'Title' },
      path: { label: 'URL path', description: 'e.g. privacy-policy → harnesslink.com/privacy-policy/' },
      body: { label: 'Page content' },
      seo: { label: 'Search & social', description: SEO_HELP },
      bodyFormat: { label: 'Body type' },
      bodyHtml: { label: 'Migrated page HTML' },
      modifiedDate: { label: 'Last updated' },
      legacyWpId: { label: 'WordPress ID', editable: false },
    },
  },
  {
    uid: 'api::redirect.redirect',
    list: ['fromPath', 'toPath', 'statusCode', 'hits'],
    sortBy: 'hits',
    sortOrder: 'DESC',
    edit: [[['fromPath', 6], ['toPath', 6]], [['statusCode', 4], ['hits', 4], ['reason', 4]]],
    fields: {
      fromPath: { label: 'Old URL', description: 'Path only, e.g. /old-story-name/' },
      toPath: { label: 'Send to', description: 'Path (/new-story/) or full URL.' },
      statusCode: { label: 'Type', description: '301 = moved permanently (almost always right).' },
      hits: { label: 'Times used', editable: false },
      reason: { label: 'Why' },
    },
  },
  {
    uid: 'api::missed-path.missed-path',
    list: ['path', 'hits', 'lastSeenAt', 'lastReferer'],
    sortBy: 'hits',
    sortOrder: 'DESC',
    edit: [[['path', 12]], [['hits', 4], ['lastSeenAt', 4]], [['lastReferer', 12]]],
    fields: {
      path: { label: 'URL not found', description: 'Add a Redirect for this path if it should go somewhere.' },
      hits: { label: 'Times requested', editable: false },
      lastSeenAt: { label: 'Last requested', editable: false },
      lastReferer: { label: 'Linked from', editable: false },
    },
  },
];
