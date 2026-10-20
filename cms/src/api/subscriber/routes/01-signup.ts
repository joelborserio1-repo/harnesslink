export default {
  routes: [{ method: 'POST', path: '/subscribers/signup', handler: 'signup.signup', config: { auth: false } }],
};
