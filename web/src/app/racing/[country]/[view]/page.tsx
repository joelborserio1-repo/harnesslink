import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RacingBar from "@/components/racing/RacingBar";
import RaceGrid from "@/components/racing/RaceGrid";
import Silk from "@/components/racing/Silk";
import { getMeetingsOn, getRaces, getRacingDays, type Meeting, type RaceDetail } from "@/lib/harnesslink";
import {
  COUNTRY, dayLabel, horseHref, isCountry, isView, money, raceClock, raceHref, raceTime, todayIn, youtubeId,
} from "@/lib/racingLinks";

type Props = { params: Promise<{ country: string; view: string }>; searchParams: Promise<{ date?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country, view } = await params;
  if (!isCountry(country) || !isView(view)) return {};
  return { title: `${COUNTRY[country].name} harness ${view === "fields" ? "fields" : "results & replays"}` };
}

export default async function RaceDayPage({ params, searchParams }: Props) {
  const { country, view } = await params;
  if (!isCountry(country) || !isView(view)) notFound();
  const c = COUNTRY[country];
  const today = todayIn(c.tz);
  const days = (await getRacingDays(c.code)).map((d) => d.date).sort();

  const asked = (await searchParams).date;
  const valid = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : null;
  // Default: today if there's racing, else the next racing day (fields) or the last one (results).
  const date =
    valid ??
    (days.includes(today)
      ? today
      : view === "fields"
        ? (days.find((d) => d > today) ?? days.at(-1))
        : ([...days].reverse().find((d) => d < today) ?? days[0])) ??
    today;

  const meetings = await getMeetingsOn(c.code, date);
  const resulted = meetings.flatMap((m) => m.races.filter((r) => r.status.startsWith("result")).map((r) => r.id));
  const details = view === "results" ? await getRaces(resulted, true) : new Map<number, RaceDetail>();
  const nextRace = firstToRun(meetings);

  return (
    <>
      <RacingBar country={country} view={view} date={date} days={days.includes(date) ? days : [...days, date].sort()} today={today} />
      <div className="wrap py-7">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-headline text-2xl font-bold text-navy">
            {dayLabel(date, { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          <p className="text-[13px] text-muted">
            {meetings.length} {meetings.length === 1 ? "meeting" : "meetings"} · times are local to each track
          </p>
        </div>

        {meetings.length === 0 ? (
          <div className="sheet px-6 py-14 text-center">
            <p className="font-headline text-xl font-bold text-navy">No {c.name} harness meetings on this day</p>
            <p className="mt-2 text-sm text-muted">Use the dates above to move to the nearest racing day.</p>
          </div>
        ) : (
          <>
            <RaceGrid meetings={meetings} details={details} nextId={nextRace?.id ?? null} />
            <div className="mt-8 grid gap-8">
              {meetings.map((m) =>
                view === "fields" ? <MeetingFields key={m.id} m={m} nextId={nextRace?.id ?? null} /> : <MeetingResults key={m.id} m={m} details={details} country={country} />,
              )}
            </div>
          </>
        )}
        <p className="mt-8 text-[12px] text-muted">
          Fields and results from HRNZ and TAB, stored by HarnessLink. {country === "au" && "Australian results show the first four and TAB dividends. "}
          Odds are TAB fixed odds and can change. Gamble responsibly.
        </p>
      </div>
    </>
  );
}

/** The next race to start across these meetings (request time; pages are rendered per request). */
function firstToRun(meetings: Meeting[]) {
  const now = Date.now();
  return meetings
    .flatMap((m) => m.races)
    .filter((r) => !r.status.startsWith("result") && r.start_time && Date.parse(r.start_time) > now)
    .sort((a, b) => Date.parse(a.start_time!) - Date.parse(b.start_time!))[0];
}

function MeetingHead({ m, extra }: { m: Meeting; extra?: string }) {
  const done = m.races.filter((r) => r.status.startsWith("result")).length;
  return (
    <div className="rule-head mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="font-headline text-[22px] font-bold text-navy">{m.venue}</h3>
      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
        {m.races.length} races{done ? ` · ${done} resulted` : ""}{extra ? ` · ${extra}` : ""}
      </p>
    </div>
  );
}

function MeetingFields({ m, nextId }: { m: Meeting; nextId: number | null }) {
  return (
    <section>
      <MeetingHead m={m} />
      <ol className="sheet divide-y divide-line">
        {m.races.map((r) => {
          const done = r.status.startsWith("result");
          return (
            <li key={r.id}>
              <Link href={raceHref(r.id)} className="group grid grid-cols-[56px_1fr_auto] items-center gap-4 px-4 py-3 hover:bg-mist sm:grid-cols-[56px_84px_1fr_auto]">
                <span className={`grid h-11 w-11 place-items-center text-[14px] font-extrabold ${r.id === nextId ? "bg-amber text-[#1d1500]" : done ? "bg-mist text-navy" : "bg-navy text-white"}`}>
                  R{r.race_number}
                </span>
                <span className="hidden text-[15px] font-bold tabular-nums text-ink sm:block">{raceTime(r.start_time, m.timezone)}</span>
                <span className="min-w-0">
                  <b className="block truncate text-[15px] text-ink group-hover:text-blue">{r.name ?? `Race ${r.race_number}`}</b>
                  <span className="block truncate text-[12.5px] text-muted">
                    <span className="sm:hidden">{raceTime(r.start_time, m.timezone)} · </span>
                    {[r.distance_m && `${r.distance_m}m`, r.gait, r.start_type, r.class_short, money(r.stakes_total)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="text-right text-[12px] font-bold uppercase tracking-[0.1em] text-muted">
                  {done ? "Result" : r.id === nextId ? <span className="text-accent">Next up</span> : `${r.starters ?? ""}${r.starters ? " runners" : "Field"}`}
                  <span className="ml-2 text-lg text-neutral-300 group-hover:text-navy">›</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function MeetingResults({ m, details, country }: { m: Meeting; details: Map<number, RaceDetail>; country: string }) {
  const races = m.races.filter((r) => r.status.startsWith("result"));
  const pending = m.races.length - races.length;
  return (
    <section>
      <MeetingHead m={m} extra={pending ? `${pending} still to run or awaiting results` : undefined} />
      {races.length === 0 ? (
        <p className="sheet px-4 py-6 text-sm text-muted">No results yet.</p>
      ) : (
        <ol className="sheet divide-y divide-line">
          {races.map((r) => {
            const d = details.get(r.id);
            const top = (d?.entries ?? []).filter((e) => e.position && e.position <= 3).sort((a, b) => a.position! - b.position!);
            const video = youtubeId(d?.video_url);
            return (
              <li key={r.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[56px_1fr_auto] sm:items-center">
                <Link href={raceHref(r.id)} className="grid h-11 w-11 place-items-center bg-navy text-[14px] font-extrabold text-white">R{r.race_number}</Link>
                <div className="min-w-0">
                  <Link href={raceHref(r.id)} className="block truncate text-[15px] font-bold text-ink hover:text-blue">{r.name ?? `Race ${r.race_number}`}</Link>
                  <ol className="mt-2 grid gap-1.5 sm:grid-cols-3 sm:gap-4">
                    {top.map((e) => (
                      <li key={e.horse_id} className="flex min-w-0 items-center gap-2">
                        <span className={`w-7 shrink-0 text-[12px] font-extrabold ${e.position === 1 ? "text-accent" : "text-muted"}`}>{e.position === 1 ? "1st" : e.position === 2 ? "2nd" : "3rd"}</span>
                        <Silk path={e.colours_image} size={20} title={e.colours} />
                        <Link href={horseHref(e.horse_id)} className="truncate text-[13.5px] font-semibold text-navy hover:underline">
                          {e.saddlecloth != null && <span className="tabular-nums text-muted">{e.saddlecloth}. </span>}
                          {e.horse_name}
                        </Link>
                      </li>
                    ))}
                    {!top.length && <li className="text-[13px] text-muted">Placings not published yet.</li>}
                  </ol>
                </div>
                <div className="flex items-center gap-4 sm:justify-end">
                  {raceClock(d?.win_time) && (
                    <span className="text-right">
                      <span className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">Time</span>
                      <span className="text-[14px] font-bold tabular-nums text-ink">{raceClock(d?.win_time)}</span>
                    </span>
                  )}
                  {video ? (
                    <Link href={`${raceHref(r.id)}#replay`} className="btn px-3! py-2!">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
                      Replay
                    </Link>
                  ) : (
                    country === "nz" && <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Replay soon</span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
