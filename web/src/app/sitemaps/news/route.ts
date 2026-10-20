import { newsXml, xmlResponse } from "@/lib/sitemaps";

// Served at the public path via a rewrite in next.config.ts.
export const revalidate = 300;

export async function GET() {
  return xmlResponse(await newsXml());
}
