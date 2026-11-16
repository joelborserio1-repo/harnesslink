// Race-night weather at the track (Open-Meteo, via the CMS: cms/src/race-analysis.ts),
// read at the first race. Icons are drawn here; nothing is loaded from elsewhere.

export type Weather = {
  place: string;
  past: boolean;
  hour: string | null;
  temp: number | null;
  feels: number | null;
  code: number | null;
  humidity: number | null;
  rainChance: number | null;
  wind: number | null;
  gusts: number | null;
  windFrom: number | null;
  max: number | null;
  min: number | null;
  dayCode: number | null;
  rainDay: number | null;
  rainMeeting: number | null;
  sunset: string | null;
} | null;

type Sky = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "showers" | "storm" | "snow";
function skyOf(code: number | null): Sky {
  if (code == null || code === 0) return "clear";
  if (code <= 2) return "partly";
  if (code === 3) return "cloudy";
  if (code <= 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "showers";
  return "storm";
}
const SKY_NAME: Record<Sky, string> = {
  clear: "Fine",
  partly: "Partly cloudy",
  cloudy: "Cloudy",
  fog: "Fog",
  drizzle: "Drizzle",
  rain: "Rain",
  showers: "Showers",
  storm: "Thunderstorms",
  snow: "Snow",
};
const compass = (deg: number | null) => (deg == null ? "" : ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(deg / 22.5) % 16]);
const r0 = (n: number | null) => (n == null ? "–" : String(Math.round(n)));

// Track condition from the racing feed, or a guess from the rain when there isn't one.
function going(w: NonNullable<Weather>, condition: string | null) {
  if (condition) return condition;
  const mm = (w.rainDay || 0) + (w.rainMeeting || 0);
  return mm > 8 ? "Likely slow or heavy" : mm > 2 ? "Possibly easy or good" : null;
}

export function SkyIcon({ code, size = 56 }: { code: number | null; size?: number }) {
  const sky = skyOf(code);
  const sun = (
    <g>
      <circle cx="24" cy="22" r="9" fill="#f6b51b" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return <line key={i} x1={24 + Math.cos(a) * 13} y1={22 + Math.sin(a) * 13} x2={24 + Math.cos(a) * 17} y2={22 + Math.sin(a) * 17} stroke="#f6b51b" strokeWidth="2.5" strokeLinecap="round" />;
      })}
    </g>
  );
  const cloud = (fill: string, dx = 0, dy = 0) => (
    <path transform={`translate(${dx} ${dy})`} d="M18 44 h28 a9 9 0 0 0 0 -18 a12 12 0 0 0 -23 -3 a8 8 0 0 0 -5 21 z" fill={fill} stroke="#7d8594" strokeWidth="1.2" />
  );
  const drops = (n: number, heavy: boolean) =>
    Array.from({ length: n }, (_, i) => <line key={i} x1={22 + i * 8} y1={48} x2={19 + i * 8} y2={heavy ? 58 : 54} stroke="#1f5fd1" strokeWidth="2.4" strokeLinecap="round" />);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={SKY_NAME[sky]}>
      {sky === "clear" && <g transform="translate(8 10)">{sun}</g>}
      {sky === "partly" && (
        <>
          <g transform="translate(-2 -4)">{sun}</g>
          {cloud("#fff", 4, 6)}
        </>
      )}
      {sky === "cloudy" && (
        <>
          {cloud("#dfe3ea", -6, -6)}
          {cloud("#fff", 4, 4)}
        </>
      )}
      {sky === "fog" && [26, 34, 42, 50].map((y) => <line key={y} x1="10" x2="54" y1={y} y2={y} stroke="#9aa0a8" strokeWidth="3" strokeLinecap="round" />)}
      {(sky === "drizzle" || sky === "rain" || sky === "showers") && (
        <>
          {sky === "showers" && <g transform="translate(-4 -8)">{sun}</g>}
          {cloud("#eef1f5", 0, -4)}
          {drops(sky === "drizzle" ? 3 : 4, sky === "rain")}
        </>
      )}
      {sky === "storm" && (
        <>
          {cloud("#c9ced8", 0, -4)}
          <path d="M33 42 l-6 10 h6 l-4 10 l11 -14 h-6 l4 -6 z" fill="#f6b51b" />
        </>
      )}
      {sky === "snow" && (
        <>
          {cloud("#fff", 0, -4)}
          {[22, 32, 42].map((x) => <circle key={x} cx={x} cy={52} r={2.5} fill="#7ec3ef" />)}
        </>
      )}
    </svg>
  );
}

