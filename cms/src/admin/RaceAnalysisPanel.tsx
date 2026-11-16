import { Button, Flex, Typography } from '@strapi/design-system';
import { useForm } from '@strapi/strapi/admin';
import { useNavigate } from 'react-router-dom';

// On a Harness Analyst story: a way into the tips / speed map editor
// (./RaceAnalysisEditor). Shown only on stories with a meeting attached.
function Content({ documentId }: { documentId: string }) {
  const navigate = useNavigate();
  const ra = useForm('RaceAnalysisPanel', (s: any) => s.values.raceAnalysis) as any;
  const m = ra?.meeting;
  const tips = Object.values(ra?.notes || {}).reduce((t: number, n: any) => t + (n?.picks?.length || 0), 0);
  return (
    <Flex direction="column" alignItems="stretch" gap={2} width="100%">
      <Typography variant="pi" textColor="neutral600">
        {m.venue}, {m.date} · {m.races?.length} races · {tips} tips
      </Typography>
      <Button variant="secondary" fullWidth onClick={() => navigate(`/race-analysis/${documentId}`)}>
        Edit tips &amp; speed maps
      </Button>
    </Flex>
  );
}

const RaceAnalysisPanel = ({ model, documentId, document }: { model: string; documentId?: string; document?: any }) => {
  if (model !== 'api::article.article' || !documentId || !document?.raceAnalysis?.meeting) return null;
  return { title: 'Race analysis', content: <Content documentId={documentId} /> };
};

export default RaceAnalysisPanel;
