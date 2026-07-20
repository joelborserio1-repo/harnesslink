import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-neutral-50">
      <div className="bg-navy text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="font-headline text-lg font-bold uppercase tracking-wide">
            Harnesslink Admin
          </Link>
          <Link href="/" className="text-sm text-white/70 hover:text-white">
            View site →
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
