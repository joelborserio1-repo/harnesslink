// The horse-and-sulky drawings for race maps, as in the HarnessLink race maps
// (Len Smith Mile, Christian Cullen): a pacing rig drawn in SVG with the
// horse's coat and the driver's silks. Pure strings, so the map is rendered
// on the server with no script.

export type Coat = "bay" | "chestnut" | "baybrown" | "brown" | "black" | "grey";

export const COATS: Record<Coat, { hi: string; lo: string; mid: string; far: string; mane: string; points: string }> = {
  bay: { hi: "#b8682f", lo: "#5e2c12", mid: "#7c3c19", far: "#4a220e", mane: "#1a110b", points: "#1d140e" },
  chestnut: { hi: "#d27a3a", lo: "#7f3a15", mid: "#a3511f", far: "#69300f", mane: "#9a4515", points: "#8a3f17" },
  baybrown: { hi: "#8e4f27", lo: "#3a1b0c", mid: "#5f2f15", far: "#2f160a", mane: "#140c08", points: "#160e09" },
  brown: { hi: "#7a4a2c", lo: "#2f170b", mid: "#4c2814", far: "#24120a", mane: "#120b07", points: "#140c08" },
  black: { hi: "#4e4540", lo: "#121010", mid: "#2a2422", far: "#0f0d0c", mane: "#0a0807", points: "#0b0908" },
  grey: { hi: "#e2ddd4", lo: "#8d867b", mid: "#b1aa9f", far: "#7a7368", mane: "#5d5750", points: "#5f5952" },
};

// Gradients the coats use; put once on the page.
export const coatDefs = () =>
  (Object.entries(COATS) as [Coat, (typeof COATS)[Coat]][])
    .map(([k, c]) => `<linearGradient id="coat-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.hi}"/><stop offset="1" stop-color="${c.lo}"/></linearGradient>`)
    .join("");

// A steady coat for a horse with none chosen (mostly bays and browns, as in a real field).
const DEFAULT_COATS: Coat[] = ["bay", "baybrown", "bay", "brown", "chestnut", "bay", "black", "baybrown", "brown", "bay"];
export function coatFor(name: string, chosen?: string | null): Coat {
  if (chosen && chosen in COATS) return chosen as Coat;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return DEFAULT_COATS[h % DEFAULT_COATS.length];
}

// Pacing gait: legs on the same side move together. Keyframes: reach, support, push, fold.
const GAIT = {
  fore: { len: [15, 13, 5], k: [[40, 70, 60], [5, 0, 30], [-25, -35, -60], [35, -60, -80]] },
  hind: { len: [16, 14, 5], k: [[30, 10, 35], [-15, 5, 30], [-30, -30, -55], [15, -30, -60]] },
};
const ease = (f: number) => f * f * (3 - 2 * f);
function legAngles(kind: "fore" | "hind", t: number) {
  t = ((t % 1) + 1) % 1;
  const k = GAIT[kind].k,
    s = Math.floor(t * 4),
    f = ease(t * 4 - s),
    a = k[s],
    b = k[(s + 1) % 4];
  return a.map((v, i) => v + (b[i] - v) * f);
}
function legPts(kind: "fore" | "hind", t: number, x: number, y: number) {
  const ang = legAngles(kind, t),
    len = GAIT[kind].len,
    pts: [number, number][] = [[x, y]];
  ang.forEach((d, i) => {
    const r = (d * Math.PI) / 180,
      p = pts[pts.length - 1];
    pts.push([p[0] + len[i] * Math.sin(r), p[1] + len[i] * Math.cos(r)]);
  });
  return pts;
}
const P = (p: number[]) => p.map((n) => n.toFixed(1)).join(" ");
function legSvg(pts: [number, number][], upper: string, lower: string) {
  return (
    `<path d="M${P(pts[0])} L${P(pts[1])}" stroke="${upper}" stroke-width="7"/>` +
    `<path d="M${P(pts[1])} L${P(pts[2])}" stroke="${lower}" stroke-width="3.9"/>` +
    `<path d="M${P(pts[2])} L${P(pts[3])}" stroke="${lower}" stroke-width="3.2"/>` +
    `<circle cx="${pts[3][0].toFixed(1)}" cy="${pts[3][1].toFixed(1)}" r="2.5" fill="#15110e"/>`
  );
}
const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

