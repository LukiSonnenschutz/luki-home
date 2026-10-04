import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { appOrigin, storageMode } from "@/lib/config";
export async function GET(request: Request) {
  if (storageMode() !== "supabase")
    return NextResponse.redirect(new URL("/login", request.url));
  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  if (code) {
    const { error } = await (
      await supabase()
    ).auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          params.get("next") === "/password" ? "/password" : "/",
          appOrigin(),
        ),
      );
  }
  return NextResponse.redirect(new URL("/login?auth_error=1", appOrigin()));
}
