import "server-only";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { storageMode, cloudConfig, appOrigin } from "./config";
import { supabase } from "./supabase";
export const sessionCookie = "luki-session";
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function checkPassword(password: string, stored: string) {
  const [salt, digest] = stored.split(":");
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(digest, "hex"));
}
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function newSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expires = Date.now() + 7 * 86400_000;
  db().prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  db()
    .prepare("INSERT INTO sessions VALUES (?, ?, ?)")
    .run(hashToken(token), userId, expires);
  return { token, expires };
}
export async function getUserId() {
  if (storageMode() === "supabase") {
    const allowed = cloudConfig().email;
    const {
      data: { user },
      error,
    } = await (await supabase()).auth.getUser();
    if (
      error ||
      !user ||
      !user.email_confirmed_at ||
      user.email?.toLowerCase() !== allowed
    )
      return null;
    return user.id;
  }
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  const row = db()
    .prepare(
      "SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?",
    )
    .get(hashToken(token), Date.now()) as { user_id: string } | undefined;
  return row?.user_id ?? null;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assertLocal(request: Request) {
  if (storageMode() !== "local") {
    try {
      cloudConfig();
      appOrigin();
    } catch (e) {
      throw new HttpError(
        503,
        e instanceof Error ? e.message : "Online-Konfiguration fehlt.",
      );
    }
    return;
  }
  const url = new URL(request.url);
  const host = request.headers.get("host");
  let hostname: string;
  try {
    hostname = new URL(`http://${host}`).hostname;
  } catch {
    throw new HttpError(403, "Ungültiger Hostname.");
  }
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(hostname)
  )
    throw new HttpError(
      403,
      "Lokaler Modus ist nur auf diesem Rechner verfügbar.",
    );
}
export function assertOrigin(request: Request) {
  assertLocal(request);
  const origin = request.headers.get("origin");
  // Next.js may normalize the internal URL to localhost. The validated Host
  // header preserves the browser's actual loopback host and port.
  const expected =
    storageMode() === "supabase"
      ? appOrigin()
      : `${new URL(request.url).protocol}//${request.headers.get("host")}`;
  if (!origin || origin !== expected)
    throw new HttpError(403, "Die Anfrage stammt nicht von dieser Anwendung.");
}
export async function requireUser(request: Request) {
  assertLocal(request);
  const id = await getUserId();
  if (!id) throw new HttpError(401, "Bitte erneut anmelden.");
  return id;
}
export function rateLimit(bucket: string) {
  const now = Date.now();
  db().prepare("DELETE FROM login_attempts WHERE expires_at < ?").run(now);
  db()
    .prepare(
      "INSERT INTO login_attempts VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET count = count + 1",
    )
    .run(bucket, now + 10 * 60_000);
  const row = db()
    .prepare("SELECT count FROM login_attempts WHERE bucket = ?")
    .get(bucket) as { count: number };
  if (row.count > 15)
    throw new HttpError(
      429,
      "Zu viele Versuche. Bitte in zehn Minuten erneut versuchen.",
    );
}
