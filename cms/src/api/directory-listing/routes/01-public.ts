// Public directory API (same shapes the site used from Rails). Listings are
// never exposed through the generic REST API, because contact details must be
// withheld on free listings.
export default {
  routes: [
    { method: 'GET', path: '/directory', handler: 'public.hub', config: { auth: false } },
    { method: 'GET', path: '/directory/:type', handler: 'public.type', config: { auth: false } },
    { method: 'GET', path: '/directory/:type/:id', handler: 'public.show', config: { auth: false } },
    { method: 'POST', path: '/directory-enquiries/submit', handler: 'public.enquire', config: { auth: false } },
  ],
};
