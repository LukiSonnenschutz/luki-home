import { z } from "zod";
import type { State, Task } from "./model";
import { localClock } from "./time";
import { upgradeTraining } from "./training";

export const categories = [
  "Gesundheit & Körper",
  "Beziehung & Familie",
  "Firma",
  "Abenteuer",
  "Persönliche Entwicklung",
  "Sonstiges",
] as const;
export const goalStatuses = [
  "active",
  "paused",
  "achieved",
  "discarded",
] as const;
export const statusLabels = {
  active: "aktiv",
  paused: "pausiert",
  achieved: "erreicht",
  discarded: "verworfen",
};
export const preferenceSchema = z.object({
  wake_weekday: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  wake_weekend: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  coffee_limit: z.number().int().min(0).max(20),
  coffee_cutoff: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  focus_minutes: z.number().min(0.1).max(240),
  training_enabled: z.boolean().default(true),
  alarm_tone: z.enum(["bell", "digital", "soft", "alert"]).default("bell"),
  alarm_volume: z.number().min(0).max(1).default(0.5),
  alarm_enabled: z.boolean().default(true),
  break_minutes: z.number().int().min(5).max(60),
  calories_target: z.number().int().min(0).max(10000),
  protein_target: z.number().int().min(0).max(500).nullable(),
  theme: z.enum(["dark", "light", "system"]),
  coffee_rule: z.boolean(),
  work_rule: z.boolean(),
});
export type Preferences = z.infer<typeof preferenceSchema>;
export const defaultPreferences: Preferences = {
  wake_weekday: "08:00",
  wake_weekend: "09:00",
  coffee_limit: 3,
  coffee_cutoff: "13:00",
  focus_minutes: 75,
  break_minutes: 15,
  calories_target: 2500,
  protein_target: 160,
  theme: "dark",
  coffee_rule: true,
  work_rule: true,
  training_enabled: true,
  alarm_tone: "bell",
  alarm_volume: 0.5,
  alarm_enabled: true,
};
export interface Goal {
  id: string;
  user_id: string;
  title: string;
  why: string;
  success_criteria: string;
  category: (typeof categories)[number];
  priority: number;
  status: (typeof goalStatuses)[number];
  is_focus: boolean;
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface Milestone {
  id: string;
  user_id: string;
  goal_id: string;
  title: string;
  description: string;
  status: "open" | "done";
  due_date: string | null;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface CoffeeEntry {
  id: string;
  user_id: string;
  consumed_at: string;
  created_at: string;
}
export interface DailyMetric {
  id: string;
  user_id: string;
  date: string;
  metric_type: "calories" | "protein" | "movement_minutes" | "caffeine_count";
  value: number;
  target: number | null;
  unit: string;
  source: "manual" | "health" | "external";
  created_at: string;
  updated_at: string;
}
export interface WorkSession {
  planned_seconds?: number | null;
  completed_by_timer?: boolean;
  was_reset?: boolean;
  id: string;
  user_id: string;
  local_date: string;
  started_at: string;
  ended_at: string | null;
  planned_minutes: number;
  planned_break_minutes: number;
  elapsed_seconds: number;
  focus_started_at: string | null;
  status: "active" | "paused" | "break" | "done";
  break_started_at: string | null;
  break_ended_at: string | null;
  break_taken: boolean;
  break_overrun: boolean;
  actual_minutes: number;
  created_at: string;
  updated_at: string;
}
/** Additive read migration: old payloads retain every original row and value. */
export function upgradeState(s: State): State {
  s.goals ??= [];
  s.goal_milestones ??= [];
  s.coffee_entries ??= [];
  s.work_sessions ??= [];
  s.daily_metrics ??= [];
  s.settings.preferences = {
    ...defaultPreferences,
    wake_weekday:
      s.anchor_definitions.find((a) => a.key === "wake_up")?.target_time ||
      "08:00",
    ...s.settings.preferences,
  };
  return upgradeTraining(s);
}
export function preferences(s: State): Preferences {
  return { ...defaultPreferences, ...s.settings.preferences };
}
export function wakeTarget(s: State, date: string): string {
  return [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())
    ? preferences(s).wake_weekend
    : preferences(s).wake_weekday;
}
export function focusSeconds(w: WorkSession, now: Date) {
  return (
    w.elapsed_seconds +
    (w.status === "active" && w.focus_started_at
      ? Math.max(
          0,
          (now.getTime() - new Date(w.focus_started_at).getTime()) / 1000,
        )
      : 0)
  );
}
export function plannedSeconds(w: WorkSession) {
  return w.planned_seconds ?? w.planned_minutes * 60;
}
/** Computes the deadline from persisted elapsed time, not interval ticks. */
export function expireWork(s: State, now: Date) {
  const w = s.work_sessions.find(
    (w) => w.status === "active" && w.focus_started_at,
  );
  if (!w || focusSeconds(w, now) < plannedSeconds(w)) return false;
  const deadline = new Date(
    new Date(w.focus_started_at!).getTime() +
      Math.max(0, plannedSeconds(w) - w.elapsed_seconds) * 1000,
  ).toISOString();
  const elapsed = Math.max(plannedSeconds(w), w.elapsed_seconds);
  Object.assign(w, {
    elapsed_seconds: elapsed,
    actual_minutes: elapsed / 60,
    focus_started_at: null,
    status: "done",
    ended_at: deadline,
    completed_by_timer: true,
    updated_at: now.toISOString(),
  });
  return true;
}
export function nextStep(s: State, goalId: string): Task | undefined {
  return s.tasks
    .filter((t) => t.goal_id === goalId && t.status === "open")
    .sort(
      (a, b) =>
        (a.due_date || "9999").localeCompare(b.due_date || "9999") ||
        a.created_at.localeCompare(b.created_at),
    )[0];
}
export function coffeeForDay(s: State, date: string) {
  return s.coffee_entries.filter(
    (c) =>
      localClock(new Date(c.consumed_at), s.profile.timezone).date === date,
  );
}
export function stabilityHints(s: State, date: string, now: Date): string[] {
  const p = preferences(s),
    clock = localClock(now, s.profile.timezone);
  if (date !== clock.date) return [];
  const hints: string[] = [];
  const w = s.work_sessions.find((w) => w.status === "active");
  if (p.work_rule && w && focusSeconds(w, now) >= plannedSeconds(w))
    hints.push(
      focusSeconds(w, now) >= plannedSeconds(w) + 900
        ? "Du sitzt gerade wieder zu lange am Bildschirm. Beende den Block und mach jetzt eine echte Pause."
        : "Fokusblock beendet. Jetzt weg vom Bildschirm und eine echte Pause machen.",
    );
  if (p.coffee_rule && clock.time >= p.coffee_cutoff)
    hints.push("Dein Kaffee-Zeitfenster ist für heute beendet.");
  return hints;
}
