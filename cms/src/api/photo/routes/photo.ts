// GET /api/photos/search?q=… — the photo archive for API callers (the story
// generator). Needs an API token with "Photo → search" ticked; not public.
export default {
  routes: [
    {
      method: 'GET',
      path: '/photos/search',
      handler: 'photo.search',
    },
  ],
};
