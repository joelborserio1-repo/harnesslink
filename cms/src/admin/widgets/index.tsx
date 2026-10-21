import * as React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useFetchClient } from '@strapi/strapi/admin';
import { Badge, Box, Flex, Loader, Typography } from '@strapi/design-system';

// CMS home-screen widgets. Each asks one admin-only route (/hl-dashboard/<section>, see
// src/dashboard.ts); the server holds the Matomo, Postiz and racing keys and caches a minute.

type Off = { connected: false; reason: 'not_configured' | 'unreachable'; error?: string };

function useSection<T>(section: string, refreshMs = 60_000) {
  const { get } = useFetchClient();
  const [data, setData] = React.useState<T | Off | null>(null);
  React.useEffect(() => {
    let alive = true;
    const load = () =>
      get<T | Off>(`/hl-dashboard/${section}`)
        .then((r) => { if (alive) setData(r.data); })
        .catch((e: Error) => { if (alive) setData({ connected: false, reason: 'unreachable', error: e.message }); });
    load();
    const id = window.setInterval(load, refreshMs);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [section]);
  return data;
}

const n = (v: number | null | undefined) => (v ?? 0).toLocaleString('en-NZ');
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};
const when = (iso: string, tz = 'Pacific/Auckland') =>
  new Date(iso).toLocaleString('en-NZ', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit' });

function Shell<T>({ data, what, children }: { data: T | Off | null; what: string; children: (d: T) => React.ReactNode }) {
  if (!data) return <Flex justifyContent="center" padding={6}><Loader small>Loading</Loader></Flex>;
  if ((data as Off).connected === false) {
    const d = data as Off;
    return (
      <Typography variant="omega" textColor="neutral600">
        {d.reason === 'not_configured' ? `${what} isn't connected yet: its key needs adding on the server.` : `Can't reach ${what} right now${d.error ? ` (${d.error})` : ''}.`}
      </Typography>
    );
  }
  return <>{children(data as T)}</>;
}

function Figure({ value, label, tone }: { value: React.ReactNode; label: string; tone?: 'danger' }) {
  return (
    <Box>
      <Typography variant="alpha" tag="p" textColor={tone === 'danger' ? 'danger600' : 'neutral800'} fontWeight="bold">{value}</Typography>
      <Typography variant="sigma" textColor="neutral600">{label}</Typography>
    </Box>
  );
}

function Figures({ children }: { children: React.ReactNode }) {
  return <Flex gap={6} wrap="wrap" paddingBottom={4}>{children}</Flex>;
}

function Row({ left, right, href, external }: { left: React.ReactNode; right?: React.ReactNode; href?: string; external?: boolean }) {
  const label = <Typography variant="omega" ellipsis textColor="neutral800">{left}</Typography>;
  return (
    <Flex justifyContent="space-between" gap={3} paddingTop={2} paddingBottom={2} style={{ borderTop: '1px solid #eaeaef' }}>
      <Box style={{ minWidth: 0, flex: 1 }}>
        {href ? (external ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{label}</a> : <RouterLink to={href} style={{ textDecoration: 'none' }}>{label}</RouterLink>) : label}
      </Box>
      {right != null && <Typography variant="omega" textColor="neutral600" style={{ whiteSpace: 'nowrap' }}>{right}</Typography>}
    </Flex>
  );
}

// ---------- Traffic (Matomo) ----------
type Traffic = { connected: true; link: string; now: number; today: { visitors: number; pageviews: number }; week: { visitors: number; pageviews: number }; topPages: { title: string; views: number }[]; sources: { label: string; visits: number }[] };
export function TrafficWidget() {
  const data = useSection<Traffic>('traffic');
  return (
    <Shell data={data} what="Matomo">
      {(t) => (
        <>
          <Figures>
            <Figure value={n(t.now)} label="On site now" />
            <Figure value={n(t.today.visitors)} label="Visitors today" />
            <Figure value={n(t.week.pageviews)} label="Page views, 7 days" />
          </Figures>
          {t.topPages.length ? t.topPages.map((p) => <Row key={p.title} left={p.title || '(untitled)'} right={n(p.views)} />) : <Typography variant="omega" textColor="neutral600">No page views yet this week.</Typography>}
          {t.sources.length > 0 && (
            <Box paddingTop={3}><Typography variant="pi" textColor="neutral600">From: {t.sources.map((s) => `${s.label} ${n(s.visits)}`).join(' · ')}</Typography></Box>
          )}
        </>
      )}
    </Shell>
  );
}

// ---------- Social (Postiz) ----------
type Social = { connected: true; link: string; channels: { name: string; network: string; disabled: boolean }[]; scheduled: number; published: number; failed: number; drafts: number; next: { at: string; text: string }[] };
export function SocialWidget() {
  const data = useSection<Social>('social');
  return (
    <Shell data={data} what="Postiz">
      {(s) => (
        <>
          <Figures>
            <Figure value={n(s.scheduled)} label="Scheduled" />
            <Figure value={n(s.published)} label="Posted, 7 days" />
            <Figure value={n(s.failed)} label="Failed" tone={s.failed ? 'danger' : undefined} />
          </Figures>
          <Flex gap={2} wrap="wrap" paddingBottom={2}>
            {s.channels.length ? s.channels.map((c) => <Badge key={`${c.network}-${c.name}`} active={!c.disabled}>{c.network}: {c.name}</Badge>)
              : <Typography variant="omega" textColor="neutral600">No social accounts connected in Postiz yet.</Typography>}
          </Flex>
          {s.next.map((p, i) => <Row key={i} left={p.text || '(media post)'} right={when(p.at)} href={s.link} external />)}
        </>
      )}
    </Shell>
  );
}

// ---------- Newsroom (this CMS) ----------
type Newsroom = { connected: true; publishedToday: number; drafts: number; pendingComments: number; latest: { title: string; at: string; documentId: string }[]; latestComments: { name: string; text: string; at: string }[] };
export function NewsroomWidget() {
  const data = useSection<Newsroom>('newsroom');
  return (
    <Shell data={data} what="the newsroom">
      {(c) => (
        <>
          <Figures>
            <Figure value={n(c.publishedToday)} label="Published today" />
            <Figure value={n(c.drafts)} label="Drafts not yet published" />
            <Figure value={n(c.pendingComments)} label="Comments to approve" tone={c.pendingComments ? 'danger' : undefined} />
          </Figures>
          {c.latest.map((a) => (
            <Row key={a.documentId} left={a.title} right={ago(a.at)} href={`/content-manager/collection-types/api::article.article/${a.documentId}`} />
          ))}
          {c.latestComments.length > 0 && (
            <Box paddingTop={3}>
              <Typography variant="sigma" textColor="neutral600">Latest comments</Typography>
              {c.latestComments.map((m, i) => <Row key={i} left={`${m.name}: ${m.text}`} right={ago(m.at)} href="/plugins/comments" />)}
            </Box>
          )}
        </>
      )}
    </Shell>
  );
}

// ---------- Advertising (this CMS) ----------
type Advertising = { connected: true; total: number; running: number; impressions: number; clicks: number; ctr: number | null; top: { name: string; zone: string; impressions: number; clicks: number; ctr: number | null; documentId: string }[]; endingSoon: { name: string; endsAt: string; documentId: string }[]; zonesWithoutAds: string[] };
export function AdvertisingWidget() {
  const data = useSection<Advertising>('advertising');
  const adHref = (id: string) => `/content-manager/collection-types/api::ad.ad/${id}`;
  return (
    <Shell data={data} what="advertising">
      {(a) => (
        <>
          <Figures>
            <Figure value={`${n(a.running)}/${n(a.total)}`} label="Ads running" />
            <Figure value={n(a.impressions)} label="Impressions" />
            <Figure value={n(a.clicks)} label="Clicks" />
            <Figure value={a.ctr == null ? '–' : `${a.ctr}%`} label="Click rate" />
          </Figures>
          {a.top.length ? a.top.map((ad) => (
            <Row key={ad.documentId} left={`${ad.name} · ${ad.zone}`} right={`${n(ad.impressions)} views · ${ad.ctr == null ? '–' : `${ad.ctr}%`}`} href={adHref(ad.documentId)} />
          )) : <Typography variant="omega" textColor="neutral600">No ads running right now.</Typography>}
          {a.endingSoon.length > 0 && (
            <Box paddingTop={3}>
              <Typography variant="sigma" textColor="danger600">Ending within 7 days</Typography>
              {a.endingSoon.map((ad) => <Row key={ad.documentId} left={ad.name} right={when(ad.endsAt)} href={adHref(ad.documentId)} />)}
            </Box>
          )}
          {a.zonesWithoutAds.length > 0 && (
            <Box paddingTop={3}><Typography variant="pi" textColor="neutral600">Empty ad zones: {a.zonesWithoutAds.join(', ')}</Typography></Box>
          )}
          <Box paddingTop={2}><Typography variant="pi" textColor="neutral500">Totals since each ad started.</Typography></Box>
        </>
      )}
    </Shell>
  );
}

// ---------- Racing today (HarnessLink, stored data) ----------
type Racing = { connected: true; site: string; meetings: number; races: number; resulted: number; byCountry: { country: string; meetings: number }[]; next: { venue: string; country: string; at: string; tz: string }[] };
export function RacingWidget() {
  const data = useSection<Racing>('racing', 120_000);
  return (
    <Shell data={data} what="HarnessLink racing">
      {(r) => (
        <>
          <Figures>
            <Figure value={n(r.meetings)} label={`Meetings (${r.byCountry.map((c) => `${c.meetings} ${c.country === 'AU' ? 'AUS' : c.country}`).join(', ')})`} />
            <Figure value={`${n(r.resulted)}/${n(r.races)}`} label="Races run" />
          </Figures>
          {r.next.map((m) => <Row key={m.venue} left={`${m.venue} (${m.country === 'AU' ? 'AUS' : m.country})`} right={`next ${when(m.at, m.tz)}`} href={`${r.site}/racing/${m.country === 'AU' ? 'au' : 'nz'}/fields/`} external />)}
          {!r.next.length && <Typography variant="omega" textColor="neutral600">No more races today.</Typography>}
        </>
      )}
    </Shell>
  );
}

// ---------- Sites ----------
type Sites = { connected: true; checks: { name: string; url: string; ok: boolean; status: number | null; ms: number }[] };
export function SitesWidget() {
  const data = useSection<Sites>('sites');
  return (
    <Shell data={data} what="site checks">
      {(s) => (
        <>
          {s.checks.map((c) => (
            <Row key={c.name} left={c.name} href={c.url} external
                 right={<Typography variant="omega" textColor={c.ok ? 'success600' : 'danger600'} fontWeight="bold">{c.ok ? `Up · ${c.ms} ms` : `Down${c.status ? ` (${c.status})` : ''}`}</Typography>} />
          ))}
        </>
      )}
    </Shell>
  );
}
