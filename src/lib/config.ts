export function storageMode(): "local" | "supabase" {
  const mode =
    process.env.LUKI_STORAGE || (process.env.VERCEL ? "supabase" : "local");
  if (mode !== "local" && mode !== "supabase")
    throw new Error("Ungültiger Speichermodus.");
  if (process.env.VERCEL && mode === "local")
    throw new Error("SQLite-Modus darf nicht auf Vercel betrieben werden.");
  return mode;
}
export function cloudConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.LUKI_ALLOWED_EMAIL?.trim().toLowerCase();
  if (!url || !key || !email)
    throw new Error(
      "Online-Konfiguration fehlt: Supabase-Verbindung und persönliche Login-E-Mail müssen eingerichtet werden.",
    );
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(parsed.hostname)
  )
    throw new Error("Supabase benötigt HTTPS.");
  return { url, key, email };
}
export function appOrigin() {
  const value = process.env.APP_ORIGIN;
  if (!value)
    throw new Error(
      "APP_ORIGIN muss die feste Adresse von Luki Home enthalten.",
    );
  const url = new URL(value);
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new Error("Online-Adresse benötigt HTTPS.");
  if (url.origin !== value.replace(/\/$/, ""))
    throw new Error("APP_ORIGIN darf keinen Pfad enthalten.");
  return url.origin;
}
