import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { appOrigin, storageMode } from "@/lib/config";
export async function GET(request: Request) {
  if (storageMode() !== "supabase")
    return NextResponse.redirect(new URL("/login", request.url));
  const params = new URL(request.url).searchParams;
  const hash = params.get("token_hash");
  const type = params.get("type");
  if (hash && (type === "invite" || type === "recovery")) {
    const { error } = await (
      await supabase()
    ).auth.verifyOtp({ token_hash: hash, type });
    if (!error) return NextResponse.redirect(new URL("/password", appOrigin()));
  }
  return NextResponse.redirect(new URL("/login?auth_error=1", appOrigin()));
}
