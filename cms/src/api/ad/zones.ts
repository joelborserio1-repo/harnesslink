// Ad placements, mirroring harnesslink.com (measured 2 Oct 2026). `slots` is
// how many different ads a placement shows at once: rails stack three
// 300 × 250 boxes drawn from the placement's pool without repeats.
export const ZONES = {
  'home-billboard': { format: 'billboard', slots: 1, label: 'Home — full-width banner under the top stories (1360 × 150)' },
  'home-mid': { format: 'banner', slots: 1, label: 'Home — banner between Trending and International (800 × 120)' },
  'home-bottom': { format: 'banner', slots: 1, label: 'Home — banner at the foot of the main column (800 × 120)' },
  'home-rail': { format: 'mpu', slots: 3, label: 'Home — right rail, 3 boxes (300 × 250)' },
  'article-top': { format: 'banner', slots: 1, label: 'Article — banner above the headline (800 × 120)' },
  'article-bottom': { format: 'banner', slots: 1, label: 'Article — banner after the story (800 × 120)' },
  'article-rail': { format: 'mpu', slots: 3, label: 'Article — right rail, 3 boxes (300 × 250)' },
  'archive-rail': { format: 'mpu', slots: 3, label: 'Country, category, writer & tag pages — right rail, 3 boxes (300 × 250)' },
} as const;

export type Zone = keyof typeof ZONES;

type Weighted = { weight?: number | null };

// Weighted draw without replacement: up to `count` different items.
export function weightedSample<T extends Weighted>(items: T[], count: number, rand = Math.random): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, a) => sum + Math.max(a.weight ?? 1, 1), 0);
    let target = rand() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      target -= Math.max(pool[i].weight ?? 1, 1);
      if (target < 0) {
        index = i;
        break;
      }
    }
    picked.push(pool[index]);
    pool.splice(index, 1);
  }
  return picked;
}

// Country targeting. An ad with no market ticked shows everywhere; otherwise
// only to readers in a ticked market. The reader's country comes from
// Cloudflare (CF-IPCountry), passed through by the website.
export const MARKETS = {
  showAustralia: ['AU'],
  showNewZealand: ['NZ'],
  showUSA: ['US'],
  showCanada: ['CA'],
  showUKIreland: ['GB', 'IE', 'IM', 'JE', 'GG'],
  showEurope: [
    'AT', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IS', 'IT', 'LI', 'LT',
    'LU', 'LV', 'MC', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'SM',
  ],
} as const;

export type MarketField = keyof typeof MARKETS | 'showElsewhere';

// Which market field a two-letter country code falls under.
export function marketOf(country: string | null | undefined): MarketField {
  const code = String(country || '').toUpperCase();
  for (const [field, codes] of Object.entries(MARKETS)) {
    if ((codes as readonly string[]).includes(code)) return field as MarketField;
  }
  return 'showElsewhere';
}

const ALL_MARKETS: MarketField[] = [...(Object.keys(MARKETS) as MarketField[]), 'showElsewhere'];

export function showsIn(ad: Partial<Record<MarketField, boolean | null>>, market: MarketField): boolean {
  const targeted = ALL_MARKETS.some((m) => ad[m]);
  return !targeted || !!ad[market];
}
