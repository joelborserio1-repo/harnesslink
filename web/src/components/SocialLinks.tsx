import { SOCIAL } from "@/lib/site";

// Bare social glyphs — no circles or boxes around them.
export default function SocialLinks({ className = "", size = 17 }: { className?: string; size?: number }) {
  return (
    <ul className={`flex items-center gap-4 ${className}`}>
      {SOCIAL.map((s) => (
        <li key={s.label}>
          <a href={s.href} aria-label={s.label} target="_blank" rel="noopener noreferrer" className="block hover:text-white">
            <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
              <path d={s.path} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
