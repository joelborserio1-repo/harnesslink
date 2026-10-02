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
      <div className="mt-6 grid gap-x-7 gap-y-9 sm:grid-cols-2">
        {visible.map((a) => (
          <ArticleTile key={a.id} article={a} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-9 border-t border-line pt-6 text-center">
          <button onClick={() => setShown((s) => s + STEP)} className="btn">
            Load more stories
          </button>
        </div>
      )}
    </>
  );
}
