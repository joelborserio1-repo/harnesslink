// Public ad delivery. Named 01-… so these load before the core /ads/:id route.
export default {
  routes: [
    { method: 'GET', path: '/ads/live', handler: 'delivery.live', config: { auth: false } },
    { method: 'GET', path: '/ads/:documentId/click', handler: 'delivery.click', config: { auth: false } },
    { method: 'POST', path: '/ads/:documentId/impression', handler: 'delivery.impression', config: { auth: false } },
  ],
};
