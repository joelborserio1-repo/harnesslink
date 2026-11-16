import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Flex, SingleSelect, SingleSelectOption, Textarea, TextInput, Typography } from '@strapi/design-system';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { Link, useLocation, useNavigate } from 'react-router-dom';

// "Race analysis" in the left menu (src/race-analysis.ts).
//   /race-analysis               meetings from the racing API (TAB data):
//                                start an analysis story or open one
//   /race-analysis/:documentId   the analyst's tips, comments, best bet and
//                                value, and speed maps for that story
// The story itself (headline, intro, photo, publishing) is edited as usual.

type Entry = { no: number; horse: string; driver: string | null; trainer: string | null; silk: string | null; win: number | null; scratched: boolean; emergency: boolean; form: string | null; placing: string | null };
type Race = { id: number; no: number; name: string; distance: number | null; start: string | null; startTime: string | null; entries: Entry[] };
type Meeting = { id: number; date: string; venue: string; country: string; timezone: string; races: Race[]; pulledAt: string };
type Notes = { picks: { no: number; comment: string }[]; note?: string; map?: { rail: number[]; outside: number[]; three?: number[] } | null };
type Analysis = { meeting: Meeting; notes: Record<string, Notes>; bestBet?: { race: number; no: number } | null; bestValue?: { race: number; no: number } | null };
type MeetingRow = { id: number; date: string; venue: string; country: string; races: number; trackCondition: string | null; story: { documentId: string; title: string; published: boolean } | null };

function Labelled({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#32324d', marginBottom: 4 }}>{text}</span>
      {children}
    </label>
  );
}

const silk = (p: string | null) => (p ? `https://api.beta.tab.com.au${p}` : '');
const money = (n: number | null) => (n && n > 1 ? `$${n.toFixed(2)}` : '–');
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const cell: React.CSSProperties = { padding: '7px 8px', borderBottom: '1px solid #eaeaef', fontSize: 13, verticalAlign: 'middle' };
const head: React.CSSProperties = { ...cell, fontWeight: 600, color: '#666687', borderBottom: '1px solid #c0c0cf', textAlign: 'left' };
const panel: React.CSSProperties = { border: '1px solid #dcdce4', background: '#fff' };

export default function RaceAnalysisEditor() {
  const { pathname } = useLocation();
  const id = pathname.split('/race-analysis/')[1]?.split('/')[0];
  return <Box padding={10} background="neutral100" style={{ minHeight: '100vh' }}>{id ? <Editor documentId={id} /> : <Meetings />}</Box>;
}

// ---------- meetings ----------

