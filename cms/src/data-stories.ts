import { api, pullMeeting } from './race-analysis';

// Story Builder templates that start a story with the racing data already
// written into the story text (plain HTML the journalist edits like any other
// story): meeting wrap, horse spotlight, weekly racing review. Everything is
// from the HarnessLink racing API (TAB); nothing is made up. Tables carry the
// "hl-data" class (styled in web globals.css).

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// TAB writes many names in capitals.
const tidy = (s: string | null | undefined) => {
  const t = String(s || '').trim();
  if (!t || t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bMc([a-z])/g, (_m, c) => `Mc${c.toUpperCase()}`);
};
const raceName = (n: string) => n.replace(/\s+(Ms|Ss)$/i, '').trim();
const longDate = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const shortDate = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const ordinal = (p: string | null) => {
  const n = Number(p);
  if (!n) return p || '–';
  return `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
};
const table = (head: string[], rows: (string | number | null)[][]) =>
  `<table class="hl-data"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c ?? '–')}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;

// ---------- meeting wrap ----------

export async function meetingWrap(meetingId: number) {
  const m = await pullMeeting(meetingId);
  const done = m.races.filter((r) => r.entries.some((e) => e.placing === '1'));
  if (!done.length) throw Object.assign(new Error(`No results yet for ${m.venue} on ${longDate(m.date)}.`), { status: 404 });
  const parts: string[] = [];
  parts.push(
    `<p><strong>${esc(m.venue)}</strong> raced on ${esc(longDate(m.date))}${m.trackCondition ? ` on a ${esc(m.trackCondition.toLowerCase())} track` : ''}, with ${done.length} of ${m.races.length} races resulted. The winners, placegetters, times and dividends from TAB are below.</p>`
  );
  for (const r of m.races) {
    const by = (p: string) => r.entries.find((e) => e.placing === p && !e.scratched);
    const w = by('1');
    if (!w) continue;
    const second = by('2');
    const third = by('3');
    const bits = [
      second && `2nd ${esc(second.horse)}${second.margin ? ` (${esc(second.margin)}m)` : ''}`,
      third && `3rd ${esc(third.horse)}${third.margin ? ` (${esc(third.margin)}m)` : ''}`,
    ].filter(Boolean);
    const times = [r.winTime && `time ${esc(r.winTime)}`, r.mileRate && `mile rate ${esc(r.mileRate)}`].filter(Boolean);
    parts.push(`<h3>Race ${r.no}: ${esc(raceName(r.name))}${r.distance ? ` (${r.distance}m)` : ''}</h3>`);
    parts.push(
      `<p><strong>${esc(w.horse)}</strong> (${w.no}) won for driver ${esc(w.driver || '–')} and trainer ${esc(w.trainer || '–')}${w.win ? `, at $${w.win.toFixed(2)}` : ''}. ${bits.join(', ')}${bits.length ? '.' : ''}${times.length ? ` Winning ${times.join(', ')}.` : ''}</p>`
    );
    if (r.dividends) parts.push(`<p><em>Dividends: ${esc(r.dividends)}</em></p>`);
  }
  return {
    title: `${m.venue} results, ${longDate(m.date)}`,
    html: parts.join('\n'),
    summary: { venue: m.venue, date: m.date, races: m.races.length, resulted: done.length },
  };
}

// ---------- horse spotlight ----------

const COLOUR: Record<string, string> = { B: 'bay', BR: 'brown', BL: 'black', CH: 'chestnut', GR: 'grey', 'B/BR': 'bay or brown', BBR: 'bay or brown', RO: 'roan' };

export async function searchHorses(q: string) {
  const d = await api(`/search?q=${encodeURIComponent(q)}`);
  return (d.horses || []).slice(0, 12).map((h: any) => ({ id: h.id, name: h.name, sex: h.sex, sire: h.sire, dam: h.dam, starts: h.starts, wins: h.wins }));
}

export async function horseSpotlight(horseId: number) {
  const h = await api(`/horses/${horseId}`);
  const rec = h.record || {};
  const runs = [...(h.runs || [])].sort((a: any, b: any) => String(b.meeting_date).localeCompare(String(a.meeting_date)));
  const colour = COLOUR[String(h.colour || '').toUpperCase()] || null;
  const sex = h.sex ? String(h.sex).toLowerCase() : 'horse';
  const parts: string[] = [];
  const intro = [
    `<strong>${esc(h.name)}</strong> is a ${[colour, sex].filter(Boolean).map(esc).join(' ')}`,
    h.sire ? ` by ${esc(h.sire)}` : '',
    h.dam ? ` out of ${esc(h.dam)}` : '',
    h.trainer_name ? `, trained by ${esc(tidy(h.trainer_name))}` : '',
    '.',
  ].join('');
  parts.push(`<p>${intro}</p>`);
  parts.push('<h3>Record</h3>');
  parts.push(
    table(
      ['Starts', 'Wins', 'Seconds', 'Thirds', 'Win %', 'Place %'],
      [[rec.starts ?? 0, rec.wins ?? 0, rec.seconds ?? 0, rec.thirds ?? 0, rec.win_pct != null ? `${rec.win_pct}%` : '–', rec.place_pct != null ? `${rec.place_pct}%` : '–']]
    )
  );
  if (runs.length) {
    parts.push('<h3>Recent runs</h3>');
    parts.push(
      table(
        ['Date', 'Track', 'Race', 'Distance', 'Result', 'Driver'],
        runs.slice(0, 10).map((r: any) => [
          shortDate(r.meeting_date),
          r.venue,
          raceName(String(r.race_name || `Race ${r.race_number}`)),
          r.distance_m ? `${r.distance_m}m` : '–',
          r.scratched ? 'Scratched' : r.placing ? ordinal(r.placing) : 'Upcoming',
          tidy(r.driver_name),
        ])
      )
    );
  }
  return {
    title: `Horse spotlight: ${h.name}`,
    html: parts.join('\n'),
    summary: { name: h.name, sex: h.sex, colour, sire: h.sire, dam: h.dam, trainer: tidy(h.trainer_name), starts: rec.starts ?? 0, wins: rec.wins ?? 0, runs: runs.length },
  };
}

