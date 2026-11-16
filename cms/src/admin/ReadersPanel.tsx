import { useEffect, useState } from 'react';
import { Flex, Typography } from '@strapi/design-system';
import { useFetchClient } from '@strapi/strapi/admin';

// "Readers" in a published story's side panel: how many people have read it
// and where they came from (src/story-stats.ts).

type Report = {
  readers: number;
  views: number;
  lifetimeViews: number;
  bySource: { source: string; name: string; readers: number }[];
  byDay: { day: string; readers: number }[];
};
const nf = (v: number) => (v || 0).toLocaleString('en-NZ');
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f0f0f5', fontSize: 12 };

function Readers({ documentId }: { documentId: string }) {
  const { get } = useFetchClient();
  const [r, setR] = useState<Report | null>(null);
  useEffect(() => {
    get<Report>(`/hl-stats/story/${documentId}`)
      .then(({ data }) => setR(data))
      .catch(() => setR(null));
  }, [get, documentId]);
  if (!r) return <Typography variant="pi" textColor="neutral600">Loading…</Typography>;
  if (!r.readers)
    return (
      <Typography variant="pi" textColor="neutral600">
        No reads recorded yet.{r.lifetimeViews ? ` ${nf(r.lifetimeViews)} views on the old counter.` : ''}
      </Typography>
    );
  return (
    <Flex direction="column" alignItems="stretch" gap={2} width="100%">
      <Typography variant="beta" tag="div">
        {nf(r.readers)} <span style={{ fontSize: 13, fontWeight: 400, color: '#666687' }}>readers</span>
      </Typography>
      <div>
        {r.bySource.map((s) => (
          <div key={s.source} style={row}>
            <span>{s.name}</span>
            <strong>{nf(s.readers)}</strong>
          </div>
        ))}
      </div>
      <Typography variant="pi" textColor="neutral600">
        Last days: {r.byDay.slice(0, 5).map((d) => `${new Date(`${d.day}T12:00:00Z`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', timeZone: 'UTC' })} ${nf(d.readers)}`).join(' · ')}
      </Typography>
    </Flex>
  );
}

const ReadersPanel = ({ model, documentId }: { model: string; documentId?: string }) => {
  if (model !== 'api::article.article' || !documentId) return null;
  return { title: 'Readers', content: <Readers documentId={documentId} /> };
};

export default ReadersPanel;
