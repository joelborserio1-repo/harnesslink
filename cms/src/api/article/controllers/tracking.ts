import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';
import { isBot } from '../../ad/stats';
import { recordRead } from '../../../story-stats';

// Story-page beacon (web/src/components/article/ViewBeacon.tsx): the
// lifetime view_count, plus the daily reads by source in src/story-stats.ts.
export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async view(ctx: Context) {
    ctx.status = 204;
    if (isBot(ctx)) return;
    const slug = String(ctx.params.slug || '');
    await strapi.db.connection('articles').where({ slug }).increment('view_count', 1);
    try {
      await recordRead(strapi, ctx, slug);
    } catch (err) {
      strapi.log.warn(`[story-stats] ${slug}: ${err}`);
    }
  },
});
