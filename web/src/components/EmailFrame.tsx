"use client";

import { useRef, useState } from "react";

// Shows an Insider email exactly as it was sent, in a sandboxed frame: the
// email's own styles can't leak into the page, and nothing in it can run
// (no allow-scripts). The frame grows to the email's height once loaded.
export default function EmailFrame({ html, title }: { html: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1600);

  const fit = () => {
    const doc = ref.current?.contentDocument;
    if (doc?.body) setHeight(Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight) + 8);
  };

  return (
    <iframe
      ref={ref}
      title={title}
      srcDoc={html}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      onLoad={() => {
        fit();
        // Images load after the document; measure again once they're in.
        setTimeout(fit, 800);
        setTimeout(fit, 2500);
      }}
      style={{ height }}
      className="block w-full border-0 bg-white"
    />
  );
}
