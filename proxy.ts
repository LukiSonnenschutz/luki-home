import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { storageMode, cloudConfig, appOrigin } from "@/lib/config";
export async function proxy(request: NextRequest) {
  if (storageMode() === "local") return NextResponse.next();
  let settings;
  try {
    settings = cloudConfig();
    appOrigin();
  } catch {
    return NextResponse.next();
  }
  let response = NextResponse.next({ request });
  const client = createServerClient(settings.url, settings.key, {
    cookieOptions: {
      name: "luki-home-auth",
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(appOrigin()).protocol === "https:",
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(items) {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of items)
          response.cookies.set(name, value, options);
      },
    },
  });
  await client.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
