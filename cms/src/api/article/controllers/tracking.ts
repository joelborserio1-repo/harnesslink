import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async view(ctx: Context) {
    await strapi.db.connection('articles').where({ slug: ctx.params.slug }).increment('view_count', 1);
    ctx.status = 204;
  },
});
