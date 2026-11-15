import { createHash, timingSafeEqual } from 'node:crypto';
import type { Context } from 'koa';
import { storeEmail } from '../../../email-intake';

const MAX_BYTES = 30 * 1024 * 1024;

const digest = (s: string) => createHash('sha256').update(s).digest();

function secretOk(given: unknown): boolean {
  const secret = process.env.EMAIL_INTAKE_SECRET || '';
  if (!secret || typeof given !== 'string' || !given) return false;
  return timingSafeEqual(digest(given), digest(secret));
}

// Reads the request body ourselves (application/octet-stream isn't parsed by
// strapi::body), refusing anything over MAX_BYTES.
async function readRaw(ctx: Context): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of ctx.req) {
    size += chunk.length;
    if (size > MAX_BYTES) return null;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export default {
  async receive(ctx: Context) {
    if (!secretOk(ctx.get('x-intake-secret'))) {
      ctx.status = 401;
      ctx.body = { error: 'unauthorised' };
      return;
    }
    const raw = await readRaw(ctx);
    if (!raw) {
      ctx.status = 413;
      ctx.body = { error: 'too large' };
      return;
    }
    if (!raw.length) {
      ctx.status = 400;
      ctx.body = { error: 'empty' };
      return;
    }
    const result = await storeEmail(strapi, raw, {
      from: ctx.get('x-envelope-from'),
      to: ctx.get('x-envelope-to'),
    });
    ctx.status = 202;
    ctx.body = result;
  },
};
