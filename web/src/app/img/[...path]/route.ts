// Resized photos (lib/img.ts): passes signed /img/… requests to the imgproxy
// service inside the compose network and streams the WebP back. imgproxy
// checks the signature and only fetches from its allowed sources.

const IMGPROXY = (process.env.IMGPROXY_INTERNAL_URL || "").replace(/\/$/, "");

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!IMGPROXY) return new Response("Not found", { status: 404 });
  const { path } = await params;
  // Signature, options and base64url source only — nothing else is passed on.
  if (!path.length || path.some((p) => !/^[A-Za-z0-9_:.-]+$/.test(p) || p === "..")) {
    return new Response("Not found", { status: 404 });
  }
  const upstream = await fetch(`${IMGPROXY}/${path.join("/")}`, {
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);
  if (!upstream || !upstream.ok || !upstream.body) {
    return new Response("Image unavailable", { status: upstream?.status === 403 ? 403 : 404 });
  }
  const headers = new Headers();
  for (const h of ["content-type", "content-length", "etag", "last-modified"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  // The address changes whenever the photo or size does, so cache for good.
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(upstream.body, { status: 200, headers });
}
