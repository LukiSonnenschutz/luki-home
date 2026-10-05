"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Sun, ShieldCheck } from "lucide-react";
export default function Login() {
  const [setup, setSetup] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"local" | "supabase" | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("auth_error"))
      setError(
        "Der Anmeldelink ist ungültig oder abgelaufen. Bitte einen neuen Link anfordern und im selben Browser öffnen.",
      );
    fetch("/api/auth")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setMode(data.mode);
        if (data.authenticated)
          window.location.assign(new URL("/", window.location.origin).href);
        else setSetup(data.setup);
      })
      .catch((e) => setError(e.message));
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: setup ? "setup" : "login",
          email: form.get("email"),
          password: form.get("password"),
          name: form.get("name") || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      window.location.assign(new URL("/", window.location.origin).href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-shell">
      <div className="login-story">
        <Link className="brand" href="/">
          luki<span className="brand-dot">●</span>
          <span className="brand-home">home</span>
        </Link>
        <div>
          <span className="eyebrow">DEIN TAG. DEIN RHYTHMUS.</span>
          <h1>
            Ein klarer Kopf.
            <br />
            Ein kleiner Schritt.
            <br />
            <span>Dein Zuhause.</span>
          </h1>
          <p>Ein ruhiger Ort für das, was heute wichtig ist.</p>
        </div>
        <span className="muted">LUKI HOME · VERSION 0.3.0</span>
      </div>
      <section className="login-panel">
        <div className="sun-badge">
          <Sun size={28} />
        </div>
        <h2>{setup ? "Willkommen zuhause." : "Schön, dass du da bist."}</h2>
        <p className="muted">
          {setup
            ? "Richte dein persönliches Konto auf diesem Rechner ein."
            : "Melde dich an und starte in deinen Tag."}
        </p>
        {setup !== null && (
          <form onSubmit={submit}>
            {setup && (
              <label>
                Dein Name
                <input
                  name="name"
                  autoComplete="given-name"
                  defaultValue="Lukas"
                  required
                  maxLength={200}
                />
              </label>
            )}
            <label>
              E-Mail
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Passwort
              <input
                name="password"
                type="password"
                autoComplete={setup ? "new-password" : "current-password"}
                minLength={mode === "local" ? 12 : 1}
                maxLength={128}
                required
                placeholder={
                  mode === "local"
                    ? "Mindestens 12 Zeichen"
                    : "Dein Online-Passwort"
                }
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy
                ? "Einen Moment …"
                : setup
                  ? "Luki Home einrichten"
                  : "Anmelden"}
              <ArrowUpRight size={18} />
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <p className="privacy">
          <ShieldCheck size={16} />{" "}
          {mode === null
            ? "Geschützter persönlicher Zugang"
            : mode === "local"
              ? "Lokal gespeichert · nur auf diesem Rechner"
              : "Privater Zugang · sicher online gespeichert"}
        </p>
        {!setup && setup !== null && mode === "local" && (
          <p className="muted small">
            Passwort vergessen? Die lokale Wiederherstellung ist in der
            Startanleitung beschrieben.
          </p>
        )}
        {mode === "supabase" && (
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={async () => {
              const email = (
                document.querySelector(
                  'input[name="email"]',
                ) as HTMLInputElement
              )?.value;
              if (!email) {
                setError("Bitte zuerst deine E-Mail eintragen.");
                return;
              }
              setBusy(true);
              setError("");
              setNotice("");
              try {
                const r = await fetch("/api/auth/recovery", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email }),
                });
                const value = await r.json();
                if (!r.ok) throw new Error(value.error);
                setNotice(
                  "Wenn ein passendes Konto existiert, erhältst du eine E-Mail zur Wiederherstellung.",
                );
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Wiederherstellung fehlgeschlagen.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Passwort vergessen?
          </button>
        )}
        {notice && (
          <p role="status" className="muted small">
            {notice}
          </p>
        )}
      </section>
    </main>
  );
}
