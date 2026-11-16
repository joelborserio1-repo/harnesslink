export default {
  routes: [
    // Browser beacon after a real page view (bots and prefetches don't fire it).
    { method: 'POST', path: '/articles/:slug/view', handler: 'tracking.view', config: { auth: false } },
    // Race analysis: latest prices and results for the meeting (src/race-analysis.ts).
    { method: 'GET', path: '/race-analysis/live/:meetingId', handler: 'tracking.raceLive', config: { auth: false } },
    // The daily form guide's list of cards (src/form-guide.ts).
    { method: 'GET', path: '/form-guide', handler: 'tracking.formGuide', config: { auth: false } },
  ],
};
