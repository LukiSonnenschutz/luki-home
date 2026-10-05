"use client";
import Link from "next/link";
import { useState } from "react";
import { alarmTones, playTone, unlockAudio, type AlarmTone } from "@/lib/audio";
import type { State, Command } from "@/lib/model";
import {
  preferences,
  coffeeForDay,
  focusSeconds,
  plannedSeconds,
  nextStep,
  stabilityHints,
  type Preferences,
} from "@/lib/stability";
import { localClock } from "@/lib/time";
type Save = (c: Command) => Promise<boolean>;
type Props = {
  state: State;
  date: string;
  now: Date;
  save: Save;
  busy: boolean;
};
const clockDuration = (seconds: number) => {
  const sec = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
};
export function WorkTracker({ state: s, date, now, save, busy }: Props) {
  const current = s.work_sessions.find((w) => w.status !== "done");
  const rows = s.work_sessions.filter((w) => w.local_date === date);
  const latest = [...rows].sort((a, b) =>
    b.started_at.localeCompare(a.started_at),
  )[0];
  const w =
    current ||
    (latest?.was_reset
      ? undefined
      : [...rows].reverse().find((w) => !w.break_started_at));
  const today = date === localClock(now, s.profile.timezone).date;
  const elapsed = w ? focusSeconds(w, now) : 0;
  const inBreak = w?.status === "break";
  const breakSeconds = inBreak
    ? (now.getTime() - new Date(w.break_started_at!).getTime()) / 1000
    : 0;
  const remaining = inBreak
    ? w!.planned_break_minutes * 60 - breakSeconds
    : (w ? plannedSeconds(w) : preferences(s).focus_minutes * 60) - elapsed;
  const action = (action: Extract<Command, { type: "work" }>["action"]) =>
    save({ type: "work", date, action });
  return (
    <section className="card work-card">
      <span className="eyebrow">WORK / FOKUS</span>
      <h3>
        {inBreak
          ? "Echte Pause"
          : current?.status === "paused"
            ? "Fokus pausiert"
            : current
              ? "Dein Fokusblock"
              : "Raum für konzentriertes Arbeiten"}
      </h3>
      <div className="timer-number" aria-label="Verbleibende Zeit">
        {clockDuration(remaining)}
        <small>{remaining < 0 ? "Zeit erreicht" : "verbleibend"}</small>
      </div>
      <p className="muted">
        Vergangen: {clockDuration(inBreak ? breakSeconds : elapsed)} ·{" "}
        {inBreak
          ? w!.planned_break_minutes
          : w
            ? plannedSeconds(w) / 60
            : preferences(s).focus_minutes}{" "}
        Minuten geplant
      </p>
      {!inBreak && (
        <form
          key={current?.id || "new-focus"}
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            await save({
              type: "work",
              date,
              action: current ? "set-duration" : "start",
              minutes: Number(form.get("minutes")),
            });
          }}
        >
          <label>
            Fokusdauer · Minuten
            <input
              name="minutes"
              type="number"
              min="0.1"
              max="240"
              step="any"
              required
              disabled={busy || !today}
              defaultValue={
                current
                  ? plannedSeconds(current) / 60
                  : preferences(s).focus_minutes
              }
            />
          </label>
          <p className="small muted">
            {current
              ? "Gesamtdauer dieses Blocks. Bereits vergangene Fokuszeit bleibt erhalten."
              : "Dauer für diesen Block. Deine Standarddauer bleibt unverändert."}
          </p>
          <button disabled={busy || !today} className="primary">
            {current ? "Zeit übernehmen" : "Fokusblock starten"}
          </button>
        </form>
      )}
      <div className="button-row">
        {current?.status === "active" && (
          <button
            disabled={busy || !today}
            className="secondary"
            onClick={() => action("pause")}
          >
            Fokus pausieren
          </button>
        )}
        {current?.status === "paused" && (
          <button
            disabled={busy || !today}
            className="primary"
            onClick={() => action("resume")}
          >
            Fokus fortsetzen
          </button>
        )}
        {current && !inBreak && (
          <button
            disabled={busy || !today}
            className="secondary"
            onClick={() => action("reset")}
          >
            Zurücksetzen
          </button>
        )}
        {current && !inBreak && (
          <button
            disabled={busy || !today}
            className="secondary"
            onClick={() => action("end")}
          >
            Fokus beenden
          </button>
        )}
        {w && !inBreak && !w.break_started_at && (
          <button
            disabled={busy || !today}
            className="secondary"
            onClick={() => action("break-start")}
          >
            Pause starten
          </button>
        )}
        {inBreak && (
          <button
            disabled={busy || !today}
            className="primary"
            onClick={() => action("break-end")}
          >
            Pause beenden
          </button>
        )}
      </div>
      {preferences(s).work_rule &&
        today &&
        w?.status === "done" &&
        !w.break_started_at && (
          <p className="notice">
            Fokusblock beendet. Jetzt weg vom Bildschirm und eine echte Pause
            machen.
          </p>
        )}
      {preferences(s).work_rule && inBreak && remaining < -300 && (
        <p className="notice">
          Die geplante Pause ist überzogen. Entscheide bewusst, wie du
          weitergehst.
        </p>
      )}
      <div className="metric-summary">
        <strong>
          {rows.filter((w) => !w.was_reset).length}
          <small>Fokusblöcke</small>
        </strong>
        <strong>
          {Math.round(rows.reduce((n, w) => n + focusSeconds(w, now), 0) / 60)}{" "}
          min<small>Fokus heute</small>
        </strong>
      </div>
      {!!rows.length && (
        <details>
          <summary>Gespeicherte Fokusblöcke</summary>
          {rows.map((row) => (
            <p className="small" key={row.id}>
              {localClock(new Date(row.started_at), s.profile.timezone).time} →{" "}
              {row.ended_at
                ? localClock(new Date(row.ended_at), s.profile.timezone).time
                : "offen"}{" "}
              · {Math.round(focusSeconds(row, now) / 60)} min ·{" "}
              {row.status === "active"
                ? "läuft"
                : row.status === "paused"
                  ? "pausiert"
                  : row.status === "break"
                    ? "Pause"
                    : "beendet"}{" "}
              · Pause:{" "}
              {row.break_taken
                ? "eingehalten"
                : row.break_ended_at
                  ? "verkürzt"
                  : "offen"}
              {row.break_overrun ? " · überzogen" : ""}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
export function DailyValues({ state: s, date, now, save, busy }: Props) {
  const p = preferences(s),
    entries = coffeeForDay(s, date),
    today = localClock(now, s.profile.timezone).date === date;
  const last = entries.at(-1);
  return (
    <section className="card daily-values">
      <span className="eyebrow">STABILITÄT · DEINE TAGESWERTE</span>
      <div className="metric-summary">
        <strong>
          Kaffee {entries.length} / {p.coffee_limit}
          <small>
            Letzter:{" "}
            {last
              ? localClock(new Date(last.consumed_at), s.profile.timezone).time
              : "—"}
          </small>
        </strong>
        <button
          className="secondary"
          disabled={busy || !today}
          onClick={() => save({ type: "coffee-add", date })}
        >
          +1 Kaffee
        </button>
      </div>
      {last && (
        <details>
          <summary>Kaffee-Uhrzeiten</summary>
          <p className="small">
            {entries
              .map(
                (e) =>
                  localClock(new Date(e.consumed_at), s.profile.timezone).time,
              )
              .join(" · ")}
          </p>
        </details>
      )}
      {p.coffee_rule &&
        today &&
        localClock(now, s.profile.timezone).time >= p.coffee_cutoff && (
          <p className="muted">
            Dein Kaffee-Zeitfenster ist für heute beendet.
          </p>
        )}
      {entries.length > p.coffee_limit && (
        <p className="muted">
          Heute sind mehr Kaffees erfasst als dein eingestelltes Tageslimit.
        </p>
      )}
      {(["calories", "protein", "movement_minutes"] as const).map((type) => {
        const m = s.daily_metrics.find(
          (m) => m.date === date && m.metric_type === type,
        );
        const title =
            type === "calories"
              ? "Kalorien"
              : type === "protein"
                ? "Protein"
                : "Bewegung",
          unit =
            type === "calories" ? "kcal" : type === "protein" ? "g" : "min";
        const target =
          type === "calories"
            ? p.calories_target
            : type === "protein"
              ? p.protein_target
              : null;
        return (
          <div className="daily-value" key={type}>
            <h3>
              {title} {m ? m.value.toLocaleString("de-DE") : "—"}
              {target !== null
                ? ` / ${target.toLocaleString("de-DE")}`
                : ""}{" "}
              {unit}
            </h3>
            <form
              key={`${date}-${type}`}
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await save({
                  type: "metric",
                  date,
                  metric_type: type,
                  value: Number(f.get("value")),
                  source: "manual",
                });
              }}
            >
              <label>
                {title} · Tageswert
                <input
                  name="value"
                  type="number"
                  min={0}
                  max={20000}
                  step="any"
                  required
                  defaultValue={m?.value ?? ""}
                />
              </label>
              <button disabled={busy} className="secondary">
                {title} speichern
              </button>
            </form>
            {m && (
              <small className="muted">
                Quelle: {m.source === "manual" ? "manuell" : m.source}
              </small>
            )}
          </div>
        );
      })}
    </section>
  );
}
export function FocusGoals({ state: s }: { state: State }) {
  const rows = s.goals
    .filter((g) => g.status === "active" && g.is_focus)
    .sort((a, b) => a.priority - b.priority);
  return (
    <section className="card">
      <span className="eyebrow">FOKUS-ZIELE</span>
      {rows.slice(0, 5).map((g) => (
        <div className="focus-goal" key={g.id}>
          <Link href={`/goals/${g.id}`}>
            <h3>{g.title} →</h3>
          </Link>
          <p className="muted">
            {nextStep(s, g.id)?.title ||
              "Noch kein nächster Schritt verknüpft."}
          </p>
        </div>
      ))}
      {!rows.length && (
        <p className="muted">
          Markiere ein Ziel als Fokus. Sein nächster Schritt erscheint hier.
        </p>
      )}
      {rows.length > 5 && (
        <p className="muted">
          {rows.length} Fokus-Ziele sind aktiv. Die fünf wichtigsten erscheinen
          hier.
        </p>
      )}
    </section>
  );
}
export function StabilityHints({
  state,
  date,
  now,
}: Pick<Props, "state" | "date" | "now">) {
  return (
    <>
      {stabilityHints(state, date, now)
        .filter((h) => !h.includes("Kaffee"))
        .map((h) => (
          <section key={h} className="card intervention" role="status">
            <span className="eyebrow">ZEIT FÜR STABILITÄT</span>
            <p>{h}</p>
          </section>
        ))}
    </>
  );
}
export function PreferenceFields({ settings: p }: { settings: Preferences }) {
  const [tone, setTone] = useState<AlarmTone>(p.alarm_tone),
    [volume, setVolume] = useState(p.alarm_volume),
    [audioStatus, setAudioStatus] = useState("");
  const numeric: Array<[keyof Preferences, string, number, number]> = [
    ["coffee_limit", "Kaffee-Tageslimit", 0, 20],
    ["focus_minutes", "Fokusblock · Minuten", 0.1, 240],
    ["break_minutes", "Pause · Minuten", 5, 60],
    ["calories_target", "Kalorienziel · kcal", 0, 10000],
    ["protein_target", "Proteinziel · g (optional)", 0, 500],
  ];
  return (
    <section className="card">
      <h3>Deine Stabilität</h3>
      <div className="form-grid">
        {(
          [
            ["wake_weekday", "Aufstehzeit Werktage"],
            ["wake_weekend", "Aufstehzeit Wochenende"],
            ["coffee_cutoff", "Kaffee-Cutoff"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input type="time" name={key} required defaultValue={p[key]} />
          </label>
        ))}
        {numeric.map(([key, label, min, max]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              name={key}
              min={min}
              max={max}
              step={key === "focus_minutes" ? "any" : 1}
              required={key !== "protein_target"}
              defaultValue={(p[key] as number) ?? ""}
            />
          </label>
        ))}
        <label>
          Theme
          <select name="theme" defaultValue={p.theme}>
            <option value="dark">Dunkel</option>
            <option value="light">Hell</option>
            <option value="system">System</option>
          </select>
        </label>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          name="training_enabled"
          defaultChecked={p.training_enabled}
        />
        Trainingsmodul aktiv
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          name="alarm_enabled"
          defaultChecked={p.alarm_enabled}
        />
        Fokus-Hinweiston aktiv
      </label>
      <label>
        Klingelton
        <select
          name="alarm_tone"
          value={tone}
          onChange={(e) => setTone(e.target.value as AlarmTone)}
        >
          {alarmTones.map((t) => (
            <option key={t} value={t}>
              {t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Lautstärke
        <input
          type="range"
          name="alarm_volume"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      </label>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          void unlockAudio()
            .then(() =>
              setAudioStatus(
                playTone(tone, volume)
                  ? `Ton abgespielt · ${tone}`
                  : "Ton ist stumm oder vom Browser gesperrt.",
              ),
            )
            .catch(() => setAudioStatus("Ton ist vom Browser gesperrt."));
        }}
      >
        Ton testen
      </button>
      <p className="small" role="status">
        {audioStatus}
      </p>
      <label className="checkbox-label">
        <input
          type="checkbox"
          name="coffee_rule"
          defaultChecked={p.coffee_rule}
        />
        Kaffee-Hinweis
      </label>
      <label className="checkbox-label">
        <input type="checkbox" name="work_rule" defaultChecked={p.work_rule} />
        Fokus- und Pausenhinweise
      </label>
    </section>
  );
}
