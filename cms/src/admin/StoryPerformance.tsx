import { useEffect, useState } from 'react';
import { Box, Flex, Typography } from '@strapi/design-system';
import { useFetchClient } from '@strapi/strapi/admin';
import { Link } from 'react-router-dom';

// "Story performance" in the left menu: readers by source (Facebook,
// Instagram, X, Google…), the most-read stories, and which stories did
// better or worse than usual for their section. Data: src/story-stats.ts.

type Story = { documentId: string; title: string; slug?: string; category?: string | null; publishDate?: string };
type Overview = {
  range: { from: string; to: string };
  totals: { views: number; readers: number };
  bySource: { source: string; name: string; views: number; readers: number }[];
  byDay: { day: string; total: number; sources: Record<string, number> }[];
  byCountry: { country: string; readers: number }[];
  top: (Story & { readers: number; views: number; sources: Record<string, number> })[];
};
type Perf = {
  count: number;
  overallMedian: number;
  sections: { category: string; median: number; stories: number }[];
  best: (Story & { firstTwoDays: number; total: number; sectionMedian: number; index: number })[];
  worst: (Story & { firstTwoDays: number; total: number; sectionMedian: number; index: number })[];
};

const SOCIAL = ['facebook', 'instagram', 'x', 'google'] as const;
const NAMES: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', x: 'X', google: 'Google' };
const COUNTRIES: Record<string, string> = { NZ: 'New Zealand', AU: 'Australia', US: 'USA', CA: 'Canada', GB: 'UK', IE: 'Ireland', XX: 'Unknown' };
const nf = (v: number) => (v || 0).toLocaleString('en-NZ');
const isoDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(d);
const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86_400_000));
const RANGES: Record<string, { label: string; from: () => string; to: () => string }> = {
  today: { label: 'Today', from: () => daysAgo(0), to: () => daysAgo(0) },
  yesterday: { label: 'Yesterday', from: () => daysAgo(1), to: () => daysAgo(1) },
  '7': { label: 'Last 7 days', from: () => daysAgo(6), to: () => daysAgo(0) },
  '30': { label: 'Last 30 days', from: () => daysAgo(29), to: () => daysAgo(0) },
};
const editLink = (id: string) => `/content-manager/collection-types/api::article.article/${id}`;

const cell: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #eaeaef', fontSize: 13, verticalAlign: 'top' };
const head: React.CSSProperties = { ...cell, fontWeight: 600, color: '#666687', borderBottom: '1px solid #c0c0cf', whiteSpace: 'nowrap' };
const right: React.CSSProperties = { textAlign: 'right' };

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <Box background="neutral0" padding={6} marginBottom={6} style={{ border: '1px solid #dcdce4' }}>
      <Typography variant="delta" tag="h2">
        {title}
      </Typography>
      {note && (
        <Box paddingTop={1}>
          <Typography variant="pi" textColor="neutral600">
            {note}
          </Typography>
        </Box>
      )}
      <Box paddingTop={4} style={{ overflowX: 'auto' }}>
        {children}
      </Box>
    </Box>
  );
}

