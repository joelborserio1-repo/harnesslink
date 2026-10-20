import type { Core } from '@strapi/strapi';

// The Navigation and Comments plugins read their settings from the database
// (what their Settings pages save), not from config/plugins.ts — so on a
// fresh install comment approval and hiding readers' emails would be off.
// Copy the file settings across when the saved ones are missing or lack what
// we rely on; anything changed later on the Settings pages is kept.
const PLUGINS: Array<{ name: string; ok: (saved: Record<string, any>) => boolean }> = [
  {
    name: 'navigation',
    ok: (s) => (s.additionalFields || []).some((f: any) => typeof f === 'object' && f.name === 'flag' && f.enabled),
  },
  {
    name: 'comments',
    ok: (s) => (s.approvalFlow || []).includes('api::article.article') && (s.blockedAuthorProps || []).includes('email'),
  },
];

export async function applyPluginSettings(strapi: Core.Strapi) {
  for (const { name, ok } of PLUGINS) {
    if (!strapi.plugin(name)) continue;
    const store = strapi.store({ type: 'plugin', name });
    const saved = ((await store.get({ key: 'config' })) || {}) as Record<string, any>;
    if (ok(saved)) continue;
    const file = strapi.config.get(`plugin::${name}`) as Record<string, unknown>;
    await store.set({ key: 'config', value: { ...saved, ...file } });
    strapi.log.info(`[plugins] ${name} settings saved from config/plugins.ts`);
  }
}
