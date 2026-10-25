import { timingSafeEqual } from "node:crypto";
import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { PREVIEW_SECRET, previewTarget } from "@/lib/preview";

function secretMatches(given: string) {
  if (!PREVIEW_SECRET || given.length !== PREVIEW_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(PREVIEW_SECRET));
}

// GET /api/preview/?secret=…&uid=…&documentId=… — called by Strapi's Preview
// button. Switches on draft mode for this browser and opens the draft.
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!secretMatches(url.searchParams.get("secret") || "")) {
    return new Response("Preview link is invalid.", { status: 401 });
  }
  const path = await previewTarget(url.searchParams.get("uid") || "", url.searchParams.get("documentId") || "");
  if (!path) return new Response("Save the story first — it has no URL yet.", { status: 404 });

  (await draftMode()).enable();
  redirect(path);
}
