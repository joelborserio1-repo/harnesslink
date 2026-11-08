import type { Core } from '@strapi/strapi';

// TAB prices for event pages, from the Harnesslink markets API
// (admin.harnesslink.com, which polls TAB from its allowlisted server; TAB
// itself refuses non-browser clients). Like the old WordPress plugin, the page
// shows a snapshot taken at 8am and 4pm Sydney time (cron-tasks.ts), plus one
// taken on demand when a page has none yet or its TAB race name was changed.
// If the feed fails, the last good snapshot stays; with none, the editor's
// backup prices show.

const UID = 'api::event-page.event-page';
const RETRY_MS = 10 * 60_000;

type Runner = { name: string; win: number; place: number | null };
type Snapshot = { raceName: string; marketName: string; runners: Runner[]; takenAt: string; pricesAt: string | null };

const base = (n: string) => String(n || '').replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const store = strapi.store({ type: 'api', name: 'event-page' });
  const lastTry = new Map<string, number>();

  async function fetchMarkets(): Promise<any[]> {
    const url = `${(process.env.HARNESSLINK_API_URL || 'https://admin.harnesslink.com/api').replace(/\/$/, '')}/v1/tab/markets`;
    const key = process.env.HARNESSLINK_API_KEY;
    if (!key) throw new Error('HARNESSLINK_API_KEY is not set');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`markets API answered ${res.status}`);
    const body: any = await res.json();
    return Array.isArray(body?.markets) ? body.markets : [];
  }

  // Exact race name first, then the same race with a different bracketed
  // suffix (TAB renames "(Pre Noms)" to "(Final Field)" and so on).
  const findMarket = (markets: any[], race: string) =>
    markets.find((m) => m?.race_name === race) || markets.find((m) => base(m?.race_name) === base(race)) || null;

  async function snapshot(slug: string, raceName: string): Promise<Snapshot | null> {
    lastTry.set(slug, Date.now());
    try {
      const market = findMarket(await fetchMarkets(), raceName);
      if (!market) throw new Error(`no TAB market named "${raceName}"`);
      const runners: Runner[] = (market.runners || [])
        .filter((r: any) => r?.status === 'Open' && Number(r.win) > 0)
        .sort((a: any, b: any) => Number(a.win) - Number(b.win))
        .map((r: any) => ({
          name: [r.name, r.name_suffix].filter(Boolean).join(' ').trim(),
          win: Number(r.win),
          place: Number(r.place) > 0 ? Number(r.place) : null,
        }));
      if (!runners.length) throw new Error(`"${market.race_name}" has no open runners`);
      const snap: Snapshot = { raceName, marketName: market.race_name, runners, takenAt: new Date().toISOString(), pricesAt: market.odds_updated_at || null };
      await store.set({ key: `odds:${slug}`, value: snap });
      return snap;
    } catch (e) {
      strapi.log.warn(`[event-odds] ${slug}: ${(e as Error).message}`);
      return null;
    }
  }

  return {
    // Cron: refresh every published page that shows odds.
    async refreshAll() {
      const pages = await strapi.documents(UID).findMany({
        status: 'published',
        filters: { showOdds: true, tabRaceName: { $notNull: true } },
        fields: ['slug', 'tabRaceName'],
      } as any);
      for (const p of pages as any[]) if (p.tabRaceName) await snapshot(p.slug, p.tabRaceName);
    },

    async forPage(slug: string) {
      const page: any = await strapi.documents(UID).findFirst({
        status: 'published',
        filters: { slug },
        fields: ['slug', 'showOdds', 'tabRaceName', 'tabMarketUrl', 'oddsRunnersShown', 'backupPricesAt'],
        populate: { backupPrices: true },
      } as any);
      if (!page || !page.showOdds) return null;
      let snap = (await store.get({ key: `odds:${slug}` })) as Snapshot | null;
      const wrongRace = !!(snap && page.tabRaceName && snap.raceName !== page.tabRaceName);
      if (page.tabRaceName && (!snap || wrongRace) && Date.now() - (lastTry.get(slug) || 0) > RETRY_MS) {
        snap = (await snapshot(slug, page.tabRaceName)) || (wrongRace ? null : snap);
      }
      const shown = page.oddsRunnersShown || 10;
      const money = (n: number | null) => (n ? `$${n.toFixed(2)}` : '');
      if (snap && (!page.tabRaceName || snap.raceName === page.tabRaceName)) {
        return {
          source: 'tab',
          marketUrl: page.tabMarketUrl || null,
          updatedAt: snap.takenAt,
          runners: snap.runners.slice(0, shown).map((r) => ({ runner: r.name, win: money(r.win), place: money(r.place) })),
        };
      }
      const backup = (page.backupPrices || []).slice(0, shown);
      if (!backup.length) return null;
      return {
        source: 'backup',
        marketUrl: page.tabMarketUrl || null,
        updatedLabel: page.backupPricesAt || null,
        runners: backup.map((r: any) => ({ runner: r.runner, win: r.win || '', place: r.place || '' })),
      };
    },
  };
};
