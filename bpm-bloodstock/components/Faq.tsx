"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "Do I actually own the horse?",
    a: "Yep. You hold real micro-shares in a named, registered racehorse — your name goes on the ownership records. It's not a fantasy team or a punt.",
  },
  {
    q: "How does the prizemoney work?",
    a: "When your horse earns, we take a small management fee off the top and split the rest across shareholders by exactly how many shares you hold — down to the cent. It drops straight into your BPM wallet.",
  },
  {
    q: "Are there surprise bills or ongoing costs?",
    a: "No nasty letters. Training, feed and care are covered by the syndicate. You buy your shares and that's your lot — the rest is upside.",
  },
  {
    q: "How little can I start with?",
    a: "Shares start around $40. Grab one, grab ten, grab $200 worth — completely your call. Start small, top up whenever.",
  },
  {
    q: "Can I get my money out?",
    a: "Anytime. Your wallet holds your deposits and your winnings — withdraw the balance whenever you want.",
  },
  {
    q: "Pacers and trotters — what even is that?",
    a: "Harness racing: standardbreds racing in a sulky. Fast, frequent, huge nights under lights, and a community that actually wants you there.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto mt-10 max-w-2xl">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="border-b border-white/10">
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 py-5 text-left"
              aria-expanded={isOpen}
            >
              <span className="font-heading text-lg font-bold text-cream">
                {f.q}
              </span>
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border border-gold/40 text-gold transition-transform duration-300 ${
                  isOpen ? "rotate-45" : ""
                }`}
              >
                +
              </span>
            </button>
            <div
              className="grid transition-all duration-300 ease-out"
              style={{
                gridTemplateRows: isOpen ? "1fr" : "0fr",
              }}
            >
              <div className="overflow-hidden">
                <p className="pb-5 text-cream/65">{f.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
