import type { Thumb as ThumbData } from "@/lib/api";

// Renders the real featured image (responsive) or a plain navy stand-in with
// the wordmark. Never produces a broken <img>. `eager` is for the one image
// that is the page's LCP candidate.
export default function Thumb({
  image,
  seed,
  alt,
  sizes,
  className = "",
  eager = false,
}: {
  image: ThumbData;
  seed: number;
  alt: string;
  sizes: string;
  className?: string;
  eager?: boolean;
}) {
  if (image?.src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image.src}
        srcSet={image.srcset}
        sizes={sizes}
        alt={alt === "" ? "" : image.alt || alt}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  const shade = ["#081F5B", "#0b2a73", "#06163f"][seed % 3];
  return (
    <svg
      viewBox="0 0 600 400"
      preserveAspectRatio="xMidYMid slice"
      className={`h-full w-full ${className}`}
      role="img"
      aria-label={alt || "Harnesslink"}
    >
      <rect width="600" height="400" fill={shade} />
      <text
        x="300"
        y="212"
        textAnchor="middle"
        fontFamily="'Playfair Display', Georgia, serif"
        fontSize="34"
        fontWeight="700"
        letterSpacing="3"
        fill="#ffffff"
        fillOpacity="0.22"
        style={{ fontVariantCaps: "small-caps" }}
      >
        HarnessLink
      </text>
    </svg>
  );
}
