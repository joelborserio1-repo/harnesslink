export default {
  routes: [
    // Browser beacon after a real page view (bots and prefetches don't fire it).
    { method: 'POST', path: '/articles/:slug/view', handler: 'tracking.view', config: { auth: false } },
  ],
};