function Meetings() {
  const { get, post } = useFetchClient();
  const navigate = useNavigate();
  const { toggleNotification } = useNotification();
  const [rows, setRows] = useState<MeetingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState('NZ');
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    get<MeetingRow[]>('/hl-analysis/meetings')
      .then(({ data }) => setRows(data))
      .catch((e) => setError(e?.response?.data?.error?.message || 'Could not reach the racing API'));
  }, [get]);

  const start = async (m: MeetingRow) => {
    setBusy(m.id);
    try {
      const { data } = await post<{ documentId: string }>('/hl-analysis/stories', { meetingId: m.id });
      toggleNotification({ type: 'success', message: `Draft story created with ${m.races} races from TAB` });
      navigate(`/race-analysis/${data.documentId}`);
    } catch (e: any) {
      toggleNotification({ type: 'danger', message: e?.response?.data?.error?.message || 'Could not create the story' });
    } finally {
      setBusy(null);
    }
  };

  const shown = (rows || []).filter((r) => country === 'all' || r.country === country);
  return (
    <>
      <Flex justifyContent="space-between" alignItems="flex-end" paddingBottom={6} wrap="wrap" gap={4}>
        <Box>
          <Typography variant="alpha" tag="h1">
            Race analysis
          </Typography>
          <Box paddingTop={1}>
            <Typography textColor="neutral600">
              Pick a meeting to start a Harness Analyst story. Fields, form, silks and TAB prices come in automatically; you add the tips, comments and speed maps.
            </Typography>
          </Box>
        </Box>
        <Box style={{ width: 200 }}>
          <SingleSelect aria-label="Country" value={country} onChange={(v: string | number) => setCountry(String(v))}>
            <SingleSelectOption value="NZ">New Zealand</SingleSelectOption>
            <SingleSelectOption value="AU">Australia</SingleSelectOption>
            <SingleSelectOption value="all">All meetings</SingleSelectOption>
          </SingleSelect>
        </Box>
      </Flex>
      {error && <Typography textColor="danger600">{error}</Typography>}
      {!rows && !error && <Typography textColor="neutral600">Loading meetings…</Typography>}
      {rows && (
        <Box style={panel} padding={4}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={head}>Date</th>
                <th style={head}>Meeting</th>
                <th style={head}>Races</th>
                <th style={head}>Track</th>
                <th style={head}>Analysis story</th>
                <th style={head} />
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.id}>
                  <td style={cell}>{day(m.date)}</td>
                  <td style={{ ...cell, fontWeight: 600 }}>
                    {m.venue} <span style={{ color: '#8e8ea9', fontWeight: 400 }}>{m.country}</span>
                  </td>
                  <td style={cell}>{m.races}</td>
                  <td style={cell}>{m.trackCondition || '–'}</td>
                  <td style={cell}>{m.story ? `${m.story.title}${m.story.published ? '' : ' (draft)'}` : '–'}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>
                    {m.story ? (
                      <Button variant="secondary" size="S" onClick={() => navigate(`/race-analysis/${m.story!.documentId}`)}>
                        Open
                      </Button>
                    ) : (
                      <Button size="S" loading={busy === m.id} onClick={() => start(m)}>
                        Start analysis
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <Typography textColor="neutral600">No meetings in the last week or coming up.</Typography>}
        </Box>
      )}
    </>
  );
}

// ---------- one story ----------

// "Race 1" / "R1" headings, then lines like "Little Spike (8) Has a great record…";
// "Best Bet: R12 Arose" and "Best Value: R6 Life Less Ordinary". The old site's format.
function parseTips(text: string, meeting: Meeting) {
  const notes: Record<string, Notes> = {};
  let race: Race | undefined;
  let best: Analysis['bestBet'] = null;
  let value: Analysis['bestValue'] = null;
  const unmatched: string[] = [];
  const findHorse = (r: Race | undefined, name: string) => r?.entries.find((e) => e.horse.toLowerCase().replace(/[^a-z0-9]/g, '') === name.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/ /g, ' ').trim();
    if (!line) continue;
    const bb = line.match(/^best\s*(bet|value)\s*:?\s*R(?:ace)?\s*(\d+)\s+(.+)$/i);
    if (bb) {
      const r = meeting.races.find((x) => x.no === Number(bb[2]));
      const e = findHorse(r, bb[3].replace(/\(\d+\)/, '').trim());
      if (r && e) (bb[1].toLowerCase() === 'bet' ? (best = { race: r.no, no: e.no }) : (value = { race: r.no, no: e.no }));
      else unmatched.push(line);
      continue;
    }
    const rh = line.match(/^(?:race|r)\s*(\d+)\b\s*[:.\-–]?\s*$/i);
    if (rh) {
      race = meeting.races.find((x) => x.no === Number(rh[1]));
      continue;
    }
    const tip = line.match(/^(.+?)\s*\((\d+)\)\s*[:.\-–]?\s*(.*)$/);
    if (tip && race) {
      const no = Number(tip[2]);
      const e = race.entries.find((x) => x.no === no) || findHorse(race, tip[1]);
      if (e) {
        const n = (notes[race.id] ||= { picks: [] });
        if (!n.picks.some((p) => p.no === e.no)) n.picks.push({ no: e.no, comment: tip[3].trim() });
        continue;
      }
    }
    if (race && notes[race.id]?.picks.length) {
      // A comment that wrapped onto the next line.
      const last = notes[race.id].picks[notes[race.id].picks.length - 1];
      if (line.length < 60 && !/[.!?]$/.test(last.comment)) {
        last.comment = `${last.comment} ${line}`.trim();
        continue;
      }
    }
    if (race) unmatched.push(line);
  }
  return { notes, best, value, unmatched };
}