function StoryCell({ s }: { s: Story }) {
  return (
    <td style={cell}>
      <Link to={editLink(s.documentId)} style={{ color: '#00205E', fontWeight: 600, textDecoration: 'none' }}>
        {s.title}
      </Link>
      <div style={{ color: '#8e8ea9', fontSize: 12, marginTop: 2 }}>
        {[s.category, s.publishDate && new Date(s.publishDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
        {s.slug && (
          <>
            {' · '}
            <a href={`/${s.slug}/`.replace(/^\/\//, '/')} target="_blank" rel="noreferrer" style={{ color: '#8e8ea9' }}>
              view
            </a>
          </>
        )}
      </div>
    </td>
  );
}

function PerfTable({ rows }: { rows: Perf['best'] }) {
  if (!rows.length) return <Typography textColor="neutral600">Not enough stories yet: a story needs two full days of reads.</Typography>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ ...head, textAlign: 'left' }}>Story</th>
          <th style={{ ...head, ...right }}>First 2 days</th>
          <th style={{ ...head, ...right }}>Usual for section</th>
          <th style={{ ...head, ...right }}>Against usual</th>
          <th style={{ ...head, ...right }}>All readers</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.documentId}>
            <StoryCell s={s} />
            <td style={{ ...cell, ...right }}>{nf(s.firstTwoDays)}</td>
            <td style={{ ...cell, ...right, color: '#666687' }}>{nf(s.sectionMedian)}</td>
            <td style={{ ...cell, ...right, fontWeight: 600, color: s.index >= 1 ? '#2f6846' : '#b72b1a' }}>{s.index.toFixed(1)}×</td>
            <td style={{ ...cell, ...right }}>{nf(s.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function StoryPerformance() {
  const { get } = useFetchClient();
  const [range, setRange] = useState('7');
  const [data, setData] = useState<Overview | null>(null);
  const [perf, setPerf] = useState<Perf | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const r = RANGES[range];
    const q = `from=${r.from()}&to=${r.to()}`;
    setData(null);
    setPerf(null);
    setFailed(false);
    get<Overview>(`/hl-stats/overview?${q}`)
      .then(({ data }) => setData(data))
      .catch(() => setFailed(true));
    // Performance looks at stories published in the period (and at least two days old).
    const pr = range === 'today' || range === 'yesterday' ? `from=${daysAgo(8)}&to=${daysAgo(0)}` : q;
    get<Perf>(`/hl-stats/performance?${pr}`)
      .then(({ data }) => setPerf(data))
      .catch(() => setFailed(true));
  }, [get, range]);

  const max = Math.max(1, ...(data?.bySource.map((s) => s.readers) || [1]));

  return (
    <Box padding={10} background="neutral100" style={{ minHeight: '100vh' }}>
      <Flex justifyContent="space-between" alignItems="flex-end" wrap="wrap" gap={4} paddingBottom={6}>
        <Box>
          <Typography variant="alpha" tag="h1">
            Story performance
          </Typography>
          <Box paddingTop={1}>
            <Typography textColor="neutral600">
              Readers are people who opened a story, counted once per story per day, from every browser including the Facebook, Instagram and X apps.
            </Typography>
          </Box>
        </Box>
        <Flex gap={0}>
          {Object.entries(RANGES).map(([k, r]) => (
            <button
              key={k}
              type="button"
              onClick={() => setRange(k)}
              style={{
                padding: '8px 14px',
                border: '1px solid #c0c0cf',
                marginLeft: -1,
                background: range === k ? '#00205E' : '#fff',
                color: range === k ? '#fff' : '#32324d',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {r.label}
            </button>
          ))}
        </Flex>
      </Flex>

      {failed && <Typography textColor="danger600">Could not load the figures.</Typography>}
      {!data && !failed && <Typography textColor="neutral600">Loading…</Typography>}

      {data && (
        <>
          <Flex gap={6} paddingBottom={6} wrap="wrap">
            {[
              ['Readers', data.totals.readers],
              ['Views', data.totals.views],
              ...SOCIAL.map((k) => [NAMES[k], data.bySource.find((s) => s.source === k)?.readers || 0] as [string, number]),
            ].map(([label, v]) => (
              <Box key={label as string} background="neutral0" padding={4} style={{ border: '1px solid #dcdce4', minWidth: 140 }}>
                <Typography variant="pi" textColor="neutral600">
                  {label}
                </Typography>
                <Typography variant="alpha" tag="div">
                  {nf(v as number)}
                </Typography>
              </Box>
            ))}
          </Flex>

          <Section title="Where readers came from">
            {data.bySource.length ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {data.bySource.map((s) => (
                    <tr key={s.source}>
                      <td style={{ ...cell, width: 170 }}>{s.name}</td>
                      <td style={cell}>
                        <div style={{ height: 14, width: `${(s.readers / max) * 100}%`, background: '#3D5A9E', minWidth: 2 }} />
                      </td>
                      <td style={{ ...cell, ...right, width: 90, fontWeight: 600 }}>{nf(s.readers)}</td>
                      <td style={{ ...cell, ...right, width: 70, color: '#666687' }}>
                        {data.totals.readers ? `${Math.round((s.readers / data.totals.readers) * 100)}%` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Typography textColor="neutral600">No reads recorded in this period yet.</Typography>
            )}
          </Section>

          <Section title="Most read" note="Readers in this period, and the three biggest sources for each story.">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...head, textAlign: 'left' }}>Story</th>
                  <th style={{ ...head, ...right }}>Readers</th>
                  {SOCIAL.map((k) => (
                    <th key={k} style={{ ...head, ...right }}>
                      {NAMES[k]}
                    </th>
                  ))}
                  <th style={{ ...head, ...right }}>Other</th>
                </tr>
              </thead>
              <tbody>
                {data.top.map((s) => {
                  const social = SOCIAL.reduce((a, k) => a + (s.sources[k] || 0), 0);
                  return (
                    <tr key={s.documentId}>
                      <StoryCell s={s} />
                      <td style={{ ...cell, ...right, fontWeight: 600 }}>{nf(s.readers)}</td>
                      {SOCIAL.map((k) => (
                        <td key={k} style={{ ...cell, ...right }}>
                          {s.sources[k] ? nf(s.sources[k]) : '–'}
                        </td>
                      ))}
                      <td style={{ ...cell, ...right }}>{nf(s.readers - social)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>

          {perf && (
            <>
              <Section
                title="Did better than usual"
                note="Stories published in this period, by readers in their first two days against the usual for their section (USA stories against USA stories, and so on)."
              >
                <PerfTable rows={perf.best} />
              </Section>
              <Section title="Did worse than usual" note="Worth a look: the headline, photo, timing, or whether it was shared to social.">
                <PerfTable rows={perf.worst} />
              </Section>
            </>
          )}

          <Flex gap={6} alignItems="flex-start" wrap="wrap">
            <Box style={{ flex: '1 1 380px' }}>
              <Section title="By day">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...head, textAlign: 'left' }}>Day</th>
                      <th style={{ ...head, ...right }}>Readers</th>
                      {SOCIAL.map((k) => (
                        <th key={k} style={{ ...head, ...right }}>
                          {NAMES[k]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.byDay].reverse().map((d) => (
                      <tr key={d.day}>
                        <td style={cell}>{new Date(`${d.day}T12:00:00Z`).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</td>
                        <td style={{ ...cell, ...right, fontWeight: 600 }}>{nf(d.total)}</td>
                        {SOCIAL.map((k) => (
                          <td key={k} style={{ ...cell, ...right }}>
                            {nf(d.sources[k] || 0)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            </Box>
            <Box style={{ flex: '0 1 300px' }}>
              <Section title="Where readers are">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {data.byCountry.map((c) => (
                      <tr key={c.country}>
                        <td style={cell}>{COUNTRIES[c.country] || c.country}</td>
                        <td style={{ ...cell, ...right }}>{nf(c.readers)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            </Box>
          </Flex>
        </>
      )}
    </Box>
  );
}
