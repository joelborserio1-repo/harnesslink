"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, signIn } from "@/lib/admin";

const FOURTEEN_DAYS = 60 * 60 * 24 * 14;

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const result = await signIn(email, password);

  if (!result.token) {
    redirect(`/admin/login/?error=${encodeURIComponent(result.error || "Sign-in failed.")}`);
  }

  const https = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    path: "/admin",
    maxAge: FOURTEEN_DAYS,
  });
  redirect("/admin/");
}

export async function signOutAction() {
  (await cookies()).set(SESSION_COOKIE, "", { path: "/admin", maxAge: 0 });
  redirect("/admin/login/");
}
