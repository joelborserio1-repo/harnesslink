import Link from "next/link";
import ArticleTile from "@/components/home/ArticleTile";
import Countdown from "@/components/event/Countdown";
import SocialFeed from "@/components/event/SocialFeed";
import type { EventImage, EventOdds, EventPage } from "@/lib/api";

// An event hub (The Eureka; the next big race is another "Event page" in the
// CMS). Layout follows the live WordPress page: countdown banner, section
// menu with the race facts, news beside the TAB market and social feed, then
// previous winners, about, slot holders and associates. Every block can be
// switched off in the CMS.

const SYDNEY = "Australia/Sydney";

function Img({ image, className, sizes }: { image: EventImage; className?: string; sizes?: string }) {
  if (!image) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.src}
      alt={image.alt}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      sizes={sizes}
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
}

function SectionHead({ id, title, aside }: { id: string; title: string; aside?: React.ReactNode }) {
  return (
    <div id={id} className="rule-head mb-5 flex scroll-mt-6 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="panel-label">{title}</h2>
      {aside}
    </div>
  );
}

const raceDate = (iso: string, tz: string) =>
  new Date(iso).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz });

const snapshotTime = (iso: string) =>
  new Date(iso)
    .toLocaleString("en-AU", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: SYDNEY, timeZoneName: "short" })
    .replace(/\b(am|pm)\b/i, (m) => m.toLowerCase());

function Hero({ event }: { event: EventPage }) {
  return (
    <section className="relative overflow-hidden bg-navy">
      {event.hero && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.hero.src} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-left" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#00205E]/20 via-[#00205E]/10 to-[#00205E]/70" aria-hidden />
      <div className="wrap relative flex min-h-[220px] flex-col items-start justify-center gap-6 py-8 sm:min-h-[280px] md:flex-row md:items-center md:justify-between">
        <div className="max-w-[340px]">
          {event.logo ? (
            // Official logos are drawn for light backgrounds: give them one.
            <span className="inline-block bg-white/92 px-4 py-3">
              <Img image={event.logo} className="h-auto w-[190px] sm:w-[250px]" />
            </span>
          ) : (
            <h1 className="font-headline text-[40px] font-semibold text-white">{event.title}</h1>
          )}
          {event.logo && <h1 className="sr-only">{event.title}</h1>}
          {event.subtitle && <p className="font-ui mt-3 text-[12px] font-bold uppercase tracking-[0.18em] text-white/85">{event.subtitle}</p>}
        </div>
        {event.start && <Countdown start={event.start} finishedText={event.finishedText} />}
      </div>
    </section>
  );
}

