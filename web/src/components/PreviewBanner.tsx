// Shown across the top while an editor is previewing an unpublished draft.
export default function PreviewBanner({ path }: { path: string }) {
  return (
    <div className="bg-amber px-4 py-2 text-center text-[14px] font-semibold text-[#1d1500]">
      Preview of the saved draft — only you can see this.{" "}
      <a href={`/api/preview/exit/?to=${encodeURIComponent(path)}`} className="underline underline-offset-2">
        Leave preview
      </a>
    </div>
  );
}
