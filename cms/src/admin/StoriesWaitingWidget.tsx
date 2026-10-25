import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Flex, Typography } from '@strapi/design-system';
import { Widget, useFetchClient } from '@strapi/strapi/admin';

type Row = { documentId: string; title: string; status: 'draft' | 'modified' | 'published'; updatedAt: string };

const UID = 'api::article.article';
const SHOW = 8;

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function StoriesWaitingWidget() {
  const { get } = useFetchClient();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    get<{ results: Row[] }>(`/content-manager/collection-types/${UID}`, {
      params: { page: 1, pageSize: 40, sort: 'updatedAt:DESC' },
    })
      .then(({ data }) => setRows(data.results.filter((r) => r.status !== 'published').slice(0, SHOW)))
      .catch(() => setFailed(true));
  }, [get]);

  if (failed) return <Widget.Error />;
  if (!rows) return <Widget.Loading />;
  if (rows.length === 0) return <Widget.NoData>Nothing waiting — every story is published.</Widget.NoData>;

  return (
    <Flex direction="column" alignItems="stretch" gap={1}>
      {rows.map((r) => (
        <Box key={r.documentId} paddingTop={2} paddingBottom={2} borderColor="neutral150" style={{ borderBottomWidth: 1, borderBottomStyle: 'solid' }}>
          <Link to={`/content-manager/collection-types/${UID}/${r.documentId}`} style={{ textDecoration: 'none' }}>
            <Typography variant="omega" fontWeight="bold" textColor="neutral800" ellipsis>
              {r.title || '(untitled)'}
            </Typography>
          </Link>
          <Typography variant="pi" textColor="neutral600">
            {r.status === 'draft' ? 'Draft' : 'Edited since publishing'} · {when(r.updatedAt)}
          </Typography>
        </Box>
      ))}
    </Flex>
  );
}
