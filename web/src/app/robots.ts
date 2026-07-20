import type { MetadataRoute } from "next";

const SITE = process.env.SITE_URL || "https://harnesslink.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/admin" },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
