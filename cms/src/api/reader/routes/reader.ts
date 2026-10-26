// Reader accounts, called by the website's own server (it keeps the session
// in a secure cookie). All public; each handler checks what it needs.
export default {
  routes: [
    { method: 'POST', path: '/readers/register', handler: 'reader.register', config: { auth: false } },
    { method: 'POST', path: '/readers/login', handler: 'reader.login', config: { auth: false } },
    { method: 'POST', path: '/readers/refresh', handler: 'reader.refresh', config: { auth: false } },
    { method: 'GET', path: '/readers/me', handler: 'reader.me', config: { auth: false } },
    { method: 'PUT', path: '/readers/me', handler: 'reader.update', config: { auth: false } },
    { method: 'POST', path: '/readers/forgot-password', handler: 'reader.forgotPassword', config: { auth: false } },
    { method: 'POST', path: '/readers/reset-password', handler: 'reader.resetPassword', config: { auth: false } },
  ],
};
