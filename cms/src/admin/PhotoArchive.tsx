import { useEffect, useRef, useState } from 'react';
import { Box, Button, Flex, Main, TextInput, Typography } from '@strapi/design-system';
import { Layouts, useFetchClient } from '@strapi/strapi/admin';

// "Photo archive" in the newsroom menu: search every photo from the old site
// by horse, driver, trainer, track or story headline (src/photos.ts).

type Photo = {
  id: number;
  url: string;
  thumb: string;
  title: string;
  alt: string;
  caption: string;
  width: number | null;
  height: number | null;
  uploadedAt: string | null;
  stories: string[];
  storyCount: number;
};
type Result = { total: number; page: number; pageSize: number; photos: Photo[] };

const date = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export type { Photo };

// compact: the narrow version for a story's side panel. actions: extra buttons
// for the opened photo (e.g. "Make lead photo").
export function PhotoSearch({ compact, actions }: { compact?: boolean; actions?: (p: Photo) => React.ReactNode }) {
  const { get } = useFetchClient();
  const size = compact ? 12 : 30;
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Result | null>(null);
  const [open, setOpen] = useState<Photo | null>(null);
  const [copied, setCopied] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    const t = setTimeout(() => {
      get<Result>(`/hl-photos/search?q=${encodeURIComponent(q)}&page=${page}&pageSize=${size}`)
        .then(({ data }) => n === seq.current && setRes(data))
        .catch(() => n === seq.current && setRes({ total: 0, page: 1, pageSize: size, photos: [] }));
    }, 250);
    return () => clearTimeout(t);
  }, [get, q, page, size]);

  const pages = res ? Math.ceil(res.total / res.pageSize) : 0;
  const label = (p: Photo) => p.caption || p.alt || p.title;

  return (
    <Flex direction="column" alignItems="stretch" gap={4}>
      <TextInput
        aria-label="Search photos"
        placeholder={compact ? 'Search photos…' : 'Horse, driver, trainer, track or headline…'}
        value={q}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      <Typography variant="pi" textColor="neutral600">
        {res ? `${res.total.toLocaleString('en-NZ')} photo${res.total === 1 ? '' : 's'}${q ? '' : ', newest first'}` : 'Searching…'}
      </Typography>

      {open && (
        <Box background="neutral0" padding={compact ? 0 : 4} hasRadius shadow={compact ? undefined : 'tableShadow'}>
          <Flex gap={4} alignItems="flex-start" wrap="wrap">
            <a href={open.url} target="_blank" rel="noreferrer" style={{ maxWidth: '100%' }}>
              <img src={open.thumb} alt={open.alt} style={{ maxWidth: compact ? '100%' : 360, maxHeight: 260, display: 'block' }} />
            </a>
            <Flex direction="column" alignItems="flex-start" gap={2} style={{ flex: 1, minWidth: compact ? 0 : 240 }}>
              <Typography variant="delta">{label(open)}</Typography>
              <Typography variant="pi" textColor="neutral600">
                {[open.width && open.height ? `${open.width} × ${open.height}` : '', date(open.uploadedAt)].filter(Boolean).join(' · ')}
              </Typography>
              {open.stories.length > 0 && (
                <Box>
                  <Typography variant="sigma" textColor="neutral600">
                    Used in {open.storyCount} {open.storyCount === 1 ? 'story' : 'stories'}
                  </Typography>
                  {open.stories.map((s) => (
                    <Typography key={s} tag="p" variant="pi">
                      {s}
                    </Typography>
                  ))}
                </Box>
              )}
              <Flex gap={2} wrap="wrap">
                {actions?.(open)}
                <Button
                  variant="secondary"
                  onClick={() => navigator.clipboard.writeText(open.url).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}
                >
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
                <Button variant="tertiary" onClick={() => setOpen(null)}>
                  Close
                </Button>
              </Flex>
            </Flex>
          </Flex>
        </Box>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 110 : 160}px, 1fr))`, gap: compact ? 8 : 12 }}>
        {res?.photos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(p)}
            title={label(p)}
            style={{ border: open?.id === p.id ? '2px solid #00205E' : '1px solid #dcdce4', padding: 0, background: '#fff', cursor: 'pointer', textAlign: 'left' }}
          >
            <img src={p.thumb} alt={p.alt} loading="lazy" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block', background: '#f0f0f5' }} />
            {!compact && <div style={{ padding: '6px 8px', fontSize: 12, lineHeight: 1.3, height: 46, overflow: 'hidden' }}>{label(p)}</div>}
          </button>
        ))}
      </div>

      {pages > 1 && (
        <Flex gap={2} justifyContent="center">
          <Button variant="tertiary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {compact ? '‹' : 'Previous'}
          </Button>
          <Typography variant="pi">
            {compact ? `${page} / ${Math.min(pages, 200)}` : `Page ${page} of ${Math.min(pages, 200)}`}
          </Typography>
          <Button variant="tertiary" disabled={page >= Math.min(pages, 200)} onClick={() => setPage(page + 1)}>
            {compact ? '›' : 'Next'}
          </Button>
        </Flex>
      )}
    </Flex>
  );
}

const PhotoArchive = () => (
  <Main>
    <Layouts.Header title="Photo archive" subtitle="Every photo from the old site. Search by horse, driver, trainer, track or headline." />
    <Layouts.Content>
      <PhotoSearch />
    </Layouts.Content>
  </Main>
);

export default PhotoArchive;
