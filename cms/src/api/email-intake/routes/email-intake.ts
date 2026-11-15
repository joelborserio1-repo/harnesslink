// POST /api/email-intake — raw emails from the story-intake Worker
// (email-worker/). Not a token route: the Worker proves itself with the
// shared EMAIL_INTAKE_SECRET (x-intake-secret header).
export default {
  routes: [
    {
      method: 'POST',
      path: '/email-intake',
      handler: 'email-intake.receive',
      config: { auth: false },
    },
  ],
};
