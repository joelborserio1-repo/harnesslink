// Story intake: stories@in.harnesslink.com → this Worker → Strapi.
//
// Cloudflare Email Routing hands every message for the address to email().
// The raw message is passed on untouched to the CMS intake endpoint, which
// stores it and does all the work (sender check, parsing, Claude formatting,
// draft). Nothing here reads or keeps the content.
//
// If the CMS is down, the error makes Cloudflare answer the sending server
// with a temporary failure, so the sender's mail server retries later and
// nothing is lost. A 4xx answer from the CMS (bad secret, too large) bounces.

const MAX_BYTES = 25 * 1024 * 1024; // Email Routing's own limit

export default {
  async email(message, env) {
    if (message.rawSize > MAX_BYTES) {
      message.setReject("Message too large (25 MB limit)");
      return;
    }
    const raw = await new Response(message.raw).arrayBuffer();
    const res = await fetch(env.INTAKE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-intake-secret": env.INTAKE_SECRET,
        "x-envelope-from": message.from,
        "x-envelope-to": message.to,
      },
      body: raw,
    });
    if (res.ok) return;
    if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
      message.setReject(`Not accepted (${res.status})`);
      return;
    }
    throw new Error(`Story intake unavailable (${res.status})`);
  },
};
