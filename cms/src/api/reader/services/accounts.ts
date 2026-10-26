import { createHmac, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import _ from 'lodash';
import type { Core } from '@strapi/strapi';

const USER = 'plugin::users-permissions.user';

export type ReaderRow = {
  id: number;
  documentId: string;
  email: string;
  password?: string | null;
  legacyPasswordHash?: string | null;
  blocked?: boolean | null;
  firstName?: string | null;
  lastName?: string | null;
  insider?: boolean | null;
  resetPasswordToken?: string | null;
  resetRequestedAt?: string | Date | null;
};

// Shared reader-account logic for the controller and the import script.
export default ({ strapi }: { strapi: Core.Strapi }) => {
  const up = () => strapi.plugin('users-permissions');

  return {
    normaliseEmail(email: unknown) {
      return String(email || '').trim().toLowerCase();
    },

    find(email: string): Promise<ReaderRow | null> {
      return strapi.db.query(USER).findOne({ where: { email } });
    },

    async readerRoleId(): Promise<number> {
      const role = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' } });
      return role.id;
    },

    // WordPress 6.8+ stores bcrypt of an HMAC-SHA384 pre-hash, prefixed "$wp".
    async checkWordPressPassword(password: string, hash: string): Promise<boolean> {
      if (!hash.startsWith('$wp$2')) return false;
      const prehash = createHmac('sha384', 'wp-sha384').update(password).digest('base64');
      const bcryptHash = hash.slice(3).replace(/^\$2y\$/, '$2b$');
      return up().service('user').validatePassword(prehash, bcryptHash);
    },

    // Sets a reader's password (Strapi's bcrypt format) and drops any
    // WordPress hash. Written straight to the table: a few migrated readers
    // have addresses Strapi's stricter email check refuses (e.g. "a..b@"),
    // and saving through the document service would fail for them.
    async setPassword(readerId: number, password: string) {
      await strapi.db.query(USER).update({
        where: { id: readerId },
        data: { password: await bcrypt.hash(password, 10), legacyPasswordHash: null },
      });
    },

    async checkPassword(reader: ReaderRow, password: string): Promise<'ok' | 'wrong' | 'no-password'> {
      if (reader.password) return (await up().service('user').validatePassword(password, reader.password)) ? 'ok' : 'wrong';
      if (reader.legacyPasswordHash) {
        if (!(await this.checkWordPressPassword(password, reader.legacyPasswordHash))) return 'wrong';
        // First sign-in since WordPress: keep their password, in Strapi's format.
        await this.setPassword(reader.id, password);
        return 'ok';
      }
      return 'no-password';
    },

    issue(reader: { id: number }) {
      return up().service('jwt').issue({ id: reader.id }) as string;
    },

    async fromToken(authorization: string | undefined): Promise<ReaderRow | null> {
      const token = String(authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) return null;
      try {
        const payload = (await up().service('jwt').verify(token)) as { id?: number };
        const reader: ReaderRow | null = await strapi.db.query(USER).findOne({ where: { id: payload.id } });
        return reader && !reader.blocked ? reader : null;
      } catch {
        return null;
      }
    },

    profile(r: ReaderRow) {
      return { email: r.email, firstName: r.firstName || '', lastName: r.lastName || '', insider: !!r.insider };
    },

    // Password-reset email, from the template editors can change under
    // Settings → Users & Permissions → Email templates → Reset password.
    async sendReset(reader: ReaderRow) {
      const token = randomBytes(32).toString('hex');
      await strapi.db.query(USER).update({ where: { id: reader.id }, data: { resetPasswordToken: token, resetRequestedAt: new Date() } });
      const store = strapi.store({ type: 'plugin', name: 'users-permissions' });
      const settings = ((await store.get({ key: 'email' })) as any).reset_password.options;
      const advanced = (await store.get({ key: 'advanced' })) as { email_reset_password?: string };
      const vars = {
        URL: advanced.email_reset_password || `${process.env.SITE_URL || ''}/password-reset/`,
        SERVER_URL: strapi.config.get('server.absoluteUrl'),
        ADMIN_URL: strapi.config.get('admin.absoluteUrl'),
        USER: { email: reader.email, firstName: reader.firstName || '', username: reader.email },
        TOKEN: token,
      };
      await strapi.plugin('email').service('email').send({
        to: reader.email,
        from: settings.from?.email ? `${settings.from.name} <${settings.from.email}>` : undefined,
        replyTo: settings.response_email || undefined,
        subject: _.template(settings.object)(vars),
        html: _.template(settings.message)(vars),
      });
    },
  };
};
