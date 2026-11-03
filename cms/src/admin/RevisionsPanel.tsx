import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Dialog, Flex, Typography } from '@strapi/design-system';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';

// "Revisions" in the story editor's side panel: every saved version of the
// headline, standfirst, URL and story, who saved it and when, with View and
// Restore. Restoring puts that version back into the draft; it still needs
// publishing (Strapi's Content History equivalent, which is a paid feature).
type Row = { id: number; kind: 'saved' | 'published' | 'restored'; title: string; editorName: string | null; createdAt: string };
type Full = Row & { subtitle: string | null; excerpt: string | null; slug: string | null; bodyHtml: string | null };

const KIND = { saved: 'Saved', published: 'Published', restored: 'Restored' } as const;
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const SHOW = 8;

function RevisionsList({ documentId }: { documentId: string }) {
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<Full | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    get<{ revisions: Row[] }>(`/hl-revisions/${documentId}`)
      .then(({ data }) => setRows(data.revisions))
      .catch(() => setRows([]));
  }, [get, documentId]);
  useEffect(load, [load]);

  const view = async (id: number) => {
    const { data } = await get<{ revision: Full }>(`/hl-revisions/item/${id}`);
    setOpen(data.revision);
  };

  const restore = async () => {
    if (!open) return;
    setBusy(true);
    try {
      await post(`/hl-revisions/item/${open.id}/restore`);
      toggleNotification({ type: 'success', message: 'Version restored to the draft. Review it, then publish.' });
      window.location.reload();
    } catch {
      toggleNotification({ type: 'danger', message: 'That version couldn’t be restored.' });
      setBusy(false);
    }
  };

  if (!rows) return <Typography variant="pi">Loading…</Typography>;
  if (!rows.length) return <Typography variant="pi" textColor="neutral600">No saved versions yet — they appear after the next save.</Typography>;

  return (
    <Flex direction="column" alignItems="stretch" gap={2} width="100%">
      {(all ? rows : rows.slice(0, SHOW)).map((r, i) => (
        <Flex key={r.id} justifyContent="space-between" alignItems="center" gap={2}>
          <Box>
            <Typography variant="omega" fontWeight={i === 0 ? 'bold' : 'regular'}>
              {when(r.createdAt)}
            </Typography>
            <Typography variant="pi" textColor="neutral600" tag="p">
              {KIND[r.kind]}
              {r.editorName ? ` by ${r.editorName}` : ''}
              {i === 0 ? ' · current' : ''}
            </Typography>
          </Box>
          <Button variant="tertiary" size="S" onClick={() => view(r.id)}>
            View
          </Button>
        </Flex>
      ))}
      {rows.length > SHOW && !all && (
        <Button variant="ghost" size="S" onClick={() => setAll(true)}>
          Show all {rows.length}
        </Button>
      )}

      <Dialog.Root open={!!open} onOpenChange={(o: boolean) => !o && setOpen(null)}>
        <Dialog.Content style={{ maxWidth: 760, width: "92vw" }}>
          <Dialog.Header>{open ? `${KIND[open.kind]} ${when(open.createdAt)}` : ''}</Dialog.Header>
          <Dialog.Body>
            {open && (
              <Box style={{ maxHeight: '60vh', overflowY: 'auto', textAlign: 'left', width: '100%' }}>
                <Typography variant="beta" tag="h3">{open.title}</Typography>
                {open.subtitle && <Typography variant="epsilon" tag="p">{open.subtitle}</Typography>}
                {open.excerpt && (
                  <Box paddingTop={2}>
                    <Typography variant="pi" textColor="neutral600">Standfirst: {open.excerpt}</Typography>
                  </Box>
                )}
                <Box paddingTop={2}>
                  <Typography variant="pi" textColor="neutral600">URL: /{open.slug}/</Typography>
                </Box>
                <Box paddingTop={4} className="hl-revision-body">
                  <div dangerouslySetInnerHTML={{ __html: open.bodyHtml || '<p><em>(no story text)</em></p>' }} />
                </Box>
              </Box>
            )}
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">Close</Button>
            </Dialog.Cancel>
            <Button onClick={restore} loading={busy}>
              Restore this version
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}

const RevisionsPanel = ({ model, documentId }: { model: string; documentId?: string }) => {
  if (model !== 'api::article.article' || !documentId) return null;
  return { title: 'Revisions', content: <RevisionsList documentId={documentId} /> };
};

export default RevisionsPanel;
