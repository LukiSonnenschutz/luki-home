import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertOrigin,
  assertLocal,
  checkPassword,
  hashPassword,
  newSession,
  sessionCookie,
  hashToken,
  rateLimit,
  HttpError,
  getUserId,
} from "@/lib/auth";
import { createState, db, transaction } from "@/lib/db";
import { body, errorResponse } from "@/lib/http";
import { cookies } from "next/headers";
import { storageMode, cloudConfig } from "@/lib/config";
import { supabase } from "@/lib/supabase";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const credentials = z.object({
  action: z.enum(["setup", "login"]),
  email: z.email().max(254),
  password: z.string().min(1).max(128),
  name: z.string().trim().min(1).max(200).optional(),
});
export async function GET(request: Request) {
  try {
    assertLocal(request);
    if (storageMode() === "supabase")
      return NextResponse.json({
        setup: false,
        authenticated: !!(await getUserId()),
        mode: "supabase",
      });
    return NextResponse.json({
      setup:
        (
          db().prepare("SELECT count(*) AS n FROM accounts").get() as {
            n: number;
          }
        ).n === 0,
      authenticated: !!(await getUserId()),
      mode: "local",
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const c = credentials.parse(await body(request));
    const email = c.email.toLowerCase();
    if (storageMode() === "supabase") {
      if (c.action !== "login")
        throw new HttpError(
          403,
          "Online-Konten werden ausschließlich vom Eigentümer eingerichtet.",
        );
      if (email !== cloudConfig().email)
        throw new HttpError(401, "E-Mail oder Passwort stimmt nicht.");
      const client = await supabase();
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password: c.password,
      });
      if (error || !data.user.email_confirmed_at)
        throw new HttpError(401, "E-Mail oder Passwort stimmt nicht.");
      return NextResponse.json({ ok: true });
    }
    if (c.password.length < 12)
      throw new HttpError(
        400,
        "Das lokale Passwort benötigt mindestens zwölf Zeichen.",
      );
    rateLimit("local-auth");
    let uid: string;
    if (c.action === "setup") {
      uid = transaction(() => {
        if (
          (
            db().prepare("SELECT count(*) AS n FROM accounts").get() as {
              n: number;
            }
          ).n > 0
        )
          throw new HttpError(
            403,
            "Ein Konto ist bereits eingerichtet. Bitte anmelden.",
          );
        const id = crypto.randomUUID();
        db()
          .prepare("INSERT INTO accounts VALUES (?, ?, ?, ?)")
          .run(id, email, hashPassword(c.password), new Date().toISOString());
        createState(id, c.name || "Lukas");
        return id;
      });
    } else {
      const account = db()
        .prepare("SELECT id, password_hash FROM accounts WHERE email = ?")
        .get(email) as { id: string; password_hash: string } | undefined;
      const valid = checkPassword(
        c.password,
        account?.password_hash ?? hashPassword("dummy-password-for-timing"),
      );
      if (!account || !valid)
        throw new HttpError(401, "E-Mail oder Passwort stimmt nicht.");
      uid = account.id;
    }
    const session = newSession(uid);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookie, session.token, {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(request.url).protocol === "https:",
      expires: new Date(session.expires),
      path: "/",
    });
    return response;
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(request: Request) {
  try {
    assertOrigin(request);
    if (storageMode() === "supabase") {
      const { error } = await (await supabase()).auth.signOut();
      if (error)
        throw new HttpError(
          503,
          "Abmelden fehlgeschlagen. Bitte erneut versuchen.",
        );
      return NextResponse.json({ ok: true });
    }
    const token = (await cookies()).get(sessionCookie)?.value;
    if (token)
      db()
        .prepare("DELETE FROM sessions WHERE token_hash = ?")
        .run(hashToken(token));
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(sessionCookie);
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
