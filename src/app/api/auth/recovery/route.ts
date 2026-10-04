import { NextResponse } from "next/server";
import { z } from "zod";
import { assertOrigin, HttpError } from "@/lib/auth";
import { storageMode, cloudConfig, appOrigin } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { body, errorResponse } from "@/lib/http";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    if (storageMode() !== "supabase")
      throw new HttpError(
        404,
        "Die lokale Wiederherstellung erfolgt über die Startanleitung.",
      );
    const { email } = z
      .object({ email: z.email().max(254) })
      .parse(await body(request));
    if (email.toLowerCase() === cloudConfig().email) {
      const { error } = await (
        await supabase()
      ).auth.resetPasswordForEmail(email, {
        redirectTo: `${appOrigin()}/auth/callback?next=/password`,
      });
      if (error)
        throw new HttpError(
          429,
          "Die Wiederherstellung ist derzeit nicht verfügbar. Bitte später erneut versuchen.",
        );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