function WindRose({ from, speed }: { from: number | null; speed: number | null }) {
  // The arrow shows where the wind is blowing to.
  const to = ((from ?? 0) + 180) % 360;
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" role="img" aria-label={`Wind from the ${compass(from)} at ${r0(speed)} km/h`}>
      <circle cx="32" cy="32" r="26" fill="#fff" stroke="#c9ced8" strokeWidth="1.5" />
      {["N", "E", "S", "W"].map((d, i) => {
        const a = (i * Math.PI) / 2 - Math.PI / 2;
        return (
          <text key={d} x={32 + Math.cos(a) * 19} y={32 + Math.sin(a) * 19 + 3.5} textAnchor="middle" fontSize="8" fontWeight="700" fill="#8d94a6">
            {d}
          </text>
        );
      })}
      {from != null && (
        <g transform={`rotate(${to} 32 32)`}>
          <path d="M32 12 L37 24 L33.5 22.5 L33.5 48 L30.5 48 L30.5 22.5 L27 24 Z" fill="#1a7a4a" />
        </g>
      )}
    </svg>
  );
}

const Icon = {
  thermo: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M10 4a2 2 0 1 1 4 0v9.3a4 4 0 1 1-4 0z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="17" r="2" fill="#d0491c" />
    </svg>
  ),
  drop: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M12 3c3 4.5 6 7.8 6 11a6 6 0 0 1-12 0c0-3.2 3-6.5 6-11z" fill="#7ec3ef" stroke="#1f5fd1" strokeWidth="1.5" />
    </svg>
  ),
  track: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <rect x="2.5" y="6" width="19" height="12" rx="6" fill="none" stroke="#a8875a" strokeWidth="3" />
    </svg>
  ),
  sunset: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M5 17a7 7 0 0 1 14 0" fill="#f6b51b" />
      <line x1="2" y1="19" x2="22" y2="19" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
};

export default function RaceWeather({ weather, firstRace, condition }: { weather: Weather; firstRace: string | null; condition: string | null }) {
  if (!weather) return null;
  const w = weather;
  const g = going(w, condition);
  const sunset = w.sunset ? w.sunset.slice(11, 16) : null;
  return (
    <section className="rw" aria-label="Race-night weather">
      <div className="rw-now">
        <SkyIcon code={w.code} />
        <div>
          <p className="rw-label">{w.past ? "Weather at the races" : "Race-day forecast"}{firstRace ? ` · ${firstRace}` : ""}</p>
          <p className="rw-temp">
            {r0(w.temp)}°<span>{SKY_NAME[skyOf(w.code)]}</span>
          </p>
          {w.feels != null && <p className="rw-small">Feels like {r0(w.feels)}° · humidity {r0(w.humidity)}%</p>}
        </div>
      </div>
      <div className="rw-wind">
        <WindRose from={w.windFrom} speed={w.wind} />
        <div>
          <p className="rw-label">Wind</p>
          <p className="rw-val">
            {compass(w.windFrom)} {r0(w.wind)} km/h
          </p>
          {w.gusts != null && <p className="rw-small">Gusts {r0(w.gusts)} km/h</p>}
        </div>
      </div>
      <dl className="rw-tiles">
        <div>
          <dt>{Icon.thermo} Day</dt>
          <dd>
            {r0(w.max)}° / {r0(w.min)}°
          </dd>
        </div>
        <div>
          <dt>{Icon.drop} Rain</dt>
          <dd>
            {w.rainDay ? `${w.rainDay} mm` : "None"}
            <small>{w.rainChance != null ? `${w.rainChance}% chance at race time` : "on the day"}</small>
          </dd>
        </div>
        {g && (
          <div>
            <dt>{Icon.track} Track</dt>
            <dd>{g}</dd>
          </div>
        )}
        {sunset && (
          <div>
            <dt>{Icon.sunset} Sunset</dt>
            <dd>{sunset}</dd>
          </div>
        )}
      </dl>
      <p className="rw-src">Weather: Open-Meteo, {w.place}.</p>
    </section>
  );
}
