import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // WordPress permalinks are /%postname%/ — the trailing slash is part of the
  // URL we must preserve. This serves /slug/ canonically and 308s /slug -> /slug/.
  trailingSlash: true,
};

export default nextConfig;
