import {
  type State,
  type Command,
  type Intervention,
  type RuleId,
} from "./model";
import { localClock } from "./time";
import { upgradeState, wakeTarget } from "./stability";
import { applyStabilityCommand } from "./stability-commands";
import { applyTrainingCommand } from "./training-commands";

export function ensureDay(s: State, date: string) {
  upgradeState(s);
  const uid = s.profile.user_id;
  let plan = s.day_plans.find((d) => d.local_date === date);
  if (!plan) {
    plan = {
      id: crypto.randomUUID(),
      user_id: uid,
      local_date: date,
      focus_text: "",
      focus_task_id: null,
      training_note: "",
      training_time: null,
      highlights: [],
    };
    s.day_plans.push(plan);
    for (const a of s.anchor_definitions.filter((a) => a.enabled))
      s.anchor_entries.push({
        id: crypto.randomUUID(),
        user_id: uid,
        anchor_id: a.id,
        local_date: date,
        status: "pending",
        actual_local_time: null,
        recorded_at: null,
        note: "",
        label_snapshot: a.label,
        description_snapshot: a.description,
      });
  }
  return plan;
}

export const ruleDefinitions: {
  id: RuleId;
  key: string;
  priority: number;
  message: string;
}[] = [
  {
    id: "wake_up_late",
    key: "wake_up",
    priority: 20,
    message:
      "Du bist heute später gestartet als geplant. Starte mit dem nächsten kleinen Schritt deiner Morgenroutine.",
  },
  {
    id: "movement_missing",
    key: "morning_movement",
    priority: 30,
    message:
      "Du warst heute noch nicht wirklich in Bewegung. 20–30 Minuten Fahrrad oder Spaziergang reichen.",
  },
  {
    id: "work_end_due",
    key: "work_end",
    priority: 10,
    message:
      "Dein Arbeitstag sollte jetzt enden. Offene Aufgaben können morgen weitergehen.",
  },
];

export function evaluateRules(
  s: State,
  date: string,
  now: Date,
): Intervention | null {
  const clock = localClock(now, s.profile.timezone);
  if (date !== clock.date) return null;
  const candidates: { event: Intervention; priority: number }[] = [];
  for (const r of ruleDefinitions) {
    const a = s.anchor_definitions.find((a) => a.key === r.key);
    const e =
      a &&
      s.anchor_entries.find(
        (e) => e.anchor_id === a.id && e.local_date === date,
      );
    const target =
      r.id === "wake_up_late"
        ? wakeTarget(s, date)
        : r.id === "movement_missing"
          ? s.settings.movement_time
          : s.settings.work_end_target;
    if (
      !s.settings.rules[r.id] ||
      !a?.enabled ||
      !e ||
      e.status !== "pending" ||
      !target
    )
      continue;
    if (
      r.id === "movement_missing" &&
      s.daily_metrics.some(
        (m) =>
          m.date === date &&
          m.metric_type === "movement_minutes" &&
          m.value > 0,
      )
    )
      continue;
    if (r.id === "wake_up_late" ? clock.time <= target : clock.time < target)
      continue;
    let event = s.intervention_events.find(
      (i) => i.local_date === date && i.rule_id === r.id,
    );
    if (!event) {
      event = {
        id: crypto.randomUUID(),
        user_id: s.profile.user_id,
        local_date: date,
        rule_id: r.id,
        rule_version: 1,
        message_snapshot: r.message,
        first_shown_at: null,
        snoozed_until: null,
        dismissed_at: null,
      };
      s.intervention_events.push(event);
    }
    if (
      event.dismissed_at ||
      (event.snoozed_until && new Date(event.snoozed_until) > now)
    )
      continue;
    candidates.push({ event, priority: r.priority });
  }
  candidates.sort(
    (a, b) =>
      a.priority - b.priority || a.event.rule_id.localeCompare(b.event.rule_id),
  );
  const event = candidates[0]?.event ?? null;
  if (event && !event.first_shown_at) event.first_shown_at = now.toISOString();
  return event;
}

