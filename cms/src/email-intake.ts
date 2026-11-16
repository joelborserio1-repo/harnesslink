import type { Core } from '@strapi/strapi';
import { processEmail } from './email-processor';

// Emailed stories (stories@in.harnesslink.com). The Cloudflare Worker in
// email-worker/ posts each raw message to /api/email-intake, which stores it
// here untouched. Turning a stored email into a draft story (sender check,
// attachments, Claude formatting) is a separate step that reads this table,
// so nothing that arrives is lost while that step is being built or is down.
//
// hl_email_intake.status: received → processing → drafted | skipped | failed,
// or roundup (minor news) → rounded (in the morning roundup draft)

export async function ensureEmailIntakeTable(strapi: Core.Strapi) {
  const db = strapi.db.connection;
  if (await db.schema.hasTable('hl_email_intake')) {
    // Added with the draft step (src/email-processor.ts); additive.
    if (!(await db.schema.hasColumn('hl_email_intake', 'roundup'))) {
      await db.schema.alterTable('hl_email_intake', (t) => t.jsonb('roundup'));
    }
    if (!(await db.schema.hasColumn('hl_email_intake', 'attempts'))) {
      await db.schema.alterTable('hl_email_intake', (t) => {
        t.integer('attempts').notNullable().defaultTo(0);
        t.timestamp('claimed_at', { useTz: true });
      });
    }
    return;
  }
  await db.schema.createTable('hl_email_intake', (t) => {
    t.increments('id');
    t.text('message_id').unique();
    t.text('envelope_from');
    t.text('envelope_to');
    t.text('header_from');
    t.text('subject');
    t.integer('size_bytes');
    t.binary('raw');
    t.string('status', 20).notNullable().defaultTo('received').index();
    t.text('note');
    t.string('article_document_id', 64);
    t.timestamp('received_at', { useTz: true }).notNullable().defaultTo(db.fn.now()).index();
    t.timestamp('processed_at', { useTz: true });
    t.integer('attempts').notNullable().defaultTo(0);
    t.timestamp('claimed_at', { useTz: true });
    t.jsonb('roundup');
  });
}

// The header block, with folded lines joined, so single headers can be read
// without a MIME parser.
function header(raw: Buffer, name: string): string | null {
  const end = raw.indexOf('\r\n\r\n');
  const head = raw
    .subarray(0, end > 0 ? end : Math.min(raw.length, 64 * 1024))
    .toString('latin1')
    .replace(/\r?\n[ \t]+/g, ' ');
  const m = head.match(new RegExp(`^${name}:[ \\t]*(.*)$`, 'im'));
  return m ? m[1].trim().slice(0, 1000) : null;
}

export async function storeEmail(strapi: Core.Strapi, raw: Buffer, envelope: { from?: string; to?: string }) {
  const db = strapi.db.connection;
  const messageId = header(raw, 'Message-ID');
  if (messageId) {
    const existing = await db('hl_email_intake').where({ message_id: messageId }).first('id');
    if (existing) return { id: existing.id, duplicate: true };
  }
  const [row] = await db('hl_email_intake')
    .insert({
      message_id: messageId,
      envelope_from: (envelope.from || '').slice(0, 320) || null,
      envelope_to: (envelope.to || '').slice(0, 320) || null,
      header_from: header(raw, 'From'),
      subject: header(raw, 'Subject'),
      size_bytes: raw.length,
      raw,
    })
    .onConflict('message_id')
    .ignore()
    .returning('id');
  strapi.log.info(`[email-intake] stored #${row?.id ?? '?'} from ${envelope.from || '?'} (${raw.length} bytes)`);
  // Turn it into a draft in the background; the Worker gets its answer now.
  if (row?.id) {
    setImmediate(() => {
      processEmail(strapi, row.id).catch((err) => strapi.log.error(`[email-intake] #${row.id}: ${err}`));
    });
  }
  return { id: row?.id ?? null, duplicate: !row };
}
