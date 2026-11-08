import { createHash } from 'node:crypto';
import type { Core } from '@strapi/strapi';

// Keeps the Mailchimp audience that sends The Insider in step with readers.
// Needs MAILCHIMP_API_KEY (ends in -us12) and MAILCHIMP_AUDIENCE_ID (The
// Insider: 2773562eef); without them it does nothing. Failures are logged, never shown to the reader.
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
      // Only send names we have (an empty one would wipe Mailchimp's copy), and
      // skip the audience's required-field check for changes that carry none
      // (e.g. unsubscribing from My account).
      const merge: Record<string, string> = {};
      if (member.firstName) merge.FNAME = member.firstName;
      if (member.lastName) merge.LNAME = member.lastName;
      const res = await fetch(`${base}${hash}?skip_merge_validation=true`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          email_address: member.email,
          status_if_new: member.subscribed ? 'subscribed' : 'unsubscribed',
          ...(member.subscribed ? { status: 'subscribed' } : { status: 'unsubscribed' }),
          ...(Object.keys(merge).length ? { merge_fields: merge } : {}),
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
