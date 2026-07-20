"use client";

import { useState } from "react";
import ArticleTile from "@/components/home/ArticleTile";
import type { ArticleSummary } from "@/lib/api";

const STEP = 6;

export default function InternationalGrid({ articles }: { articles: ArticleSummary[] }) {
  const [shown, setShown] = useState(STEP);
  const visible = articles.slice(0, shown);
  const hasMore = shown < articles.length;

  return (
    <>
      <div className="mt-4 grid gap-[18px] sm:grid-cols-2">
        {visible.map((a) => (
          <ArticleTile key={a.id} article={a} />
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setShown((s) => s + STEP)}
          className="mx-auto mt-6 block rounded-[9px] bg-navy px-6 py-3 text-[13px] font-bold uppercase tracking-wide text-white hover:bg-navy-deep"
        >
          Load More
        </button>
      )}
    </>
  );
}
