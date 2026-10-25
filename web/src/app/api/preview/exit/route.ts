import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

// GET /api/preview/exit/?to=/my-story/ — leave preview and see the live page.
export async function GET(req: Request) {
  (await draftMode()).disable();
  const to = new URL(req.url).searchParams.get("to") || "/";
  redirect(to.startsWith("/") && !to.startsWith("//") ? to : "/");
}
