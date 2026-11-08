"use client";

import { useEffect, useState } from "react";

// Days / hours / mins / secs to the race. Renders zeros on the server and
// starts ticking once hydrated, so there's no clock mismatch between the two.
export default function Countdown({ start, finishedText }: { start: string; finishedText: string }) {
  const target = Date.parse(start);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  if (now !== null && now >= target) {
    return <p className="font-headline text-[22px] font-semibold uppercase tracking-[0.06em] text-white sm:text-[28px]">{finishedText}</p>;
  }

  const left = now === null ? 0 : Math.max(0, target - now);
  const parts: [string, number][] = [
    ["days", Math.floor(left / 86_400_000)],
    ["hours", Math.floor(left / 3_600_000) % 24],
    ["mins", Math.floor(left / 60_000) % 60],
    ["secs", Math.floor(left / 1000) % 60],
  ];

  return (
    <div className="flex gap-2 sm:gap-3" role="timer" aria-live="off" aria-label="Time remaining">
      {parts.map(([unit, n]) => (
        <span key={unit} className="flex w-[62px] flex-col items-center border border-white/35 bg-[#00205E]/55 py-2 sm:w-[78px] sm:py-3">
          <b className="font-headline text-[26px] font-semibold leading-none text-white tabular-nums sm:text-[34px]">
            {String(n).padStart(2, "0")}
          </b>
          <small className="font-ui mt-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">{unit}</small>
        </span>
      ))}
    </div>
  );
}
