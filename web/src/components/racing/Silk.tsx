import { silkSrc } from "@/lib/racingLinks";

// Racing colours. Images come through /api/silk/ (the HarnessLink key stays on the server).
export default function Silk({ path, size = 28, title }: { path: string | null | undefined; size?: number; title?: string | null }) {
  const h = Math.round(size * 1.18);
  if (!path) {
    return <span aria-hidden="true" className="inline-block shrink-0 border border-dashed border-line" style={{ width: size, height: h }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={silkSrc(path)} alt={title ? `Colours: ${title}` : ""} title={title ?? undefined} width={size} height={h} loading="lazy" className="shrink-0 object-contain" style={{ width: size, height: h }} />
  );
}
