import { NextResponse } from "next/server";
import { z } from "zod";
import { assertOrigin, requireUser, HttpError } from "@/lib/auth";
import { storageMode } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { body, errorResponse } from "@/lib/http";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await requireUser(request);
    if (storageMode() !== "supabase")
      throw new HttpError(
        404,
        "Lokales Passwort über die Startanleitung zurücksetzen.",
      );
    const { password } = z
      .object({ password: z.string().min(12).max(128) })
      .parse(await body(request));
    const client = await supabase();
    const { error } = await client.auth.updateUser({ password });
    if (error)
      throw new HttpError(
        400,
        "Das Passwort konnte nicht geändert werden. Bitte den Wiederherstellungslink erneut anfordern.",
      );
    await client.auth.signOut({ scope: "others" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
