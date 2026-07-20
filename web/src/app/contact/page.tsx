import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the Harnesslink team — news tips, corrections, advertising and general enquiries.",
  alternates: { canonical: "https://harnesslink.com/contact/" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="card p-6 sm:p-10">
        <p className="eyebrow text-[15px]">Get in touch</p>
        <h1 className="font-headline text-3xl font-extrabold text-navy sm:text-4xl">Contact Us</h1>
        <p className="mt-2 max-w-[60ch] text-[15px] text-[#41454e]">
          Have a news tip, a correction, an advertising enquiry, or just want to say hello? Send us a
          message and the Harnesslink team will get back to you.
        </p>

        <form className="mt-6 flex flex-col gap-4" action="#">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">
              Name
              <input
                type="text"
                name="name"
                required
                className="rounded-lg border border-black/15 px-3 py-2.5 font-normal text-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">
              Email
              <input
                type="email"
                name="email"
                required
                className="rounded-lg border border-black/15 px-3 py-2.5 font-normal text-neutral-900"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">
            Subject
            <input
              type="text"
              name="subject"
              className="rounded-lg border border-black/15 px-3 py-2.5 font-normal text-neutral-900"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">
            Message
            <textarea
              name="message"
              required
              rows={6}
              className="rounded-lg border border-black/15 px-3 py-2.5 font-normal text-neutral-900"
            />
          </label>
          <button
            type="submit"
            className="self-start rounded-lg bg-navy px-6 py-3 font-bold text-white hover:bg-navy-deep"
          >
            Send message
          </button>
        </form>
      </div>
    </div>
  );
}