// ---------- weekly racing review ----------

// Monday of the week a date falls in.
export const mondayOf = (d: string) => {
  const t = new Date(`${d.slice(0, 10)}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
};
const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

async function weekMeetings(monday: string, country: string) {
  const sunday = addDays(monday, 6);
  const all: any[] = await api('/meetings?when=results&limit=300');
  return all
    .filter((m) => String(m.meeting_date) >= monday && String(m.meeting_date) <= sunday && (country === 'all' || m.country === country))
    .sort((a, b) => String(a.meeting_date).localeCompare(String(b.meeting_date)) || String(a.venue).localeCompare(String(b.venue)));
}

export async function weekCheck(monday: string, country: string) {
  const ms = await weekMeetings(monday, country);
  return { monday, sunday: addDays(monday, 6), country, meetings: ms.length, races: ms.reduce((n, m) => n + (Number(m.race_count) || 0), 0) };
}

export async function weeklyReview(monday: string, country: string) {
  const sunday = addDays(monday, 6);
  const ms = await weekMeetings(monday, country);
  if (!ms.length) throw Object.assign(new Error('No resulted meetings in the racing data for that week.'), { status: 404 });
  // Winners per meeting (the search answers "winners <venue> <date>").
  const winners: any[] = [];
  const queue = [...ms];
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      for (let m = queue.shift(); m; m = queue.shift()) {
        const d = new Date(`${m.meeting_date}T12:00:00Z`);
        const q = `winners ${m.venue} ${d.getUTCDate()} ${d.toLocaleDateString('en-AU', { month: 'long', timeZone: 'UTC' })}`;
        try {
          const r = await api(`/search?q=${encodeURIComponent(q)}`);
          for (const e of r.entries || []) if (Number(e.meeting_id) === Number(m.id) && e.placing === '1') winners.push(e);
        } catch {
          // one meeting missing does not stop the review
        }
      }
    })
  );
  const count = (key: 'driver_name' | 'trainer_name') => {
    const c = new Map<string, number>();
    for (const w of winners) {
      const n = tidy(w[key]);
      if (n) c.set(n, (c.get(n) || 0) + 1);
    }
    return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const drivers = count('driver_name');
  const trainers = count('trainer_name');
  const horses = new Map<string, any[]>();
  for (const w of winners) horses.set(w.horse_name, [...(horses.get(w.horse_name) || []), w]);
  const doubles = [...horses].filter(([, ws]) => ws.length > 1);
  const where = country === 'AU' ? ' in Australia' : country === 'NZ' ? ' in New Zealand' : ' across Australia and New Zealand';
  const parts: string[] = [];
  parts.push(
    `<p>From ${esc(longDate(monday))} to ${esc(longDate(sunday))}, ${ms.length} meetings were raced${where}, with ${winners.length} winners recorded in the racing data.</p>`
  );
  parts.push('<h3>Leading drivers</h3>');
  parts.push(table(['Driver', 'Wins'], drivers.slice(0, 10)));
  parts.push('<h3>Leading trainers</h3>');
  parts.push(table(['Trainer', 'Wins'], trainers.slice(0, 10)));
  if (doubles.length) {
    parts.push('<h3>Won more than once</h3>');
    parts.push(
      `<ul>${doubles
        .map(([name, ws]) => `<li><strong>${esc(name)}</strong>: ${ws.map((w) => `${esc(w.venue)} ${esc(shortDate(w.meeting_date))}`).join(', ')}</li>`)
        .join('')}</ul>`
    );
  }
  parts.push('<h3>Meetings</h3>');
  parts.push(
    table(
      ['Date', 'Track', 'Races', 'Winners'],
      ms.map((m) => [shortDate(m.meeting_date), m.venue, m.race_count, winners.filter((w) => Number(w.meeting_id) === Number(m.id)).length])
    )
  );
  return {
    title: `The week in harness racing: ${shortDate(monday)} to ${shortDate(sunday)}`,
    html: parts.join('\n'),
    summary: { meetings: ms.length, winners: winners.length },
  };
}