export function applyCommand(s: State, c: Command, now: Date) {
  const stamp = now.toISOString();
  const plan = ensureDay(s, c.date);
  if (applyTrainingCommand(s, c, now)) return;
  if (applyStabilityCommand(s, c, now)) return;
  if (
    (c.type === "task-create" || c.type === "task-edit") &&
    c.goal_id &&
    !s.goals.some((g) => g.id === c.goal_id)
  )
    throw new Error("Ziel nicht gefunden.");
  const task = (id: string) => {
    const t = s.tasks.find((t) => t.id === id);
    if (!t) throw new Error("Aufgabe nicht gefunden.");
    return t;
  };
  switch (c.type) {
    case "day":
      if (c.focus_task_id) task(c.focus_task_id);
      Object.assign(plan, {
        focus_text: c.focus_text,
        focus_task_id: c.focus_task_id,
        training_note: c.training_note,
        training_time: c.training_time,
      });
      break;
    case "task-create":
      s.tasks.push({
        goal_id: c.goal_id || null,
        id: crypto.randomUUID(),
        user_id: s.profile.user_id,
        title: c.title,
        notes: c.notes,
        due_date: c.due_date,
        status: "open",
        completed_at: null,
        created_at: stamp,
        updated_at: stamp,
      });
      break;
    case "task-edit":
      Object.assign(task(c.id), {
        goal_id:
          c.goal_id === undefined ? task(c.id).goal_id || null : c.goal_id,
        title: c.title,
        notes: c.notes,
        due_date: c.due_date,
        updated_at: stamp,
      });
      break;
    case "task-status":
      Object.assign(task(c.id), {
        status: c.status,
        completed_at: c.status === "done" ? stamp : null,
        updated_at: stamp,
      });
      break;
    case "task-delete":
      task(c.id);
      s.tasks = s.tasks.filter((t) => t.id !== c.id);
      for (const d of s.day_plans) {
        d.highlights = d.highlights.filter((id) => id !== c.id);
        if (d.focus_task_id === c.id) d.focus_task_id = null;
      }
      break;
    case "highlight":
      task(c.id);
      if (c.enabled && !plan.highlights.includes(c.id)) {
        if (plan.highlights.length >= 3)
          throw new Error("Du kannst höchstens drei Aufgaben hervorheben.");
        plan.highlights.push(c.id);
      }
      if (!c.enabled)
        plan.highlights = plan.highlights.filter((id) => id !== c.id);
      break;
    case "anchor": {
      const e = s.anchor_entries.find(
        (e) => e.id === c.id && e.local_date === c.date,
      );
      if (!e) throw new Error("Anker nicht gefunden.");
      Object.assign(e, {
        status: c.status,
        actual_local_time: c.actual_local_time,
        note: c.note,
        recorded_at: c.status === "pending" ? null : stamp,
      });
      break;
    }
    case "checkin": {
      if (
        c.submit &&
        (c.energy === null || c.mood === null || c.stress === null)
      )
        throw new Error("Bitte alle drei Bewertungen auswählen.");
      let e = s.checkins.find((e) => e.local_date === c.date);
      if (!e) {
        e = {
          id: crypto.randomUUID(),
          user_id: s.profile.user_id,
          local_date: c.date,
          energy: null,
          mood: null,
          stress: null,
          helped_text: "",
          tomorrow_text: "",
          submitted_at: null,
          updated_at: stamp,
          created_at: stamp,
        };
        s.checkins.push(e);
      }
      Object.assign(e, {
        movement_done: c.movement_done ?? e.movement_done ?? false,
        training_done: c.training_done ?? e.training_done ?? false,
        work_end_kept: c.work_end_kept ?? e.work_end_kept ?? false,
        energy: c.energy,
        mood: c.mood,
        stress: c.stress,
        helped_text: c.helped_text,
        tomorrow_text: c.tomorrow_text,
        submitted_at: c.submit ? stamp : null,
        updated_at: stamp,
      });
      break;
    }
    case "intervention": {
      if (c.date !== localClock(now, s.profile.timezone).date)
        throw new Error("Hinweise gelten nur für heute.");
      const e = s.intervention_events.find(
        (e) => e.id === c.id && e.local_date === c.date,
      );
      if (!e) throw new Error("Hinweis nicht gefunden.");
      if (c.action === "snooze")
        e.snoozed_until = new Date(now.getTime() + 30 * 60_000).toISOString();
      else e.dismissed_at = stamp;
      break;
    }
    case "settings":
      if (
        new Set(c.anchors.map((a) => a.id)).size !== 5 ||
        c.anchors.some((a) => !s.anchor_definitions.some((d) => d.id === a.id))
      )
        throw new Error("Ungültige Ankerkonfiguration.");
      Object.assign(s.profile, {
        display_name: c.display_name,
        timezone: c.timezone,
      });
      Object.assign(s.settings, {
        preferences: c.preferences || s.settings.preferences,
        work_end_target: c.work_end_target,
        movement_time: c.movement_time,
        checkin_time: c.checkin_time,
        rules: c.rules,
      });
      for (const a of c.anchors)
        Object.assign(
          s.anchor_definitions.find((d) => d.id === a.id)!,
          {
            enabled: a.enabled,
            description: a.description,
            target_time: a.target_time,
          },
        );
      break;
  }
}
