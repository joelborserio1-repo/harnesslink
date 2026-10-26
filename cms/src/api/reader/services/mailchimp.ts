import { createHash } from 'node:crypto';
import type { Core } from '@strapi/strapi';

// Keeps the Mailchimp audience that sends The Insider in step with readers.
// Needs MAILCHIMP_API_KEY (ends in -usNN) and MAILCHIMP_AUDIENCE_ID; without
// them it does nothing. Failures are logged, never shown to the reader.
type Member = { email: string; firstName?: string | null; lastName?: string | null; subscribed: boolean; tag?: string };

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  enabled() {
    return !!(process.env.MAILCHIMP_API_KEY && process.env.MAILCHIMP_AUDIENCE_ID);
  },

  async sync(member: Member) {
    if (!this.enabled()) return;
    const key = process.env.MAILCHIMP_API_KEY!;
    const dc = key.split('-').pop();
    const base = `https://${dc}.api.mailchimp.com/3.0/lists/${process.env.MAILCHIMP_AUDIENCE_ID}/members/`;
    const hash = createHash('md5').update(member.email.toLowerCase()).digest('hex');
    const headers = { Authorization: `Basic ${Buffer.from(`hl:${key}`).toString('base64')}`, 'Content-Type': 'application/json' };
    try {
      // New addresses join as subscribed; existing ones are updated, never
      // re-subscribed against their wishes unless they ticked The Insider here.
      const res = await fetch(base + hash, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          email_address: member.email,
          status_if_new: member.subscribed ? 'subscribed' : 'unsubscribed',
          ...(member.subscribed ? { status: 'subscribed' } : { status: 'unsubscribed' }),
          merge_fields: { FNAME: member.firstName || '', LNAME: member.lastName || '' },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        strapi.log.warn(`[mailchimp] ${res.status} updating a member: ${(await res.text()).slice(0, 200)}`);
        return;
      }
      if (member.tag && member.subscribed) {
        await fetch(`${base}${hash}/tags`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ tags: [{ name: member.tag, status: 'active' }] }),
          signal: AbortSignal.timeout(8000),
        });
      }
    } catch (err) {
      strapi.log.warn(`[mailchimp] ${(err as Error).message}`);
    }
  },
});
