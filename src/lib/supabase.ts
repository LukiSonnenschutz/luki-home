import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { appOrigin, cloudConfig } from "./config";
export async function supabase() {
  const config = cloudConfig();
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: {
      name: "luki-home-auth",
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(appOrigin()).protocol === "https:",
    },
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(items) {
        try {
          for (const { name, value, options } of items)
            jar.set(name, value, options);
        } catch {
          /* Server Components are read-only; proxy refreshes the cookies. */
        }
      },
    },
  });
}
