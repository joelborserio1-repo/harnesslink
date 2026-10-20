import Link from "next/link";
import Flag, { type FlagCode } from "@/components/Flag";
import type { MenuItem } from "@/lib/menu";

const FLAGS = new Set(["au", "nz", "us", "ca", "eu", "se", "fr", "gb"]);

export function MenuFlag({ code }: { code: string | null }) {
  return code && FLAGS.has(code) ? <Flag code={code as FlagCode} /> : null;
}

// One menu link: our own pages through Next's Link, other sites in a new tab.
export default function MenuLink({
  item,
  className,
  onClick,
  role,
}: {
  item: MenuItem;
  className: string;
  onClick?: () => void;
  role?: string;
}) {
  const body = (
    <>
      <MenuFlag code={item.flag} />
      {item.title}
    </>
  );
  if (!item.href) return <span className={className}>{body}</span>;
  if (item.external)
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" role={role} onClick={onClick} className={className}>
        {body}
      </a>
    );
  return (
    <Link href={item.href} role={role} onClick={onClick} className={className}>
      {body}
    </Link>
  );
}