const parseList = (s: string) =>
  s
    .split(/[\s,]+/)
    .map((x) => Number(x))
    .filter((n) => n > 0);

function Editor({ documentId }: { documentId: string }) {
  const { get, put } = useFetchClient();
  const navigate = useNavigate();
  const { toggleNotification } = useNotification();
  const [story, setStory] = useState<{ title: string; slug: string; published: boolean } | null>(null);
  const [a, setA] = useState<Analysis | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paste, setPaste] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<any>(`/hl-analysis/stories/${documentId}`)
      .then(({ data }) => {
        setStory({ title: data.title, slug: data.slug, published: data.published });
        if (data.raceAnalysis?.meeting) setA({ notes: {}, ...data.raceAnalysis });
        else setError('This story has no meeting attached. Start one from the Race analysis list.');
      })
      .catch(() => setError('Could not load the story'));
  }, [get, documentId]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const change = (fn: (x: Analysis) => Analysis) => {
    setA((x) => (x ? fn(structuredClone(x)) : x));
    setDirty(true);
  };
  const setNotes = (raceId: number, fn: (n: Notes) => Notes) => change((x) => ({ ...x, notes: { ...x.notes, [raceId]: fn(x.notes[raceId] || { picks: [] }) } }));

  const save = async () => {
    if (!a) return;
    setSaving(true);
    try {
      await put(`/hl-analysis/stories/${documentId}`, { raceAnalysis: a });
      setDirty(false);
      toggleNotification({ type: 'success', message: story?.published ? 'Saved to the draft. Publish the story to put it live.' : 'Saved' });
    } catch {
      toggleNotification({ type: 'danger', message: 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  const refresh = async () => {
    if (!a) return;
    setRefreshing(true);
    try {
      const { data } = await get<Meeting>(`/hl-analysis/meetings/${a.meeting.id}`);
      change((x) => ({ ...x, meeting: data }));
      toggleNotification({ type: 'success', message: 'Fields, prices and scratchings refreshed from TAB. Save to keep them.' });
    } catch {
      toggleNotification({ type: 'danger', message: 'Could not reach the racing API' });
    } finally {
      setRefreshing(false);
    }
  };

  const applyPaste = () => {
    if (!a) return;
    const r = parseTips(paste, a.meeting);
    const n = Object.values(r.notes).reduce((t, x) => t + x.picks.length, 0);
    change((x) => ({ ...x, notes: { ...x.notes, ...Object.fromEntries(Object.entries(r.notes).map(([k, v]) => [k, { ...(x.notes[k] || {}), picks: v.picks }])) }, bestBet: r.best || x.bestBet, bestValue: r.value || x.bestValue }));
    toggleNotification({
      type: r.unmatched.length ? 'warning' : 'success',
      message: `${n} tips placed in ${Object.keys(r.notes).length} races${r.unmatched.length ? `. Not matched: ${r.unmatched.slice(0, 3).join(' | ')}` : ''}`,
    });
    if (n) setPaste('');
  };

  if (error) return <Typography textColor="danger600">{error}</Typography>;
  if (!a || !story) return <Typography textColor="neutral600">Loading…</Typography>;

  const m = a.meeting;
  const raceOptions = m.races.map((r) => ({ value: r.no, label: `Race ${r.no}` }));
  const bestPicker = (label: string, key: 'bestBet' | 'bestValue') => {
    const sel = a[key];
    const race = m.races.find((r) => r.no === sel?.race);
    return (
      <Flex gap={2} alignItems="flex-end">
        <Box style={{ width: 120 }}>
          <Labelled text={label}>
          <SingleSelect aria-label={`${label} race`} placeholder="Race" value={sel?.race ?? ''} onClear={() => change((x) => ({ ...x, [key]: null }))} onChange={(v: string | number) => change((x) => ({ ...x, [key]: { race: Number(v), no: 0 } }))}>
            {raceOptions.map((o) => (
              <SingleSelectOption key={o.value} value={o.value}>
                {o.label}
              </SingleSelectOption>
            ))}
          </SingleSelect>
          </Labelled>
        </Box>
        <Box style={{ width: 240 }}>
          <SingleSelect aria-label={`${label} horse`} placeholder="Horse" disabled={!race} value={sel?.no || ''} onChange={(v: string | number) => change((x) => ({ ...x, [key]: { race: sel!.race, no: Number(v) } }))}>
            {(race?.entries || []).map((e) => (
              <SingleSelectOption key={e.no} value={e.no}>
                {`${e.no}. ${e.horse}`}
              </SingleSelectOption>
            ))}
          </SingleSelect>
        </Box>
      </Flex>
    );
  };

  return (
    <>
      <Flex justifyContent="space-between" alignItems="flex-start" paddingBottom={4} gap={4} wrap="wrap">
        <Box>
          <Link to="/race-analysis" style={{ fontSize: 13, color: '#4945ff' }}>
            ← All meetings
          </Link>
          <Typography variant="alpha" tag="h1">
            {m.venue}, {day(m.date)}
          </Typography>
          <Typography textColor="neutral600">
            {story.title} · {m.races.length} races · fields pulled {new Date(m.pulledAt).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
          </Typography>
        </Box>
        <Flex gap={2} wrap="wrap">
          <Button variant="tertiary" onClick={() => navigate(`/content-manager/collection-types/api::article.article/${documentId}`)}>
            Story text &amp; publishing
          </Button>
          {story.published && (
            <Button variant="tertiary" onClick={() => window.open(`/${story.slug}/`, '_blank')}>
              View on site
            </Button>
          )}
          <Button variant="secondary" loading={refreshing} onClick={refresh}>
            Refresh from TAB
          </Button>
          <Button loading={saving} disabled={!dirty} onClick={save}>
            {dirty ? 'Save' : 'Saved'}
          </Button>
        </Flex>
      </Flex>

      <Flex gap={6} alignItems="flex-start" wrap="wrap" paddingBottom={6}>
        <Box style={{ ...panel, flex: '1 1 420px' }} padding={5}>
          <Typography variant="delta" tag="h2">
            Best bet and best value
          </Typography>
          <Flex direction="column" alignItems="stretch" gap={3} paddingTop={3}>
            {bestPicker('Best bet', 'bestBet')}
            {bestPicker('Best value', 'bestValue')}
          </Flex>
        </Box>
        <Box style={{ ...panel, flex: '1 1 420px' }} padding={5}>
          <Typography variant="delta" tag="h2">
            Paste tips
          </Typography>
          <Box paddingTop={1} paddingBottom={2}>
            <Typography variant="pi" textColor="neutral600">
              Paste the analyst&rsquo;s copy: &ldquo;Race 1&rdquo; headings, then one line per horse like &ldquo;Little Spike (8) Has a great record…&rdquo;, plus &ldquo;Best Bet: R12 Arose&rdquo;. Tips are matched to the field by number.
            </Typography>
          </Box>
          <Textarea aria-label="Paste tips" value={paste} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPaste(e.target.value)} style={{ minHeight: 90 }} />
          <Box paddingTop={2}>
            <Button variant="secondary" disabled={!paste.trim()} onClick={applyPaste}>
              Place tips
            </Button>
          </Box>
        </Box>
      </Flex>

      {m.races.map((r) => (
        <RaceEditor key={r.id} race={r} tz={m.timezone} notes={a.notes[r.id] || { picks: [] }} onChange={(fn) => setNotes(r.id, fn)} />
      ))}

      <Flex justifyContent="flex-end" paddingTop={4}>
        <Button loading={saving} disabled={!dirty} onClick={save}>
          {dirty ? 'Save' : 'Saved'}
        </Button>
      </Flex>
    </>
  );
}

function RaceEditor({ race, tz, notes, onChange }: { race: Race; tz: string; notes: Notes; onChange: (fn: (n: Notes) => Notes) => void }) {
  const byNo = useMemo(() => new Map(race.entries.map((e) => [e.no, e])), [race]);
  const starters = race.entries.filter((e) => !e.scratched && !e.emergency);
  const [rail, setRail] = useState((notes.map?.rail || []).join(', '));
  const [outside, setOutside] = useState((notes.map?.outside || []).join(', '));
  const [three, setThree] = useState((notes.map?.three || []).join(', '));
  const time = race.startTime ? new Date(race.startTime).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit', timeZone: tz }) : '';

  const pickIndex = (no: number) => notes.picks.findIndex((p) => p.no === no);
  const togglePick = (no: number) =>
    onChange((n) => {
      const i = n.picks.findIndex((p) => p.no === no);
      return { ...n, picks: i >= 0 ? n.picks.filter((p) => p.no !== no) : [...n.picks, { no, comment: '' }].slice(0, 4) };
    });
  const move = (i: number, d: -1 | 1) =>
    onChange((n) => {
      const p = [...n.picks];
      const j = i + d;
      if (j < 0 || j >= p.length) return n;
      [p[i], p[j]] = [p[j], p[i]];
      return { ...n, picks: p };
    });
  const suggest = () =>
    onChange((n) => ({
      ...n,
      picks: [...starters]
        .filter((e) => e.win)
        .sort((x, y) => (x.win || 99) - (y.win || 99))
        .slice(0, 3)
        .map((e) => ({ no: e.no, comment: n.picks.find((p) => p.no === e.no)?.comment || '' })),
    }));

  const mapProblem = (() => {
    const all = [...parseList(rail), ...parseList(outside), ...parseList(three)];
    if (!all.length) return null;
    const bad = all.filter((no) => !byNo.has(no));
    if (bad.length) return `Not in this field: ${bad.join(', ')}`;
    const dup = all.filter((no, i) => all.indexOf(no) !== i);
    if (dup.length) return `Listed twice: ${[...new Set(dup)].join(', ')}`;
    const missing = starters.filter((e) => !all.includes(e.no)).map((e) => e.no);
    return missing.length ? `Not placed yet: ${missing.join(', ')}` : null;
  })();
  const saveMap = () =>
    onChange((n) => {
      const r = parseList(rail);
      const o = parseList(outside);
      const t = parseList(three);
      return { ...n, map: r.length || o.length ? { rail: r, outside: o, three: t } : null };
    });

  return (
    <Box style={panel} padding={5} marginBottom={5}>
      <Flex justifyContent="space-between" alignItems="baseline" wrap="wrap" gap={2}>
        <Typography variant="beta" tag="h2">
          Race {race.no} <span style={{ fontWeight: 400, fontSize: 15, color: '#666687' }}>{time} · {race.name} · {race.distance}m</span>
        </Typography>
        <Button variant="tertiary" size="S" onClick={suggest}>
          Suggest top 3 from the market
        </Button>
      </Flex>

      <Flex gap={6} alignItems="flex-start" wrap="wrap" paddingTop={3}>
        <Box style={{ flex: '1 1 460px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={head}>No.</th>
                <th style={head} />
                <th style={head}>Horse</th>
                <th style={head}>Driver</th>
                <th style={head}>Form</th>
                <th style={{ ...head, textAlign: 'right' }}>Win</th>
                <th style={head} />
              </tr>
            </thead>
            <tbody>
              {race.entries.map((e) => {
                const i = pickIndex(e.no);
                return (
                  <tr key={e.no} style={{ background: i >= 0 ? '#f0f0ff' : undefined, opacity: e.scratched ? 0.45 : 1 }}>
                    <td style={{ ...cell, fontWeight: 700 }}>{e.no}</td>
                    <td style={{ ...cell, padding: 2 }}>{e.silk && <img src={silk(e.silk)} alt="" width={22} height={26} style={{ display: 'block' }} />}</td>
                    <td style={{ ...cell, fontWeight: 600 }}>
                      {e.horse}
                      {e.scratched && <span style={{ color: '#d02b20', fontSize: 11, marginLeft: 6 }}>SCR</span>}
                    </td>
                    <td style={cell}>{e.driver}</td>
                    <td style={cell}>{e.form || '–'}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{money(e.win)}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>
                      <Button size="S" variant={i >= 0 ? 'default' : 'tertiary'} onClick={() => togglePick(e.no)} disabled={e.scratched && i < 0}>
                        {i >= 0 ? `Tip ${i + 1}` : 'Tip'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Box>

        <Flex direction="column" alignItems="stretch" gap={3} style={{ flex: '1 1 380px' }}>
          {notes.picks.length === 0 && <Typography textColor="neutral600">No tips yet. Click Tip next to a horse, or paste tips above.</Typography>}
          {notes.picks.map((p, i) => {
            const e = byNo.get(p.no);
            return (
              <Box key={p.no} style={{ borderLeft: '3px solid #00205E', paddingLeft: 10 }}>
                <Flex justifyContent="space-between" alignItems="center">
                  <Typography fontWeight="bold">
                    {i + 1}. {e?.horse || `No. ${p.no}`} ({p.no})
                  </Typography>
                  <Flex gap={1}>
                    <Button size="S" variant="tertiary" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                      ↑
                    </Button>
                    <Button size="S" variant="tertiary" disabled={i === notes.picks.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                      ↓
                    </Button>
                    <Button size="S" variant="danger-light" onClick={() => togglePick(p.no)}>
                      Remove
                    </Button>
                  </Flex>
                </Flex>
                <Box paddingTop={1}>
                  <Textarea
                    aria-label={`Comment on ${e?.horse}`}
                    placeholder="Why this horse"
                    value={p.comment}
                    onChange={(ev: React.ChangeEvent<HTMLTextAreaElement>) => {
                      const v = ev.target.value;
                      onChange((n) => ({ ...n, picks: n.picks.map((x) => (x.no === p.no ? { ...x, comment: v } : x)) }));
                    }}
                  />
                </Box>
              </Box>
            );
          })}

          <Box paddingTop={2}>
            <Typography variant="sigma" textColor="neutral600">
              Speed map (numbers, leader first)
            </Typography>
            <Flex direction="column" alignItems="stretch" gap={2} paddingTop={2}>
              <Labelled text="Rail"><TextInput aria-label="Rail" placeholder="e.g. 1, 3, 2, 7" value={rail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRail(e.target.value)} onBlur={saveMap} /></Labelled>
              <Labelled text="Outside (death seat first)"><TextInput aria-label="Outside (death seat first)" placeholder="e.g. 5, 6, 8" value={outside} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOutside(e.target.value)} onBlur={saveMap} /></Labelled>
              <Labelled text="Three wide (optional)"><TextInput aria-label="Three wide (optional)" value={three} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setThree(e.target.value)} onBlur={saveMap} /></Labelled>
              <Typography variant="pi" textColor={mapProblem ? 'danger600' : 'neutral600'}>
                {mapProblem || (notes.map ? 'Readers see this map first and can rearrange it.' : 'Leave empty and readers get a blank map to build themselves.')}
              </Typography>
            </Flex>
          </Box>
          <TextInput
            aria-label="Race note (optional)"
            placeholder="Race note (optional)"
            value={notes.note || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const v = e.target.value;
              onChange((n) => ({ ...n, note: v }));
            }}
          />
        </Flex>
      </Flex>
    </Box>
  );
}