function NavBand({ event }: { event: EventPage }) {
  const links = [
    event.news.show && ["news", "News"],
    event.results.show && ["winners", "Previous winners"],
    event.about.show && ["about", "About"],
    event.slotHolders.show && ["slot-holders", "Slot holders"],
    event.associates.show && ["associates", "Associates"],
  ].filter(Boolean) as [string, string][];
  const f = event.facts;
  const facts = [
    f.venue && (f.location ? `${f.venue}, ${f.location}` : f.venue),
    event.start && raceDate(event.start, event.timezone),
    f.prizeMoney,
    f.distance,
    f.slots,
    f.eligibility,
  ].filter(Boolean) as string[];
  return (
    <div className="border-b border-line bg-white">
      <div className="wrap flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label={`${event.title} sections`} className="flex flex-wrap gap-x-6 gap-y-2">
          {links.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="font-ui text-[12px] font-bold uppercase tracking-[0.12em] text-navy hover:text-blue">
              {label}
            </a>
          ))}
        </nav>
        {facts.length > 0 && (
          <ul className="font-ui flex flex-wrap gap-x-2 gap-y-1 text-[12px] text-muted">
            {facts.map((t, i) => (
              <li key={t}>
                {i > 0 && <span className="mr-2 text-line" aria-hidden>·</span>}
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function OddsPanel({ title, odds }: { title: string; odds: EventOdds }) {
  return (
    <section className="sheet" aria-labelledby="event-odds">
      <div className="flex items-center justify-between bg-navy px-4 py-3 text-white">
        <div>
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.18em] text-amber">Harnesslink</p>
          <h2 id="event-odds" className="font-headline text-[19px] font-semibold leading-tight">
            {title}
          </h2>
        </div>
        <span className="font-ui text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">TAB</span>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="font-ui border-b border-line text-[10px] uppercase tracking-[0.12em] text-muted">
            <th className="px-4 py-2 text-left font-bold">Runner</th>
            <th className="px-2 py-2 text-right font-bold">Win</th>
            <th className="px-4 py-2 text-right font-bold">Place</th>
          </tr>
        </thead>
        <tbody>
          {odds.runners.map((r, i) => (
            <tr key={`${r.runner}-${i}`} className="border-b border-line last:border-0">
              <td className="px-4 py-2 font-semibold text-ink">
                <span className="mr-2 inline-block w-4 text-right text-muted tabular-nums">{i + 1}</span>
                {r.runner}
              </td>
              <td className="px-2 py-2 text-right font-bold text-navy tabular-nums">{r.win}</td>
              <td className="px-4 py-2 text-right text-muted tabular-nums">{r.place}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-line px-4 py-3 text-[11px] leading-snug text-muted">
        {odds.marketUrl && (
          <a href={odds.marketUrl} target="_blank" rel="noopener noreferrer sponsored" className="mb-2 block font-bold text-navy hover:text-blue">
            Full market at TAB →
          </a>
        )}
        <p>Odds are subject to change. Gamble responsibly. For free and confidential support, call Gambling Help on 1800 858 858.</p>
        {(odds.updatedAt || odds.updatedLabel) && (
          <p className="mt-1">Prices as at {odds.updatedAt ? snapshotTime(odds.updatedAt) : odds.updatedLabel}</p>
        )}
      </div>
    </section>
  );
}

function SocialPanel({ event }: { event: EventPage }) {
  const s = event.social;
  return (
    <section className="sheet" aria-labelledby="event-social">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" className="text-ink" aria-hidden>
          <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43z" />
        </svg>
        <h2 id="event-social" className="panel-label !text-[12px]">
          {s.title}
        </h2>
      </div>
      <div className="px-3 py-3">
        {s.curatorFeedId ? (
          <SocialFeed feedId={s.curatorFeedId} />
        ) : (
          s.xHandle && (
            <a href={`https://x.com/${s.xHandle}`} target="_blank" rel="noopener noreferrer" className="font-bold text-navy hover:text-blue">
              Follow @{s.xHandle} on X →
            </a>
          )
        )}
      </div>
      {(s.xHandle || s.hashtags.length > 0) && (
        <p className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-muted">
          {s.xHandle && (
            <a href={`https://x.com/${s.xHandle}`} target="_blank" rel="noopener noreferrer" className="mr-2 font-bold text-navy hover:text-blue">
              @{s.xHandle}
            </a>
          )}
          {s.hashtags.map((h) => (
            <a key={h} href={`https://x.com/hashtag/${encodeURIComponent(h)}`} target="_blank" rel="noopener noreferrer" className="mr-2 hover:text-blue">
              #{h}
            </a>
          ))}
        </p>
      )}
    </section>
  );
}

function Results({ event }: { event: EventPage }) {
  const cols: [keyof EventPage["results"]["rows"][number], string][] = [
    ["driver", "Driver"],
    ["trainer", "Trainer"],
    ["slotHolder", "Slot holder"],
    ["barrier", "Barrier"],
    ["odds", "Odds"],
    ["time", "Time"],
    ["second", "Second"],
    ["third", "Third"],
  ];
  return (
    <section className="sheet px-5 py-6 sm:px-8">
      <SectionHead
        id="winners"
        title="Previous winners"
        aside={event.results.sponsorLabel && <span className="meta">{event.results.sponsorLabel}</span>}
      />
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead>
            <tr className="font-ui bg-navy text-left text-[10px] uppercase tracking-[0.12em] text-white">
              <th className="px-3 py-2.5 font-bold">Year</th>
              <th className="px-3 py-2.5 font-bold">Winner</th>
              {cols.map(([, label]) => (
                <th key={label} className="px-3 py-2.5 font-bold">
                  {label}
                </th>
              ))}
              <th className="px-3 py-2.5 font-bold">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {event.results.rows.map((r) => (
              <tr key={r.year} className="border-b border-line align-middle">
                <td className="px-3 py-3 font-bold text-navy tabular-nums">{r.year}</td>
                <td className="px-3 py-3">
                  <span className="flex items-center gap-3">
                    {r.silks && <Img image={r.silks} className="h-[46px] w-[62px] shrink-0 object-contain" />}
                    <strong className="text-ink">{r.winner}</strong>
                  </span>
                </td>
                {cols.map(([key]) => (
                  <td key={key} className="px-3 py-3 text-[#33363d]">
                    {String(r[key] ?? "") || "–"}
                  </td>
                ))}
                <td className="px-3 py-3">
                  <span className="flex gap-3 text-[12px] font-bold">
                    {r.storyUrl && (
                      <a href={r.storyUrl} className="text-navy hover:text-blue">
                        Story
                      </a>
                    )}
                    {r.replayUrl && r.replayUrl !== r.storyUrl && (
                      <a href={r.replayUrl} target="_blank" rel="noopener noreferrer" className="text-navy hover:text-blue">
                        Replay
                      </a>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function About({ event }: { event: EventPage }) {
  const f = event.facts;
  const boxes = [
    ["Prize money", f.prizeMoney],
    ["Race distance", f.distance],
    ["Slot holders", f.slots],
    ["Eligibility", f.eligibility],
  ].filter(([, v]) => v) as [string, string][];
  return (
    <section className="sheet px-5 py-6 sm:px-8">
      <SectionHead id="about" title={event.about.heading} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-start">
        <div>
          {event.about.subheading && <p className="font-headline mb-4 text-[22px] font-semibold leading-snug text-navy">{event.about.subheading}</p>}
          <div className="text-[15px] leading-[1.7] text-[#33363d] [&_a]:text-navy [&_a]:underline [&_p]:mb-4 [&_p:last-child]:mb-0" dangerouslySetInnerHTML={{ __html: event.about.html || "" }} />
          {boxes.length > 0 && (
            <dl className="mt-6 grid grid-cols-2 border-l border-t border-line">
              {boxes.map(([label, value]) => (
                <div key={label} className="border-b border-r border-line px-4 py-3">
                  <dt className="meta">{label}</dt>
                  <dd className="mt-1 text-[15px] font-bold text-navy">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {event.about.image && <Img image={event.about.image} className="h-auto w-full" sizes="(max-width: 1024px) 100vw, 600px" />}
      </div>
    </section>
  );
}

const STATUS = { to_be_announced: "Runner to be announced", reported: "Runner reported", confirmed: "Confirmed runner" } as const;

function SlotHolders({ event }: { event: EventPage }) {
  return (
    <section className="sheet px-5 py-6 sm:px-8">
      <SectionHead id="slot-holders" title={event.slotHolders.heading} />
      {event.slotHolders.note && <p className="-mt-2 mb-5 text-[13px] text-muted">{event.slotHolders.note}</p>}
      <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
        {event.slotHolders.rows.map((s) => (
          <article key={s.name} className="flex flex-col bg-white">
            <div className="bg-[#efeeeb]">
              {s.silks ? <Img image={s.silks} className="aspect-[317/270] h-auto w-full object-contain" /> : <div className="aspect-[317/270]" />}
            </div>
            <div className="flex flex-1 flex-col px-3 py-3">
              <h3 className="font-headline text-[15px] font-bold leading-snug text-navy">
                {s.website ? (
                  <a href={s.website} target="_blank" rel="noopener noreferrer" className="hl-link">
                    {s.name}
                  </a>
                ) : (
                  s.name
                )}
              </h3>
              <p className={`meta mt-1.5 ${s.status === "confirmed" ? "!text-accent" : ""}`}>{STATUS[s.status] ?? STATUS.to_be_announced}</p>
              {s.runner && s.status !== "to_be_announced" && <p className="mt-1 text-[15px] font-bold text-ink">{s.runner}</p>}
              {(s.trainer || s.driver) && s.status !== "to_be_announced" && (
                <p className="mt-0.5 text-[12px] text-muted">
                  {[s.trainer && `Trainer: ${s.trainer}`, s.driver && `Driver: ${s.driver}`].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Associates({ event }: { event: EventPage }) {
  return (
    <section className="sheet px-5 py-6 sm:px-8">
      <SectionHead id="associates" title={event.associates.heading} />
      <div className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-3">
        {event.associates.rows.map((a) => {
          const logo = a.logo ? <Img image={a.logo} className="mx-auto h-[90px] w-auto max-w-full object-contain" /> : <span className="font-bold text-navy">{a.name}</span>;
          return (
            <div key={a.name} className="grid place-items-center bg-white px-6 py-5">
              {a.url ? (
                <a href={a.url} target="_blank" rel="noopener noreferrer" aria-label={a.name}>
                  {logo}
                </a>
              ) : (
                logo
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function EventView({ event, odds }: { event: EventPage; odds: EventOdds | null }) {
  const showOdds = event.odds.show && !!odds?.runners.length;
  const aside = showOdds || event.social.show;
  return (
    <>
      <Hero event={event} />
      <NavBand event={event} />
      <div className="wrap my-7 space-y-7">
        {(event.news.show || aside) && (
          <div className={`grid gap-7 ${aside ? "lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start" : ""}`}>
            {event.news.show && (
              <section className="sheet px-5 py-6 sm:px-8">
                <SectionHead
                  id="news"
                  title="Latest news"
                  aside={
                    event.news.category && (
                      <Link href={event.news.category.url} className="font-ui text-[12px] font-bold uppercase tracking-[0.1em] text-navy hover:text-blue">
                        All news →
                      </Link>
                    )
                  }
                />
                <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
                  {event.news.articles.map((a) => (
                    <ArticleTile key={a.id} article={a} />
                  ))}
                </div>
              </section>
            )}
            {aside && (
              <aside className="space-y-7">
                {showOdds && <OddsPanel title={event.odds.title} odds={odds!} />}
                {event.social.show && <SocialPanel event={event} />}
              </aside>
            )}
          </div>
        )}
        {event.results.show && <Results event={event} />}
        {event.about.show && <About event={event} />}
        {event.slotHolders.show && <SlotHolders event={event} />}
        {event.associates.show && <Associates event={event} />}
      </div>
    </>
  );
}
