// Racing colours for the Next To Go widget: /api/silk/?p=<path>. The HarnessLink
// silks endpoint needs the service key, so the image is fetched server-side.
import { getSilk } from "@/lib/harnesslink";

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("p") || "";
  const res = await getSilk(path);
  if (!res) return new Response(null, { status: 404 });
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
