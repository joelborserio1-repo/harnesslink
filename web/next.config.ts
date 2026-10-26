import type { NextConfig } from "next";

// NOTE: read at BUILD time — rewrites are compiled into the build output. The
// Docker image sets it via a build arg (see web/Dockerfile).
const STRAPI_URL = (process.env.STRAPI_URL || "http://127.0.0.1:1337").replace(/\/$/, "");

const nextConfig: NextConfig = {
  // WordPress permalinks are /%postname%/ — the trailing slash is part of the
  // URL we must preserve. This serves /slug/ canonically and 308s /slug -> /slug/.
  trailingSlash: true,

  // Self-contained server bundle for the Docker image (.next/standalone).
  output: "standalone",

  // Fixed 301s the live site already performs (or that fold a duplicate page
  // into its real URL). Data-driven redirects live in the Rails Redirect table.
  async redirects() {
    const moved = (source: string, destination: string) => ({ source, destination, statusCode: 301 as const });
    return [
      moved("/author/:slug", "/writers/:slug/"), // live: /author/x/ → /writers/x/
      moved("/contact", "/contact-us/"), // live does the same
      moved("/subscribe-2", "/subscribe/"), // live does the same
      moved("/privacy-policy-2", "/privacy-policy/"), // live does the same
      moved("/directory-2", "/directory/"), // duplicate hub page on live
      // Leaky Paywall's account pages on live → the new sign-in pages.
      moved("/login-2", "/login/"),
      moved("/register-2", "/register/"),
      moved("/account", "/my-account/"),
      moved("/account-2", "/my-account/"),
      moved("/password-reset-2", "/password-reset/"),
    ];
  },

  // SEO XML is built by route handlers under /sitemaps/ and served at the
  // public paths the live site uses. Tracking and signup go to the CMS.
  async rewrites() {
    return [
      { source: "/sitemap.xml", destination: "/sitemaps/index" },
      { source: "/sitemap-articles-:page.xml", destination: "/sitemaps/articles/:page" },
      { source: "/news-sitemap.xml", destination: "/sitemaps/news" },
      { source: "/archives-sitemap.xml", destination: "/sitemaps/archives" },
      // /feed needs the trailing slash because trailingSlash:true is on.
      { source: "/feed/", destination: "/sitemaps/feed" },
      // Ad click tracking — counts then redirects to the advertiser.
      { source: "/ad/:id/click", destination: `${STRAPI_URL}/api/ads/:id/click` },
      // Ad viewable-impression beacon. Callers use the trailing-slash form (trailingSlash is on).
      { source: "/ad/:id/impression", destination: `${STRAPI_URL}/api/ads/:id/impression` },
      // Free registration-wall / newsletter signup.
      { source: "/api/subscribe", destination: `${STRAPI_URL}/api/subscribers/signup` },
      // Article view beacon — browser POSTs here; proxied to the CMS counter.
      { source: "/track/view/:slug", destination: `${STRAPI_URL}/api/articles/:slug/view` },
    ];
  },
};

export default nextConfig;
