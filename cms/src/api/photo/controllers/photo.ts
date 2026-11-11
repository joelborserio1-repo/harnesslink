import type { Context } from 'koa';
import { searchPhotos } from '../../../photos';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Same search as the newsroom's Photos panel (src/photos.ts), plus what a
// caller needs to use a photo straight away:
//  - lead: the story's lead photo — `legacyImage` for archive photos, or
//    `featuredImage` (an upload id) for photos uploaded in the newsroom;
//  - figureHtml: the photo for the story body, in our standard markup.
export default {
  async search(ctx: Context) {
    const q = String(ctx.query.q || '').slice(0, 200);
    const page = Math.min(Math.max(parseInt(String(ctx.query.page || '1'), 10) || 1, 1), 200);
    const pageSize = Math.min(Math.max(parseInt(String(ctx.query.pageSize || '12'), 10) || 12, 1), 50);
    const res = await searchPhotos(strapi, q, page, pageSize);
    ctx.body = {
      ...res,
      photos: res.photos.map((p) => {
        const alt = p.alt || p.caption || p.title;
        const size = p.width && p.height ? ` width="${p.width}" height="${p.height}"` : '';
        return {
          ...p,
          lead: p.fileId
            ? { featuredImage: p.fileId }
            : { legacyImage: { url: p.url, width: p.width, height: p.height, alt, caption: p.caption || null, credit: null, legacyWpId: p.id } },
          figureHtml: `<figure class="image"><img src="${esc(p.url)}" alt="${esc(alt)}"${size}>${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}</figure>`,
        };
      }),
    };
  },
};
