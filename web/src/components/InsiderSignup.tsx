import SubscribeForm from "@/components/SubscribeForm";

// The navy sign-up band shared by The Insider pages and /subscribe/.
export default function InsiderSignup({ heading = "The Insider", kicker = "Free weekly briefing" }: { heading?: string; kicker?: string }) {
  return (
    <section className="bg-navy p-8 text-white sm:p-12">
      <div className="max-w-2xl">
        <p className="kicker !text-amber">{kicker}</p>
        <h1 className="font-headline mt-2 text-4xl font-bold sm:text-5xl">{heading}</h1>
        <p className="mt-3 text-lg text-white/80">
          In-depth stories, industry whispers and international coverage you won&apos;t find anywhere
          else — in your inbox every Thursday.
        </p>
        <div className="mt-6 max-w-md">
          <SubscribeForm dark cta="Subscribe free" />
        </div>
        <p className="mt-2 text-xs text-white/60">Free. Unsubscribe any time.</p>
      </div>
    </section>
  );
}