const safe = (c: string) => (/^#[0-9a-f]{3,8}$/i.test(c) || /^[a-z]+$/i.test(c) ? c : "#1d6fd8");

export function rigSvg(coat: Coat, silk1: string, silk2: string, t: number) {
  const c = COATS[coat],
    s1 = safe(silk1),
    s2 = safe(silk2);
  const bob = Math.sin(t * Math.PI * 4) * 0.8;
  const nF = legPts("fore", t, 119, 45),
    nH = legPts("hind", t, 86, 45);
  const fF = legPts("fore", t + 0.5, 115, 44),
    fH = legPts("hind", t + 0.5, 82, 44);
  const hopA = mid(nF[1], nF[2]),
    hopB = mid(nH[1], nH[2]);
  const spokes = [0, 1, 2, 3, 4, 5, 6, 7]
    .map((i) => {
      const a = (i * Math.PI) / 4 + t;
      return `M28 63 L${(28 + 14 * Math.cos(a)).toFixed(1)} ${(63 + 14 * Math.sin(a)).toFixed(1)}`;
    })
    .join(" ");
  return `<svg class="rig" viewBox="0 0 165 82" aria-hidden="true">
  <ellipse cx="88" cy="79" rx="70" ry="2.6" fill="#000" opacity=".16"/>
  <circle cx="35" cy="61" r="15" fill="#b9bfc7" stroke="#808893" stroke-width="2"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">${legSvg(fF, c.far, c.points)}${legSvg(fH, c.far, c.points)}</g>
  <g transform="translate(0 ${bob.toFixed(2)})">
    <path d="M78.5 32 C70 31 61 37 54 46 C63 42 70 40.5 80 37.5 Z" fill="${c.mane}"/>
    <path d="M80 31 C88 26 104 26 116 27 C122 22 128 15 134 10 C137 7 140 6 142 7 L144 2.5 L146 8 C150 12 154 19 156 24 C157.5 27.5 155 30 151 29 C146 27.5 141 25 137.5 24.5 C133 30 128 38 124 44 C122 48 118 49.5 114 48.5 C106 50 94 50 86 48 C82 49 77 48 75 44 C73 38 75 33 80 31 Z" fill="url(#coat-${coat})"/>
    <path d="M86 30 C96 27.5 108 27.5 116 28.5 C108 31 96 32 86 33 Z" fill="#fff" opacity=".14"/>
    <path d="M115 27.5 C121 21.5 127 14.5 133.5 9.5 C136 7.5 139 6.5 141.5 7.5 C136 11 131 16 126 22 C122 26 119 28 115 29.5 Z" fill="${c.mane}"/>
    <circle cx="146.3" cy="14.6" r="2.6" fill="#15181d"/>
    <path d="M140.5 9 L149 25.5 M146 22.5 L154.5 24.8 M137.5 24.5 L141.5 10" stroke="#15181d" stroke-width="1.2" fill="none"/>
    <path d="M94 26.4 L106 26.4 L105.2 37.5 L94.8 37.5 Z" fill="#15181d"/>
    <path d="M100 37 L100 49 M105.5 31.5 L124 41" stroke="#15181d" stroke-width="2.1"/>
  </g>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">${legSvg(nH, c.mid, c.points)}${legSvg(nF, c.mid, c.points)}</g>
  <path d="M${P(hopB)} L${P(hopA)}" stroke="#e9eef5" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M29 63 L32 44 M24 44 L39 44" stroke="#5b626c" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M34 45 C55 43 85 40.5 116 40" stroke="#c9ced6" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M51 29 Q45 10 29 3" stroke="#2b2f36" stroke-width=".8" fill="none"/>
  <path d="M52 29 C85 22 120 20 151 25.5" stroke="#2b2f36" stroke-width=".9" fill="none"/>
  <path d="M32 41 L47 35.5 L57.5 39.5" stroke="#f4f5f7" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M56.5 39 L61 41" stroke="#15181d" stroke-width="3.6" stroke-linecap="round"/>
  <path d="M23 27 C23 21 30 19 34 22 L39 37 C36 41 31 43 28 42 Z" fill="${s1}" stroke="rgba(0,0,0,.25)" stroke-width=".6"/>
  <path d="M27 23 L36.5 38" stroke="${s2}" stroke-width="3"/>
  <path d="M31 25 L41 31 L51 29" stroke="${s1}" stroke-width="3.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M38.5 29.7 L41 31" stroke="${s2}" stroke-width="3.9" stroke-linecap="round"/>
  <circle cx="52" cy="29" r="1.9" fill="#f4f5f7"/>
  <circle cx="27.5" cy="16" r="6.3" fill="${s1}" stroke="rgba(0,0,0,.3)" stroke-width=".6"/>
  <path d="M22 13.2 C25 11.5 30 11 33.2 12.8" stroke="${s2}" stroke-width="2.3" fill="none"/>
  <path d="M31.5 15 L35.5 16.6 L31.5 18.6 Z" fill="#15181d"/>
  <circle cx="28" cy="63" r="15" fill="#eef1f4" stroke="#7b828c" stroke-width="2.4"/>
  <path d="${spokes}" stroke="#a3aab3" stroke-width=".9"/>
  <circle cx="28" cy="63" r="3.4" fill="#7b828c"/>
</svg>`;
}

// The standard name for a settling position.
const WORD = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export function posName(lane: "rail" | "outside", col: number) {
  if (lane === "rail") return col === 1 ? "Leader" : col === 2 ? "Trail" : `${cap(WORD[col] || String(col))} back on the pegs`;
  return col === 1 ? "Death seat" : col === 2 ? "One-one" : `One out, ${WORD[col - 1] || col - 1} back`;
}
