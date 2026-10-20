export default {
  routes: [{ method: 'POST', path: '/missed-paths/log', handler: 'log.log', config: { auth: false } }],
};
