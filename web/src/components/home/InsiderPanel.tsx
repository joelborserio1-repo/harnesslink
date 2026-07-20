export default function InsiderPanel() {
  return (
    <div className="rounded-xl p-6 text-white shadow-[0_6px_20px_rgba(8,31,91,0.15)]" style={{ background: "linear-gradient(160deg, var(--color-navy), #0a2470)" }}>
      <p className="eyebrow text-[15px] text-[#9db4ec]">Subscriber Briefing</p>
      <h3 className="font-headline mt-0.5 text-2xl font-bold">The Insider</h3>
      <p className="mt-2 text-sm text-[#cdd8f4]">Our weekly briefing — form, features and the tips that matter, every Thursday.</p>
      <form className="mt-4 flex flex-col gap-2.5">
        <input type="email" placeholder="you@email.com" aria-label="Email address" className="rounded-lg px-3 py-2.5 text-sm text-neutral-900" />
        <button type="submit" className="rounded-lg bg-amber px-3 py-2.5 text-sm font-bold text-[#241a00]">Subscribe</button>
      </form>
    </div>
  );
}
