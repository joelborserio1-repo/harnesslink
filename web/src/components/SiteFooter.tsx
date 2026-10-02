import Link from "next/link";
import { FOOTER_COUNTRIES, countryHref } from "@/lib/countries";
import SocialLinks from "@/components/SocialLinks";

const QUICK_LINKS = [
  { label: "Subscribe", href: "/subscribe/" },
  { label: "Contact", href: "/contact-us/" },
  { label: "Directory", href: "/directory/" },
];

function LinkList({ items }: { items: { label: string; href: string }[] }) {
  return (
    <ul className="mt-4 space-y-2 text-[14px]">
      {items.map((l) => (
        <li key={l.label}>
          <Link href={l.href} className="text-white/75 hover:text-white hover:underline">
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ColumnHead({ children }: { children: React.ReactNode }) {
  return <h2 className="border-t border-white/25 pt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white">{children}</h2>;
}

export default function SiteFooter() {
  const countries = [
    { label: "All", href: "/" },
    ...FOOTER_COUNTRIES.map((c) => ({ label: c.name, href: countryHref(c.slug) })),
  ];

  return (
    <footer className="mt-16 bg-navy text-white/75">
      <div className="wrap grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="font-headline text-[30px] font-bold leading-none tracking-[0.04em] text-white [font-variant-caps:small-caps]">
            HarnessLink
          </div>
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed">
            Harnesslink.com is the only harness racing website dedicated to covering news and
            events in the Standardbred Industry worldwide.
          </p>
          <SocialLinks className="mt-6 text-white/75" size={19} />
        </div>

        <div>
          <ColumnHead>Quick Links</ColumnHead>
          <LinkList items={QUICK_LINKS} />
        </div>

        <div>
          <ColumnHead>Explore by Countries</ColumnHead>
          <LinkList items={countries} />
        </div>

        <div>
          <ColumnHead>Contact Info</ColumnHead>
          <ul className="mt-4 space-y-2 text-[14px]">
            <li>
              <a href="mailto:admin@harnesslink.com" className="hover:text-white hover:underline">admin@harnesslink.com</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="wrap flex flex-col gap-2 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Harnesslink | All Rights Reserved | Designed with intention by JTB ASSET GROUP</p>
          <p className="flex gap-5">
            <Link href="/disclaimers/" className="hover:text-white">Disclaimers</Link>
            <Link href="/privacy-policy/" className="hover:text-white">Privacy Policy</Link>
            <Link href="/terms-conditions/" className="hover:text-white">Terms &amp; Conditions</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
