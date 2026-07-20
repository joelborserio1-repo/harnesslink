import type { Thumb as ThumbData } from "@/lib/api";

const PALETTES = [
  ["#0a2a6b", "#1f5bd0"],
  ["#0f5f63", "#12857f"],
  ["#3b2a5e", "#6a3fae"],
  ["#7c2d12", "#c2620a"],
  ["#334155", "#5b6b86"],
  ["#12603a", "#1f9d5e"],
];

// Renders the real featured image (responsive) or a branded gradient stand-in.
// Never produces a broken <img>.
export default function Thumb({
  image,
  seed,
  alt,
  sizes,
  className = "",
}: {
  image: ThumbData;
  seed: number;
  alt: string;
  sizes: string;
  className?: string;
}) {
  if (image?.src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={image.src}
        srcSet={image.srcset}
        sizes={sizes}
        alt={image.alt || alt}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading="lazy"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  const [a, b] = PALETTES[seed % PALETTES.length];
  const id = `t${seed}`;
  return (
    <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" className={`h-full w-full ${className}`} aria-label={alt} role="img">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="400" height="250" fill={`url(#${id})`} />
      <path d="M0,205 Q200,150 400,205 L400,250 L0,250Z" fill="rgba(0,0,0,.16)" />
      <g stroke="rgba(255,255,255,.5)" strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M150,196 l10,-18 l13,3 l7,15" />
        <path d="M188,196 l9,-18 l13,3 l7,15" />
      </g>
      <text x="380" y="235" textAnchor="end" fontFamily="Georgia" fontSize="15" fill="rgba(255,255,255,.10)">
        HARNESSLINK
      </text>
    </svg>
  );
}
