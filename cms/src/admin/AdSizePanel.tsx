import { useEffect } from 'react';
import { Box, Button, Flex, Typography } from '@strapi/design-system';
import { useForm } from '@strapi/strapi/admin';

// "Size" in an ad's side panel: once artwork is uploaded, pick the size it
// shows at. The choices fit the chosen placement; the uploaded image's own size
// is always offered. It checks the artwork's shape matches, since a mismatched
// banner is squashed and a mismatched box is letterboxed.

type Size = [number, number, string];

// Sizes each placement can take. Banners scale to the column, keeping shape;
// rail boxes are always shown as 300 × 250.
const SIZES: Record<string, Size[]> = {
  billboard: [
    [1360, 150, 'Full-width billboard'],
    [970, 250, 'Large billboard'],
    [970, 90, 'Large leaderboard'],
    [728, 90, 'Leaderboard'],
  ],
  banner: [
    [800, 120, 'Harnesslink banner'],
    [728, 90, 'Leaderboard'],
    [970, 90, 'Large leaderboard'],
    [468, 60, 'Small banner'],
  ],
  mpu: [
    [300, 250, 'Box (MPU)'],
    [336, 280, 'Large box'],
  ],
};

const FORMAT_OF: Record<string, keyof typeof SIZES> = {
  'home-billboard': 'billboard',
  'home-mid': 'banner',
  'home-bottom': 'banner',
  'home-rail': 'mpu',
  'article-top': 'banner',
  'article-bottom': 'banner',
  'article-rail': 'mpu',
  'archive-rail': 'mpu',
};

const sameShape = (a: [number, number], b: [number, number]) => Math.abs(a[0] / a[1] - b[0] / b[1]) / (b[0] / b[1]) < 0.03;

function Sizes() {
  const values = useForm('AdSizePanel', (s: any) => s.values) as Record<string, any>;
  const onChange = useForm('AdSizePanel', (s: any) => s.onChange) as (name: string, value: unknown) => void;

  const format = FORMAT_OF[values.zone as string];
  const img = values.image as { width?: number; height?: number } | null;
  const natural: [number, number] | null = img?.width && img?.height ? [img.width, img.height] : null;
  const chosen: [number, number] | null = values.imageWidth && values.imageHeight ? [values.imageWidth, values.imageHeight] : null;

  const set = (w: number, h: number) => {
    onChange('imageWidth', w);
    onChange('imageHeight', h);
  };

  // First upload with no size set: use the placement size if the artwork is
  // that shape (including 2× artwork), else the artwork's own size.
  useEffect(() => {
    if (!natural || chosen || !format) return;
    const fit = SIZES[format].find(([w, h]) => sameShape(natural, [w, h]));
    if (fit) set(fit[0], fit[1]);
    else set(natural[0], natural[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural?.[0], natural?.[1], format]);

  if (!format) return <Typography variant="pi">Choose a placement first.</Typography>;

  const options: Size[] = [...SIZES[format]];
  if (natural && !options.some(([w, h]) => w === natural[0] && h === natural[1])) options.push([natural[0], natural[1], 'Artwork’s own size']);

  const shapeOk = natural && chosen ? sameShape(natural, chosen) : null;
  const sharp = natural && chosen ? natural[0] >= chosen[0] * 2 : null;

  return (
    <Flex direction="column" alignItems="stretch" gap={3} width="100%">
      <Typography variant="pi" textColor="neutral600">
        {natural ? `Uploaded artwork: ${natural[0]} × ${natural[1]} px` : 'Upload the artwork (Creative) to check it here.'}
      </Typography>

      <Flex direction="column" alignItems="stretch" gap={1}>
        {options.map(([w, h, label]) => {
          const on = chosen?.[0] === w && chosen?.[1] === h;
          const fits = natural ? sameShape(natural, [w, h]) : true;
          return (
            <Button key={`${w}x${h}`} variant={on ? 'default' : 'tertiary'} onClick={() => set(w, h)} justifyContent="space-between" fullWidth>
              {`${w} × ${h} — ${label}${natural && !fits ? ' (different shape)' : ''}`}
            </Button>
          );
        })}
      </Flex>

      {chosen && natural && (
        <Box>
          {shapeOk ? (
            <Typography variant="pi" textColor="success600">
              ✓ Artwork is the right shape for {chosen[0]} × {chosen[1]}.
            </Typography>
          ) : (
            <Typography variant="pi" textColor="danger600">
              Artwork is a different shape from {chosen[0]} × {chosen[1]}, so it will be {format === 'mpu' ? 'shown with gaps around it' : 'squashed'}. Ask for artwork at {chosen[0]} × {chosen[1]} (or {chosen[0] * 2} × {chosen[1] * 2}).
            </Typography>
          )}
          {shapeOk && sharp === false && (
            <Typography variant="pi" textColor="neutral600" tag="p">
              Tip: artwork at {chosen[0] * 2} × {chosen[1] * 2} looks sharper on phones and Retina screens.
            </Typography>
          )}
        </Box>
      )}
      <Typography variant="pi" textColor="neutral600">
        Save the ad to keep the size.
      </Typography>
    </Flex>
  );
}

const AdSizePanel = ({ model }: { model: string }) => {
  if (model !== 'api::ad.ad') return null;
  return { title: 'Size', content: <Sizes /> };
};

export default AdSizePanel;
