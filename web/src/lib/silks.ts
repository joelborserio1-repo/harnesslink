// Draws racing silks (the driver's jacket) from TAB's written description,
// e.g. "ROYAL BLUE, WHITE YOKE, ROYAL BLUE THREE NECK STARS". Used when TAB
// has no image for a runner (TAB drops them a few days after a meeting).
// It's an approximation: body colour, a second colour, one pattern, and the
// sleeve colour when the description names them.

const COLOURS: [RegExp, string][] = [
  [/royal blue/, "#1f3fbf"],
  [/navy|dark blue/, "#14244f"],
  [/sky blue|light blue|pale blue/, "#7ec3ef"],
  [/medium blue|mid blue/, "#2f6fd0"],
  [/denim/, "#3d5f8c"],
  [/aqua|turquoise|teal/, "#1fa7a7"],
  [/blue/, "#2456c7"],
  [/emerald|dark green|bottle green|hunter green/, "#11643a"],
  [/lime|fluoro green|lime green/, "#8fd13a"],
  [/green/, "#2e9a48"],
  [/maroon|burgundy|claret/, "#7a1f2b"],
  [/cerise|magenta|fuchsia/, "#d1267a"],
  [/pink/, "#f17fb0"],
  [/scarlet|red/, "#d32630"],
  [/orange|tangerine/, "#ef7a1a"],
  [/gold|amber/, "#d9a53a"],
  [/yellow|lemon/, "#f6d21b"],
  [/purple|violet|mauve|lilac|lavender/, "#6b2fa0"],
  [/brown|chocolate|tan|fawn|beige/, "#7a5230"],
  [/silver|grey|gray/, "#a9adb5"],
  [/black/, "#151515"],
  [/white|cream/, "#ffffff"],
];

function colourOf(text: string): string | null {
  const t = text.toLowerCase();
  for (const [re, hex] of COLOURS) if (re.test(t)) return hex;
  return null;
}

type Pattern = "stripes" | "hoops" | "diamonds" | "stars" | "star" | "spots" | "sash" | "cross" | "chevrons" | "quartered" | "halves" | "check" | "braces" | "yoke" | "band" | null;

const PATTERNS: [RegExp, Pattern][] = [
  [/quarter/, "quartered"],
  [/halves|halved/, "halves"],
  [/check|tartan/, "check"],
  [/chevron/, "chevrons"],
  [/hoop|band(?!s)/, "hoops"],
  [/stripe/, "stripes"],
  [/diamond/, "diamonds"],
  [/stars/, "stars"],
  [/\bstar\b/, "star"],
  [/spot|dot|disc/, "spots"],
  [/sash/, "sash"],
  [/cross|st andrew/, "cross"],
  [/braces/, "braces"],
  [/yoke/, "yoke"],
];

export type SilkSpec = { body: string; second: string; pattern: Pattern; sleeves: string; cap: string };

export function parseSilk(description: string | null): SilkSpec | null {
  if (!description) return null;
  const parts = description.replace(/\(.*?\)/g, "").split(/,|&| and /i).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const body = colourOf(parts[0]) || "#4a4e57";
  let second: string | null = null;
  let pattern: Pattern = null;
  let sleeves: string | null = null;
  for (const p of parts.slice(1)) {
    const lower = p.toLowerCase();
    const c = colourOf(lower);
    if (/sleeve/.test(lower)) {
      if (c) sleeves = c;
      continue;
    }
    if (/cap|collar|cuff|seams/.test(lower)) continue;
    if (!pattern) for (const [re, pat] of PATTERNS) if (re.test(lower)) { pattern = pat; break; }
    if (c && c !== body && !second) second = c;
  }
  // "BLACK, YELLOW FOUR DIAMONDS" — the pattern's colour is the second colour.
  second = second || (body === "#ffffff" ? "#151515" : "#ffffff");
  return { body, second, pattern, sleeves: sleeves || body, cap: second };
}

