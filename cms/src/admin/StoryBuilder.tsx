import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, SingleSelect, SingleSelectOption, TextInput, Typography } from '@strapi/design-system';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { useNavigate } from 'react-router-dom';
import { NEW_STORY } from './NewStory';

// Story Builder (phase 1): "New story" opens this. Pick a template from the
// visual library (previews are real stories on this site, rendered by the
// site itself), point it at a race or meeting, check what the racing API has,
// then create the draft. The building is done by the existing code (see
// src/story-builder.ts). "Standard news story" goes straight to the editor.

type Template = {
  id: string;
  name: string;
  category: string;
  description: string;
  status: 'live' | 'development' | 'awaiting-data';
  needs: 'none' | 'race' | 'meeting';
  data: string[];
  ai: string | null;
  example: string | null;
  components: string[];
};
type MeetingRow = { id: number; date: string; venue: string; country: string; races: number };
type Summary = {
  meeting: { id: number; venue: string; date: string; country: string; races: number; timezone: string | null };
  race?: { no: number; name: string; distance: number | null; start: string | null; stakes: number | null; startTime: string | null; className: string | null };
  races?: { no: number; name: string; startTime: string | null }[];
  runners?: { no: number; horse: string; driver: string | null; odds: number | null; scratched: boolean; emergency: boolean }[];
  available: string[];
  missing: string[];
  source: string;
  checkedAt: string;
};

const NAVY = '#00205E';
const LINE = '#dcdde2';
const MUTED = '#666b76';
const STATUS: Record<Template['status'], [string, string]> = {
  live: ['Ready to use', '#1f7a3d'],
  development: ['In development', '#8a651a'],
  'awaiting-data': ['Awaiting data', '#b3202a'],
};

// The site's own render of the example story, scaled down. Same origin as the CMS.
function Thumb({ url, anchor }: { url: string | null; anchor: string }) {
  if (!url) {
    return (
      <div style={{ height: 190, display: 'grid', placeItems: 'center', background: '#f4f5f7', color: MUTED, fontSize: 13, borderBottom: `1px solid ${LINE}` }}>
        No example published yet
      </div>
    );
  }
  return (
    <div style={{ height: 190, overflow: 'hidden', position: 'relative', borderBottom: `1px solid ${LINE}`, background: '#fff' }}>
      <iframe
        title="Template preview"
        src={`${url}${anchor}`}
        loading="lazy"
        tabIndex={-1}
        style={{ width: 1280, height: 760, border: 0, transform: 'scale(0.25)', transformOrigin: '0 0', pointerEvents: 'none' }}
      />
    </div>
  );
}

function Labelled({ text, hint, children }: { text: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#32324d', marginBottom: 4 }}>{text}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 4 }}>{hint}</span>}
    </label>
  );
}

const anchorFor = (t: Template) => (t.components.includes('raceMap') ? '#race-map' : t.components.includes('runnerGuide') ? '#runner-guide' : '');

