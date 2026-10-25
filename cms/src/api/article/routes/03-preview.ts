export default {
  routes: [
    // Draft versions for the website's Preview button. Guarded by the shared
    // PREVIEW_SECRET (header), not by the public role.
    { method: 'GET', path: '/preview/target', handler: 'preview.target', config: { auth: false } },
    { method: 'GET', path: '/preview/:collection', handler: 'preview.find', config: { auth: false } },
  ],
};
