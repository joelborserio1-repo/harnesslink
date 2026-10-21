import Link from "next/link";
import type { MenuItem } from "@/lib/menu";


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
  // No flags in menus, even where a Strapi menu item still has one set (brand decision, 21 Oct 2026).
  const body = item.title;
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
