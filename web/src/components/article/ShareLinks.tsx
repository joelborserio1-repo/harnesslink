// Share links as plain glyphs — ordinary anchors, no third-party scripts.
const TARGETS = [
  {
    label: "Share on Facebook",
    href: (u: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
    path: "M13 22v-8h3l.5-3.5H13V8.2c0-1 .3-1.7 1.8-1.7H17V3.3A24 24 0 0014.4 3C11.9 3 10 4.5 10 7.7v2.8H7V14h3v8z",
  },
  {
    label: "Share on X",
    href: (u: string, t: string) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
    path: "M17.5 3H21l-7.3 8.3L22 21h-6.4l-5-6.1L4.8 21H1.3l7.8-8.9L2 3h6.6l4.5 5.6zm-1.1 16h1.9L7.7 5H5.7z",
  },
  {
    label: "Share by email",
    href: (u: string, t: string) => `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(u)}`,
    path: "M3 5h18v14H3zm2 2v.4l7 4.9 7-4.9V7zm14 2.8l-7 4.9-7-4.9V17h14z",
  },
];

export default function ShareLinks({ url, title }: { url: string; title: string }) {
  return (
    <ul className="flex items-center gap-4 text-navy" aria-label="Share this story">
      <li className="kicker !text-muted" aria-hidden>
        Share
      </li>
      {TARGETS.map((t) => (
        <li key={t.label}>
          <a href={t.href(url, title)} target="_blank" rel="noopener noreferrer" aria-label={t.label} className="block hover:text-blue">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" fillRule="evenodd" aria-hidden>
              <path d={t.path} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