// SVG markup for a jacket 100 × 119 (TAB's images are 119 × 142).
export function silkSvg(spec: SilkSpec): string {
  const { body, second, pattern, sleeves } = spec;
  // Stable id (same on the server and in the browser).
  let h = 0;
  for (const ch of `${body}${second}${pattern}${sleeves}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const id = h.toString(36);
  const torso = "M30 18 L70 18 L78 32 L76 112 L24 112 L22 32 Z";
  let deco = "";
  switch (pattern) {
    case "stripes":
      deco = [30, 42, 54, 66].map((x) => `<rect x="${x}" y="10" width="6" height="110" fill="${second}"/>`).join("");
      break;
    case "hoops":
      deco = [38, 58, 78, 98].map((y) => `<rect x="0" y="${y}" width="100" height="9" fill="${second}"/>`).join("");
      break;
    case "diamonds":
      deco = [[50, 45], [38, 70], [62, 70], [50, 95]].map(([x, y]) => `<path d="M${x} ${y - 10} L${x + 8} ${y} L${x} ${y + 10} L${x - 8} ${y} Z" fill="${second}"/>`).join("");
      break;
    case "star":
      deco = star(50, 65, 18, second);
      break;
    case "stars":
      deco = [[38, 48], [62, 48], [50, 76], [38, 100], [62, 100]].map(([x, y]) => star(x, y, 8, second)).join("");
      break;
    case "spots":
      deco = [[38, 45], [62, 45], [50, 68], [38, 92], [62, 92]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="${second}"/>`).join("");
      break;
    case "sash":
      deco = `<path d="M26 22 L40 18 L78 104 L64 112 Z" fill="${second}"/>`;
      break;
    case "cross":
      deco = `<path d="M24 24 L34 18 L78 106 L68 112 Z M76 24 L66 18 L22 106 L32 112 Z" fill="${second}"/>`;
      break;
    case "chevrons":
      deco = [50, 80].map((y) => `<path d="M22 ${y - 14} L50 ${y} L78 ${y - 14} L78 ${y - 4} L50 ${y + 10} L22 ${y - 4} Z" fill="${second}"/>`).join("");
      break;
    case "quartered":
      deco = `<rect x="50" y="10" width="40" height="52" fill="${second}"/><rect x="10" y="62" width="40" height="60" fill="${second}"/>`;
      break;
    case "halves":
      deco = `<rect x="50" y="10" width="40" height="110" fill="${second}"/>`;
      break;
    case "check":
      deco = [0, 1, 2, 3, 4].flatMap((r) => [0, 1, 2, 3].map((c) => ((r + c) % 2 ? `<rect x="${22 + c * 14}" y="${18 + r * 19}" width="14" height="19" fill="${second}"/>` : ""))).join("");
      break;
    case "braces":
      deco = `<rect x="34" y="18" width="7" height="94" fill="${second}"/><rect x="59" y="18" width="7" height="94" fill="${second}"/>`;
      break;
    case "yoke":
      deco = `<path d="M22 18 L78 18 L78 40 L22 40 Z" fill="${second}"/>`;
      break;
    case "band":
      deco = `<rect x="0" y="60" width="100" height="14" fill="${second}"/>`;
      break;
    default:
      deco = "";
  }
  const edge = body === "#ffffff" || sleeves === "#ffffff" ? "#9aa0a8" : "rgba(0,0,0,.35)";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 119"><defs><clipPath id="t${id}"><path d="${torso}"/></clipPath></defs>
<path d="M30 18 L10 30 L4 70 L18 74 L24 46 Z" fill="${sleeves}" stroke="${edge}" stroke-width="1.5"/>
<path d="M70 18 L90 30 L96 70 L82 74 L76 46 Z" fill="${sleeves}" stroke="${edge}" stroke-width="1.5"/>
<path d="${torso}" fill="${body}"/><g clip-path="url(#t${id})">${deco}</g>
<path d="${torso}" fill="none" stroke="${edge}" stroke-width="1.5"/>
<path d="M40 18 Q50 28 60 18" fill="none" stroke="${edge}" stroke-width="1.5"/></svg>`;
}

function star(cx: number, cy: number, r: number, fill: string) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  });
  return `<polygon points="${pts.join(" ")}" fill="${fill}"/>`;
}

export const silkDataUrl = (description: string | null) => {
  const spec = parseSilk(description);
  return spec ? `data:image/svg+xml;utf8,${encodeURIComponent(silkSvg(spec))}` : null;
};