function PreviewModal({ t, onClose, onUse }: { t: Template; onClose: () => void; onUse: () => void }) {
  const [mobile, setMobile] = useState(false);
  return (
    <div role="dialog" aria-label={`${t.name} preview`} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(14,36,85,.55)', display: 'grid', placeItems: 'center', padding: 24 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', width: 'min(1320px, 100%)', height: '92vh', display: 'flex', flexDirection: 'column', border: `1px solid ${LINE}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${LINE}` }}>
          <Typography variant="delta" tag="h2" style={{ flex: 1 }}>
            {t.name}
          </Typography>
          <Button variant={mobile ? 'tertiary' : 'secondary'} onClick={() => setMobile(false)}>
            Desktop
          </Button>
          <Button variant={mobile ? 'secondary' : 'tertiary'} onClick={() => setMobile(true)}>
            Mobile
          </Button>
          {t.status === 'live' && <Button onClick={onUse}>Use this template</Button>}
          <Button variant="tertiary" onClick={onClose}>
            Close
          </Button>
        </div>
        <div style={{ flex: 1, background: '#f2f2f2', display: 'grid', justifyItems: 'center', overflow: 'hidden' }}>
          {t.example ? (
            <iframe title={`${t.name} example`} src={`${t.example}${anchorFor(t)}`} style={{ width: mobile ? 390 : '100%', height: '100%', border: 0, background: '#fff' }} />
          ) : (
            <p style={{ alignSelf: 'center', color: MUTED }}>No example published yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ t, onPreview, onUse }: { t: Template; onPreview: () => void; onUse: () => void }) {
  const [label, colour] = STATUS[t.status];
  return (
    <div style={{ background: '#fff', border: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column' }}>
      <Thumb url={t.example} anchor={anchorFor(t)} />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: MUTED }}>{t.category}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: NAVY }}>{t.name}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: colour }}>{label}</div>
        <p style={{ fontSize: 14, color: '#32324d', margin: 0 }}>{t.description}</p>
        {t.data.length > 0 && (
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
            <strong>Fills in:</strong> {t.data.join('; ')}
          </p>
        )}
        <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
          <strong>Claude:</strong> {t.ai || 'not used'}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
          <Button variant="tertiary" onClick={onPreview} disabled={!t.example}>
            Preview
          </Button>
          <Button onClick={onUse} disabled={t.status !== 'live'}>
            {t.status === 'live' ? 'Use template' : 'Coming soon'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Steps({ step }: { step: number }) {
  const names = ['Choose a template', 'Choose the race', 'Check the racing data', 'Edit and publish'];
  return (
    <ol style={{ display: 'flex', gap: 0, margin: '0 0 24px', padding: 0, listStyle: 'none', borderBottom: `1px solid ${LINE}` }}>
      {names.map((n, i) => (
        <li key={n} style={{ padding: '10px 18px 10px 0', marginRight: 18, fontSize: 14, fontWeight: i === step ? 700 : 400, color: i === step ? NAVY : MUTED, borderBottom: i === step ? `3px solid ${NAVY}` : '3px solid transparent' }}>
          {i + 1}. {n}
        </li>
      ))}
    </ol>
  );
}

export default function StoryBuilder() {
  const { get, post } = useFetchClient();
  const navigate = useNavigate();
  const { toggleNotification } = useNotification();
  const [catalogue, setCatalogue] = useState<{ categories: string[]; templates: Template[] } | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [preview, setPreview] = useState<Template | null>(null);
  const [chosen, setChosen] = useState<Template | null>(null);
  // Step 2
  const [tabLink, setTabLink] = useState('');
  const [country, setCountry] = useState('AU');
  const [meetings, setMeetings] = useState<MeetingRow[] | null>(null);
  const [meetingId, setMeetingId] = useState('');
  const [raceNumber, setRaceNumber] = useState('');
  // Step 3
  const [summary, setSummary] = useState<Summary | null>(null);
  const [title, setTitle] = useState('');
  const [claude, setClaude] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get('/hl-story-builder/templates').then(({ data }) => setCatalogue(data as any)).catch(() => setError('Could not load the templates'));
  }, [get]);

  useEffect(() => {
    if (!chosen || chosen.needs === 'none' || meetings) return;
    get<MeetingRow[]>('/hl-analysis/meetings').then(({ data }) => setMeetings(data)).catch(() => setMeetings([]));
  }, [chosen, meetings, get]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalogue?.templates || []).filter(
      (t) => (!category || t.category === category) && (!q || `${t.name} ${t.description} ${t.category}`.toLowerCase().includes(q))
    );
  }, [catalogue, query, category]);

  const today = new Date().toISOString().slice(0, 10);
  const pickable = (meetings || []).filter((m) => m.country === country && m.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.venue.localeCompare(b.venue));
  const meeting = pickable.find((m) => String(m.id) === meetingId) || (meetings || []).find((m) => String(m.id) === meetingId);

  const use = (t: Template) => {
    setPreview(null);
    if (t.id === 'standard') {
      navigate(NEW_STORY);
      return;
    }
    setChosen(t);
    setSummary(null);
    setError(null);
  };

  const pick = () => (tabLink.trim() ? { tabLink: tabLink.trim() } : { meetingId: Number(meetingId), raceNumber: Number(raceNumber) || undefined });

  const check = async () => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await post<Summary>('/hl-story-builder/check', { template: chosen.id, ...pick() });
      setSummary(data);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Could not reach the racing data');
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!chosen || !summary) return;
    setBusy(true);
    try {
      const sel = tabLink.trim() ? { tabLink: tabLink.trim() } : { meetingId: summary.meeting.id, raceNumber: summary.race?.no };
      const { data } = await post<{ documentId: string; editor: string }>('/hl-story-builder/stories', { template: chosen.id, ...sel, title, claude });
      toggleNotification({ type: 'success', message: claude ? 'Draft created. Claude is writing; reload the story in a minute or two.' : 'Draft created from the racing data.' });
      navigate(data.editor);
    } catch (e: any) {
      toggleNotification({ type: 'danger', message: e?.response?.data?.error?.message || 'Could not create the story' });
      setBusy(false);
    }
  };

  const ready = tabLink.trim() || (meetingId && (chosen?.needs === 'meeting' || raceNumber));

  return (
    <div style={{ padding: '32px 40px', background: '#fff', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 6 }}>
        <Typography variant="alpha" tag="h1" style={{ color: NAVY }}>
          New story
        </Typography>
        <Button variant="tertiary" onClick={() => navigate(NEW_STORY)}>
          Skip: write a standard news story
        </Button>
      </div>
      <p style={{ color: MUTED, margin: '0 0 20px' }}>Choose what you are writing. Race formats fill themselves from TAB; everything stays editable.</p>

      <Steps step={!chosen ? 0 : !summary ? 1 : 2} />

      {!chosen && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
            <div style={{ width: 320 }}>
              <TextInput aria-label="Search templates" placeholder="Search templates" value={query} onChange={(e: any) => setQuery(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['', ...(catalogue?.categories || [])].map((c) => (
                <button
                  key={c || 'all'}
                  type="button"
                  onClick={() => setCategory(c)}
                  style={{ padding: '8px 12px', border: `1px solid ${c === category ? NAVY : LINE}`, background: c === category ? NAVY : '#fff', color: c === category ? '#fff' : '#32324d', fontSize: 13, cursor: 'pointer' }}
                >
                  {c || 'All templates'}
                </button>
              ))}
            </div>
          </div>
          {error && <p style={{ color: '#b3202a' }}>{error}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {shown.map((t) => (
              <Card key={t.id} t={t} onPreview={() => setPreview(t)} onUse={() => use(t)} />
            ))}
          </div>
          {catalogue && !shown.length && <p style={{ color: MUTED }}>No templates match.</p>}
        </>
      )}

      {chosen && (
        <div style={{ maxWidth: 880 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
            <Typography variant="beta" tag="h2" style={{ color: NAVY }}>
              {chosen.name}
            </Typography>
            <Button
              variant="tertiary"
              onClick={() => {
                setChosen(null);
                setSummary(null);
              }}
            >
              Change template
            </Button>
          </div>

          {!summary && (
            <div style={{ display: 'grid', gap: 18, border: `1px solid ${LINE}`, padding: 20 }}>
              <div>
                <Labelled text={`Paste the TAB link to the ${chosen.needs === 'race' ? 'race' : 'meeting (any race at it)'}`} hint="tab.com.au or tab.co.nz. Or choose below.">
                  <TextInput
                    aria-label="TAB link"
                    placeholder="https://www.tab.com.au/racing/…"
                    value={tabLink}
                    onChange={(e: any) => setTabLink(e.target.value)}
                  />
                </Labelled>
              </div>
              <div style={{ color: MUTED, fontSize: 13 }}>or</div>
              <div style={{ display: 'grid', gridTemplateColumns: chosen.needs === 'race' ? '140px 1fr 140px' : '140px 1fr', gap: 12 }}>
                <Labelled text="Country"><SingleSelect aria-label="Country" value={country} onChange={(v: any) => { setCountry(String(v)); setMeetingId(''); setRaceNumber(''); }} disabled={!!tabLink.trim()}>
                  <SingleSelectOption value="AU">Australia</SingleSelectOption>
                  <SingleSelectOption value="NZ">New Zealand</SingleSelectOption>
                </SingleSelect></Labelled>
                <Labelled text="Meeting"><SingleSelect
                  aria-label="Meeting"
                  placeholder={meetings ? (pickable.length ? 'Choose a meeting' : 'No upcoming meetings in the racing data') : 'Loading meetings…'}
                  value={meetingId}
                  onChange={(v: any) => { setMeetingId(String(v)); setRaceNumber(''); }}
                  disabled={!!tabLink.trim() || !pickable.length}
                >
                  {pickable.map((m) => (
                    <SingleSelectOption key={m.id} value={String(m.id)}>
                      {`${m.venue}, ${new Date(`${m.date}T12:00:00Z`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })} (${m.races} races)`}
                    </SingleSelectOption>
                  ))}
                </SingleSelect></Labelled>
                {chosen.needs === 'race' && (
                  <Labelled text="Race"><SingleSelect aria-label="Race" placeholder="Race" value={raceNumber} onChange={(v: any) => setRaceNumber(String(v))} disabled={!!tabLink.trim() || !meeting}>
                    {Array.from({ length: meeting?.races || 0 }, (_, i) => (
                      <SingleSelectOption key={i + 1} value={String(i + 1)}>{`Race ${i + 1}`}</SingleSelectOption>
                    ))}
                  </SingleSelect></Labelled>
                )}
              </div>
              {error && <p style={{ color: '#b3202a', margin: 0 }}>{error}</p>}
              <div>
                <Button onClick={check} loading={busy} disabled={!ready}>
                  Check the racing data
                </Button>
              </div>
            </div>
          )}

          {summary && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{ border: `1px solid ${LINE}`, borderTop: `3px solid ${NAVY}`, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: MUTED }}>
                  {summary.meeting.venue}, {new Date(`${summary.meeting.date}T12:00:00Z`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: NAVY, margin: '4px 0 8px' }}>
                  {summary.race ? `Race ${summary.race.no}: ${summary.race.name}` : `${summary.meeting.races} races`}
                </div>
                {summary.race && (
                  <p style={{ margin: '0 0 12px', color: MUTED }}>
                    {[summary.race.distance && `${summary.race.distance}m`, summary.race.start && `${summary.race.start} start`, summary.race.stakes && `$${summary.race.stakes.toLocaleString('en-AU')}`, summary.race.className]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Found</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {summary.available.map((a) => (
                        <li key={a} style={{ color: '#1f7a3d' }}>
                          <span style={{ color: '#32324d' }}>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Missing or for you to add</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {summary.missing.map((a) => (
                        <li key={a} style={{ color: '#8a651a' }}>
                          <span style={{ color: '#32324d' }}>{a}</span>
                        </li>
                      ))}
                      {!summary.missing.length && <li>Nothing</li>}
                    </ul>
                  </div>
                </div>
                {summary.runners && (
                  <p style={{ margin: '14px 0 0', fontSize: 13, color: MUTED }}>
                    {summary.runners.map((r) => `${r.no} ${r.horse}${r.scratched ? ' (scr)' : r.emergency ? ' (emg)' : ''}`).join(' · ')}
                  </p>
                )}
                <p style={{ margin: '14px 0 0', fontSize: 12, color: MUTED }}>
                  Source: {summary.source}. Checked {new Date(summary.checkedAt).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })}.{' '}
                  <button type="button" onClick={check} style={{ border: 0, background: 'none', color: NAVY, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
                    Refresh
                  </button>{' '}
                  ·{' '}
                  <button type="button" onClick={() => setSummary(null)} style={{ border: 0, background: 'none', color: NAVY, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
                    Choose a different race
                  </button>
                </p>
              </div>

              {chosen.needs === 'race' && (
                <Labelled text="Headline (optional)" hint="Leave empty for one from the race name. You can change it in the editor.">
                  <TextInput aria-label="Headline" value={title} onChange={(e: any) => setTitle(e.target.value)} />
                </Labelled>
              )}
              {chosen.ai && chosen.needs === 'race' && (
                <Checkbox checked={claude} onCheckedChange={(v: any) => setClaude(!!v)}>
                  Have Claude draft it ({chosen.ai.toLowerCase()}). Check everything before publishing.
                </Checkbox>
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                <Button onClick={create} loading={busy}>
                  Create the draft
                </Button>
                <Button variant="tertiary" onClick={() => setSummary(null)}>
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {preview && <PreviewModal t={preview} onClose={() => setPreview(null)} onUse={() => use(preview)} />}
    </div>
  );
}
