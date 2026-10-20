import { articlesXml, xmlResponse } from "@/lib/sitemaps";

// /sitemap-articles-N.xml (rewritten here in next.config.ts).
export const revalidate = 300;

export async function GET(_req: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  return xmlResponse(await articlesXml(Number(page) || 1));
}
