import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <p className="text-sm font-bold uppercase tracking-widest text-accent">404</p>
      <h1 className="font-headline mt-2 text-4xl font-extrabold text-navy-deep">Page not found</h1>
      <p className="mt-3 text-neutral-600">
        We couldn&apos;t find that page. It may have moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded bg-accent px-5 py-2 font-semibold text-white hover:brightness-110"
      >
        Back to the homepage
      </Link>
    </div>
  );
}
