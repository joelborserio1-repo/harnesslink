import { useEffect, useState } from 'react';
import { Box, Button, Flex, SingleSelect, SingleSelectOption, Typography } from '@strapi/design-system';
import { useFetchClient } from '@strapi/strapi/admin';

// "Performance" in an ad's side panel: viewable impressions, clicks and
// click-through rate for a date range, split by country and placement, with a
// day-by-day table and a CSV to send the advertiser (src/api/ad/stats.ts).
// Daily figures start from the day reporting was switched on; the lifetime
// totals go back further.

type Row = { impressions: number; clicks: number; ctr?: number | null };
type Report = {
  ad: { name: string; lifetimeImpressions: number; lifetimeClicks: number };
  range: { from: string; to: string };
  totals: Row;
  byDay: (Row & { day: string })[];
  byMarket: (Row & { market: string })[];
  byZone: (Row & { zone: string; label: string })[];
};

const RANGES = { '7': 'Last 7 days', '30': 'Last 30 days', '90': 'Last 90 days', all: 'All time' } as const;
const n = (v: number) => v.toLocaleString('en-NZ');
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${v.toFixed(2)}%`);
const isoDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(d);

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={h} style={{ textAlign: i ? 'right' : 'left', padding: '4px 0', borderBottom: '1px solid #dcdce4', color: '#666687', fontWeight: 600 }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, j) => (
          <tr key={j}>
            {r.map((c, i) => (
              <td key={i} style={{ textAlign: i ? 'right' : 'left', padding: '4px 0', borderBottom: '1px solid #f0f0f5' }}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Performance({ documentId }: { documentId: string }) {
  const { get } = useFetchClient();
  const [range, setRange] = useState<keyof typeof RANGES>('30');
  const [report, setReport] = useState<Report | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const to = isoDay(new Date());
    const from = range === 'all' ? '2000-01-01' : isoDay(new Date(Date.now() - (Number(range) - 1) * 86_400_000));
    setReport(null);
    get<Report>(`/hl-ads/${documentId}/report?from=${from}&to=${to}`)
      .then(({ data }) => setReport(data))
      .catch(() => setFailed(true));
  }, [get, documentId, range]);

  const csv = () => {
    if (!report) return;
    const lines = [
      ['Ad', report.ad.name],
      ['Period', `${report.range.from === '2000-01-01' ? 'All time' : report.range.from} to ${report.range.to}`],
      [],
      ['Date', 'Viewable impressions', 'Clicks', 'Click-through rate'],
      ...report.byDay.map((d) => [d.day, d.impressions, d.clicks, d.impressions ? `${((d.clicks / d.impressions) * 100).toFixed(2)}%` : '']),
      ['Total', report.totals.impressions, report.totals.clicks, pct(report.totals.ctr)],
      [],
      ['Country / market', 'Viewable impressions', 'Clicks', 'Click-through rate'],
      ...report.byMarket.map((m) => [m.market, m.impressions, m.clicks, pct(m.ctr)]),
      [],
      ['Placement', 'Viewable impressions', 'Clicks', 'Click-through rate'],
      ...report.byZone.map((z) => [z.label, z.impressions, z.clicks, pct(z.ctr)]),
    ];
    const text = lines.map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.ad.name.replace(/[^\w-]+/g, '-').toLowerCase()}-${report.range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (failed) return <Typography variant="pi" textColor="danger600">Couldn’t load the report.</Typography>;

  return (
    <Flex direction="column" alignItems="stretch" gap={3} width="100%">
      <SingleSelect aria-label="Period" value={range} onChange={(v: string | number) => setRange(String(v) as keyof typeof RANGES)} size="S">
        {Object.entries(RANGES).map(([k, label]) => (
          <SingleSelectOption key={k} value={k}>
            {label}
          </SingleSelectOption>
        ))}
      </SingleSelect>

      {!report ? (
        <Typography variant="pi">Loading…</Typography>
      ) : (
        <>
          <Flex gap={4}>
            {[
              ['Impressions', n(report.totals.impressions)],
              ['Clicks', n(report.totals.clicks)],
              ['CTR', pct(report.totals.ctr)],
            ].map(([label, value]) => (
              <Box key={label}>
                <Typography variant="beta" tag="p">
                  {value}
                </Typography>
                <Typography variant="pi" textColor="neutral600">
                  {label}
                </Typography>
              </Box>
            ))}
          </Flex>

          {report.totals.impressions === 0 && (
            <Typography variant="pi" textColor="neutral600">
              Nothing recorded in this period yet.
            </Typography>
          )}

          {report.byMarket.length > 0 && (
            <Box>
              <Typography variant="sigma" textColor="neutral600">
                By country
              </Typography>
              <Table head={['Market', 'Views', 'Clicks', 'CTR']} rows={report.byMarket.map((m) => [m.market, n(m.impressions), n(m.clicks), pct(m.ctr)])} />
            </Box>
          )}
          {report.byZone.length > 0 && (
            <Box>
              <Typography variant="sigma" textColor="neutral600">
                By placement
              </Typography>
              <Table head={['Placement', 'Views', 'Clicks']} rows={report.byZone.map((z) => [z.label.split(' (')[0], n(z.impressions), n(z.clicks)])} />
            </Box>
          )}
          {report.byDay.length > 0 && (
            <Box>
              <Typography variant="sigma" textColor="neutral600">
                By day
              </Typography>
              <Table
                head={['Date', 'Views', 'Clicks']}
                rows={[...report.byDay].reverse().slice(0, 31).map((d) => [d.day, n(d.impressions), n(d.clicks)])}
              />
            </Box>
          )}

          <Button variant="secondary" onClick={csv} disabled={!report.byDay.length}>
            Download CSV for the advertiser
          </Button>
          <Typography variant="pi" textColor="neutral600">
            Lifetime: {n(report.ad.lifetimeImpressions)} impressions, {n(report.ad.lifetimeClicks)} clicks. Impressions count when at least half the ad is on screen.
          </Typography>
        </>
      )}
    </Flex>
  );
}

const AdPerformancePanel = ({ model, documentId }: { model: string; documentId?: string }) => {
  if (model !== 'api::ad.ad' || !documentId) return null;
  return { title: 'Performance', content: <Performance documentId={documentId} /> };
};

export default AdPerformancePanel;
