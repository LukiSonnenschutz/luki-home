"use client";
import { useState } from "react";
import Link from "next/link";
export default function PasswordPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="loading">
      <section
        className="card"
        style={{ width: "min(440px,calc(100% - 32px))" }}
      >
        <h2>Dein Online-Passwort</h2>
        <p className="muted">
          Lege nach deiner Einladung oder Wiederherstellung ein neues Passwort
          fest.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (f.get("password") !== f.get("confirm")) {
              setError("Die Passwörter stimmen nicht überein.");
              return;
            }
            setBusy(true);
            setError("");
            try {
              const r = await fetch("/api/auth/password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: f.get("password") }),
              });
              const value = await r.json();
              if (!r.ok) throw new Error(value.error);
              window.location.assign(new URL("/", window.location.origin).href);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Änderung fehlgeschlagen.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Neues Passwort
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <label>
              Passwort bestätigen
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <button className="primary">Passwort speichern</button>
          </fieldset>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <Link className="text-button" href="/login">
          Zur Anmeldung
        </Link>
      </section>
    </main>
  );
}
