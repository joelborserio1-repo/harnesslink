import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Core } from '@strapi/strapi';

// Signs in readers who arrive still logged in to the old WordPress site.
//
// WordPress's login cookie (wordpress_logged_in_<md5 of site URL>) reads
// "login|expiration|token|hmac". WordPress checks it like this
// (wp_validate_auth_cookie):
//   key  = HMAC-MD5( login|passFrag|expiration|token , LOGGED_IN_KEY.LOGGED_IN_SALT )
//   hmac = HMAC-SHA256( login|expiration|token , key )
// where passFrag is characters 8–11 of the user's stored password hash. We do
// the same with WordPress's keys (WP_LOGGED_IN_KEY / WP_LOGGED_IN_SALT, read
// from wp-config.php) and the login and passFrag the reader import keeps.
// Valid and unexpired → that reader is signed in. Without the keys set this
// does nothing.

const USER = 'plugin::users-permissions.user';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  enabled() {
    return !!(process.env.WP_LOGGED_IN_KEY && process.env.WP_LOGGED_IN_SALT);
  },

  async readerFor(cookie: string): Promise<any | null> {
    if (!this.enabled() || !cookie || cookie.length > 1000) return null;
    let value = cookie;
    try {
      value = decodeURIComponent(cookie);
    } catch {
      return null;
    }
    const parts = value.split('|');
    if (parts.length !== 4) return null;
    const [login, expiration, token, hmac] = parts;
    if (!login || !/^\d+$/.test(expiration) || Number(expiration) * 1000 < Date.now() || !/^[a-f0-9]{64}$/.test(hmac)) return null;

    const reader = await strapi.db.query(USER).findOne({ where: { legacyWpLogin: login } });
    if (!reader || reader.blocked || !reader.legacyWpPassFrag) return null;

    const salt = `${process.env.WP_LOGGED_IN_KEY}${process.env.WP_LOGGED_IN_SALT}`;
    const key = createHmac('md5', salt).update(`${login}|${reader.legacyWpPassFrag}|${expiration}|${token}`).digest('hex');
    const want = createHmac('sha256', key).update(`${login}|${expiration}|${token}`).digest();
    const got = Buffer.from(hmac, 'hex');
    return got.length === want.length && timingSafeEqual(got, want) ? reader : null;
  },
});
