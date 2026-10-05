"use client";
import { useEffect, useRef, useState } from "react";
import type { State } from "@/lib/model";
import { focusSeconds, plannedSeconds, preferences } from "@/lib/stability";
import { playTone, unlockAudio } from "@/lib/audio";
export default function FocusAlarm({
  state,
  now,
  refresh,
}: {
  state: State;
  now: Date;
  refresh: () => Promise<void>;
}) {
  const [ready, setReady] = useState(false),
    [played, setPlayed] = useState(""),
    [dismissed, setDismissed] = useState(""),
    handled = useRef(new Set<string>()),
    refreshing = useRef<string | null>(null);
  const p = preferences(state),
    running = state.work_sessions.find((w) => w.status === "active"),
    latest = [...state.work_sessions].sort((a, b) =>
      b.started_at.localeCompare(a.started_at),
    )[0],
    ended =
      latest?.completed_by_timer &&
      !latest.was_reset &&
      !latest.break_started_at &&
      latest.status === "done"
        ? latest
        : undefined;
  useEffect(() => {
    const activate = () => {
      void unlockAudio()
        .then(setReady)
        .catch(() => setReady(false));
    };
    window.addEventListener("pointerdown", activate);
    window.addEventListener("keydown", activate);
    return () => {
      window.removeEventListener("pointerdown", activate);
      window.removeEventListener("keydown", activate);
    };
  }, []);
  useEffect(() => {
    if (!running) return;
    const remaining = plannedSeconds(running) - focusSeconds(running, now);
    if (remaining > 0 || refreshing.current === running.id) return;
    refreshing.current = running.id;
    void refresh().finally(() => {
      refreshing.current = null;
    });
  }, [running, now, refresh]);
  useEffect(() => {
    if (!ended || !p.alarm_enabled || !ready || p.alarm_volume === 0) return;
    const key = `luki-home-alarm:${state.profile.user_id}:${ended.id}`;
    if (handled.current.has(key)) return;
    try {
      if (localStorage.getItem(key)) return;
    } catch {}
    handled.current.add(key);
    if (playTone(p.alarm_tone, p.alarm_volume)) {
      try {
        localStorage.setItem(key, "played");
      } catch {}
      queueMicrotask(() => setPlayed(ended.id));
    } else handled.current.delete(key);
  }, [
    ended,
    p.alarm_enabled,
    p.alarm_tone,
    p.alarm_volume,
    ready,
    state.profile.user_id,
  ]);
  if (!ended || dismissed === ended.id) return null;
  return (
    <section className="card focus-alarm" role="status">
      <h2>Fokusblock beendet</h2>
      <button className="text-button" onClick={() => setDismissed(ended.id)}>
        Meldung schließen
      </button>
      <p>Jetzt Bildschirm verlassen und eine echte Pause machen.</p>
      {played === ended.id && (
        <p className="small">Hinweiston abgespielt · {p.alarm_tone}</p>
      )}
      {p.alarm_enabled && !ready && (
        <button
          className="secondary"
          onClick={() => {
            void unlockAudio()
              .then(setReady)
              .catch(() => setReady(false));
          }}
        >
          Ton aktivieren
        </button>
      )}
    </section>
  );
}
