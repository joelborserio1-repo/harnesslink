import Link from "next/link";
import type { Ref } from "@/lib/api";

// The section label above a headline — plain tracked caps, never a chip.
export default function Kicker({ category, className = "" }: { category: Ref | null; className?: string }) {
  if (!category) return null;
  return (
    <Link href={category.url} className={`kicker hover:text-blue ${className}`}>
      {category.name}
    </Link>
  );
}
