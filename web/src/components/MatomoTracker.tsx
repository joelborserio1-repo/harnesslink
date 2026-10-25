"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

// Cookieless Matomo page views (no consent banner needed): sets no cookies, IPs anonymised by Matomo.
// Off unless MATOMO_URL and MATOMO_SITE_ID are set on the web service.
declare global {
  interface Window { _paq?: unknown[][] }
}

export default function MatomoTracker({ url, siteId }: { url: string; siteId: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const first = useRef(true);

  useEffect(() => {
    const paq = (window._paq = window._paq || []);
    const base = url.replace(/\/$/, "");
    if (first.current) {
      first.current = false;
      paq.push(["disableCookies"]);
      paq.push(["enableLinkTracking"]);
      paq.push(["setTrackerUrl", `${base}/matomo.php`]);
      paq.push(["setSiteId", siteId]);
      const s = document.createElement("script");
      s.async = true;
      s.src = `${base}/matomo.js`;
      document.head.appendChild(s);
    }
    paq.push(["setCustomUrl", window.location.href]);
    paq.push(["setDocumentTitle", document.title]);
    paq.push(["trackPageView"]);
  }, [pathname, search, url, siteId]);

  return null;
}
