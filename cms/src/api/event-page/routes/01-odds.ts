export default {
  routes: [
    {
      method: 'GET',
      path: '/event-pages/:slug/odds',
      handler: 'event-page.odds',
      config: { auth: false },
    },
  ],
};
