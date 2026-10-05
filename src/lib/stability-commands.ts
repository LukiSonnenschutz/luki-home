import type { State, Command } from "./model";
import {
  coffeeForDay,
  focusSeconds,
  expireWork,
  preferences,
} from "./stability";
import { localClock } from "./time";

export function applyStabilityCommand(
  s: State,
  c: Command,
  now: Date,
): boolean {
  const stamp = now.toISOString(),
    uid = s.profile.user_id,
    p = preferences(s);
  const goal = (id: string) => {
    const g = s.goals.find((g) => g.id === id);
    if (!g) throw new Error("Ziel nicht gefunden.");
    return g;
  };
  const milestone = (id: string) => {
    const m = s.goal_milestones.find((m) => m.id === id);
    if (!m) throw new Error("Meilenstein nicht gefunden.");
    return m;
  };
  switch (c.type) {
    case "goal-save": {
      if (c.start_date && c.target_date && c.start_date > c.target_date)
        throw new Error("Zieldatum liegt vor dem Startdatum.");
      const fields = {
        title: c.title,
        why: c.why,
        success_criteria: c.success_criteria,
        category: c.category,
        priority: c.priority,
        status: c.status,
        is_focus: c.is_focus,
        start_date: c.start_date,
        target_date: c.target_date,
        updated_at: stamp,
      };
      if (c.id) {
        const g = goal(c.id);
        Object.assign(g, fields, {
          completed_at:
            c.status === "achieved" ? g.completed_at || stamp : null,
        });
      } else
        s.goals.push({
          id: crypto.randomUUID(),
          user_id: uid,
          ...fields,
          completed_at: c.status === "achieved" ? stamp : null,
          created_at: stamp,
        });
      return true;
    }
    case "goal-status":
      Object.assign(goal(c.id), {
        status: c.status,
        completed_at:
          c.status === "achieved" ? goal(c.id).completed_at || stamp : null,
        updated_at: stamp,
      });
      return true;
    case "goal-focus":
      Object.assign(goal(c.id), { is_focus: c.enabled, updated_at: stamp });
      return true;
    case "milestone-save": {
      goal(c.goal_id);
      if (c.id) {
        const m = milestone(c.id);
        if (m.goal_id !== c.goal_id)
          throw new Error("Ungültige Zielzuordnung.");
        Object.assign(m, {
          title: c.title,
          description: c.description,
          due_date: c.due_date,
          updated_at: stamp,
        });
      } else
        s.goal_milestones.push({
          id: crypto.randomUUID(),
          user_id: uid,
          goal_id: c.goal_id,
          title: c.title,
          description: c.description,
          due_date: c.due_date,
          status: "open",
          sort_order:
            Math.max(
              -1,
              ...s.goal_milestones
                .filter((m) => m.goal_id === c.goal_id)
                .map((m) => m.sort_order),
            ) + 1,
          completed_at: null,
          created_at: stamp,
          updated_at: stamp,
        });
      return true;
    }
    case "milestone-status":
      Object.assign(milestone(c.id), {
        status: c.status,
        completed_at: c.status === "done" ? stamp : null,
        updated_at: stamp,
      });
      return true;
    case "milestone-order": {
      goal(c.goal_id);
      const rows = s.goal_milestones.filter((m) => m.goal_id === c.goal_id);
      if (
        new Set(c.ids).size !== rows.length ||
        c.ids.length !== rows.length ||
        rows.some((m) => !c.ids.includes(m.id))
      )
        throw new Error("Ungültige Sortierung.");
      c.ids.forEach((id, i) =>
        Object.assign(milestone(id), { sort_order: i, updated_at: stamp }),
      );
      return true;
    }
    case "coffee-add": {
      if (c.date !== localClock(now, s.profile.timezone).date)
        throw new Error("Kaffee wird für heute erfasst.");
      s.coffee_entries.push({
        id: crypto.randomUUID(),
        user_id: uid,
        consumed_at: stamp,
        created_at: stamp,
      });
      setMetric(
        s,
        c.date,
        "caffeine_count",
        coffeeForDay(s, c.date).length,
        p.coffee_limit,
        "Kaffee",
        "manual",
        stamp,
      );
      return true;
    }
    case "metric": {
      const target =
        c.metric_type === "calories"
          ? p.calories_target
          : c.metric_type === "protein"
            ? p.protein_target
            : null;
      setMetric(
        s,
        c.date,
        c.metric_type,
        c.value,
        target,
        c.metric_type === "calories"
          ? "kcal"
          : c.metric_type === "protein"
            ? "g"
            : "min",
        c.source,
        stamp,
      );
      return true;
    }
    case "training-status": {
      const d = s.day_plans.find((d) => d.local_date === c.date)!;
      d.training_status = c.status;
      return true;
    }
    case "work": {
      if (c.date !== localClock(now, s.profile.timezone).date)
        throw new Error("Der Work-Tracker gilt für heute.");
      const expired = expireWork(s, now);
      if (expired && ["pause", "resume", "end", "reset"].includes(c.action))
        return true;
      const running = s.work_sessions.find((w) => w.status !== "done");
      if (c.action === "start") {
        if (running)
          throw new Error("Beende zuerst den laufenden Block oder die Pause.");
        s.work_sessions.push({
          id: crypto.randomUUID(),
          user_id: uid,
          local_date: c.date,
          started_at: stamp,
          ended_at: null,
          planned_minutes: Math.max(5, Math.ceil(p.focus_minutes)),
          planned_seconds: Math.round(p.focus_minutes * 60),
          completed_by_timer: false,
          was_reset: false,
          planned_break_minutes: p.break_minutes,
          elapsed_seconds: 0,
          focus_started_at: stamp,
          status: "active",
          break_started_at: null,
          break_ended_at: null,
          break_taken: false,
          break_overrun: false,
          actual_minutes: 0,
          created_at: stamp,
          updated_at: stamp,
        });
        return true;
      }
      const w =
        running ||
        (c.action === "break-start"
          ? [...s.work_sessions]
              .reverse()
              .find((w) => w.local_date === c.date && !w.break_started_at)
          : undefined);
      if (!w) throw new Error("Kein passender Fokusblock vorhanden.");
      const allowed =
        c.action === "pause"
          ? w.status === "active"
          : c.action === "resume"
            ? w.status === "paused"
            : c.action === "break-end"
              ? w.status === "break"
              : c.action === "break-start"
                ? w.status !== "break" && !w.break_started_at
                : w.status === "active" || w.status === "paused";
      if (!allowed)
        throw new Error(
          "Diese Aktion passt nicht zum aktuellen Tracker-Status.",
        );
      if (
        c.action === "pause" ||
        c.action === "end" ||
        c.action === "reset" ||
        c.action === "break-start"
      ) {
        w.elapsed_seconds = focusSeconds(w, now);
        w.focus_started_at = null;
        w.actual_minutes = w.elapsed_seconds / 60;
      }
      if (c.action === "pause") w.status = "paused";
      if (c.action === "resume") {
        w.status = "active";
        w.focus_started_at = stamp;
      }
      if (c.action === "end" || c.action === "reset") {
        w.status = "done";
        w.ended_at = stamp;
        w.was_reset = c.action === "reset";
      }
      if (c.action === "break-start") {
        w.status = "break";
        w.ended_at ??= stamp;
        w.break_started_at = stamp;
      }
      if (c.action === "break-end") {
        const minutes =
          (now.getTime() - new Date(w.break_started_at!).getTime()) / 60000;
        w.break_taken = minutes >= w.planned_break_minutes;
        w.break_overrun = minutes > w.planned_break_minutes + 5;
        w.break_ended_at = stamp;
        w.status = "done";
      }
      w.updated_at = stamp;
      return true;
    }
    default:
      return false;
  }
}
function setMetric(
  s: State,
  date: string,
  metric_type: State["daily_metrics"][number]["metric_type"],
  value: number,
  target: number | null,
  unit: string,
  source: "manual" | "external" | "health",
  stamp: string,
) {
  const existing = s.daily_metrics.find(
    (m) => m.date === date && m.metric_type === metric_type,
  );
  if (existing)
    Object.assign(existing, { value, target, unit, source, updated_at: stamp });
  else
    s.daily_metrics.push({
      id: crypto.randomUUID(),
      user_id: s.profile.user_id,
      date,
      metric_type,
      value,
      target,
      unit,
      source,
      created_at: stamp,
      updated_at: stamp,
    });
}
