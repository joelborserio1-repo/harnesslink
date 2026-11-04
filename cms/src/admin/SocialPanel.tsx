import { useEffect, useState } from 'react';
import { Box, Button, Checkbox, Flex, Link, Textarea, TextInput, Typography } from '@strapi/design-system';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';

// "Share to social" in the story editor's side panel (src/social.ts).
// Prefills headline + link, lets you tick the Postiz accounts, then saves a
// Postiz draft, schedules it, or posts now (editors, published stories only).
type Channel = { id: string; name: string; network: string; picture: string | null };
type Info = {
  configured: boolean;
  postiz: string | null;
  canPublish: boolean;
  published: boolean;
  link: string;
  title: string;
  standfirst: string;
  image: string | null;
  channels: Channel[];
  error?: string;
};

const NETWORK: Record<string, string> = {
  x: 'X',
  facebook: 'Facebook',
  instagram: 'Instagram',
  'instagram-standalone': 'Instagram',
  threads: 'Threads',
  linkedin: 'LinkedIn',
  'linkedin-page': 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  bluesky: 'Bluesky',
};

// <input type="datetime-local"> wants local time without a zone.
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

function Share({ documentId }: { documentId: string }) {
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [info, setInfo] = useState<Info | null>(null);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [withImage, setWithImage] = useState(true);
  const [at, setAt] = useState(localInput(new Date(Date.now() + 60 * 60_000)));
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    get<Info>(`/hl-social/${documentId}`)
      .then(({ data }) => {
        setInfo(data);
        setText(`${data.title}\n\n${data.link}`);
      })
      .catch(() => setInfo(null));
  }, [get, documentId]);

  if (!info) return <Typography variant="pi">Loading…</Typography>;
  if (!info.configured)
    return (
      <Typography variant="pi" textColor="neutral600">
        Postiz isn’t connected to the CMS yet.
      </Typography>
    );
  if (info.error) return <Typography variant="pi" textColor="danger600">{info.error}</Typography>;
  if (!info.channels.length)
    return (
      <Typography variant="pi" textColor="neutral600">
        No social accounts connected.{' '}
        {info.postiz && (
          <Link href={info.postiz} isExternal>
            Connect them in Postiz
          </Link>
        )}
      </Typography>
    );

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const ready = picked.length > 0 && text.trim().length > 0;

  const send = async (mode: 'draft' | 'schedule' | 'now') => {
    if (mode === 'now' && !window.confirm(`Post this to ${picked.length} account(s) right now?`)) return;
    setBusy(mode);
    try {
      await post(`/hl-social/${documentId}`, {
        text,
        channels: picked,
        mode,
        withImage,
        at: mode === 'schedule' ? new Date(at).toISOString() : undefined,
      });
      const done =
        mode === 'draft' ? 'Saved as a draft in Postiz.' : mode === 'now' ? 'Sent — Postiz is posting it now.' : `Scheduled for ${new Date(at).toLocaleString('en-NZ')}.`;
      setSent(done);
      setPicked([]);
      toggleNotification({ type: 'success', message: done });
    } catch (e: any) {
      toggleNotification({ type: 'danger', message: e?.response?.data?.error?.message || 'Postiz didn’t accept that.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Flex direction="column" alignItems="stretch" gap={3} width="100%">
      <Textarea aria-label="Post text" value={text} onChange={(e: any) => setText(e.target.value)} />
      <Typography variant="pi" textColor={text.length > 280 ? 'danger600' : 'neutral600'}>
        {text.length} characters{text.length > 280 ? ' — too long for X' : ''}
      </Typography>

      <Box>
        {info.channels.map((c) => (
          <Box key={c.id} paddingBottom={1}>
            <Checkbox checked={picked.includes(c.id)} onCheckedChange={() => toggle(c.id)}>
              {NETWORK[c.network] || c.network}: {c.name}
            </Checkbox>
          </Box>
        ))}
      </Box>

      {info.image && (
        <Checkbox checked={withImage} onCheckedChange={(v: boolean) => setWithImage(!!v)}>
          Include the lead photo
        </Checkbox>
      )}

      <Button variant="secondary" disabled={!ready} loading={busy === 'draft'} onClick={() => send('draft')}>
        Save as Postiz draft
      </Button>

      {info.canPublish && info.published && (
        <>
          <TextInput type="datetime-local" aria-label="Post at" value={at} onChange={(e: any) => setAt(e.target.value)} />
          <Button variant="secondary" disabled={!ready} loading={busy === 'schedule'} onClick={() => send('schedule')}>
            Schedule
          </Button>
          <Button disabled={!ready} loading={busy === 'now'} onClick={() => send('now')}>
            Post now
          </Button>
        </>
      )}
      {info.canPublish && !info.published && (
        <Typography variant="pi" textColor="neutral600">
          Publish the story to schedule or post it.
        </Typography>
      )}
      {sent && (
        <Typography variant="pi" textColor="success600">
          {sent}{' '}
          {info.postiz && (
            <Link href={info.postiz} isExternal>
              Open Postiz
            </Link>
          )}
        </Typography>
      )}
    </Flex>
  );
}

const SocialPanel = ({ model, documentId }: { model: string; documentId?: string }) => {
  if (model !== 'api::article.article' || !documentId) return null;
  return { title: 'Share to social', content: <Share documentId={documentId} /> };
};

export default SocialPanel;
