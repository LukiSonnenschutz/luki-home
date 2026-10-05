import type { State, Command } from "./model";
import {
  alive,
  ordered,
  sessionSets,
  type TrainingCommand,
  type TemplateItem,
  type SessionItem,
  type WorkoutTemplate,
} from "./training";
import { localClock } from "./time";
export function applyTrainingCommand(
  s: State,
  input: Command,
  now: Date,
): boolean {
  if (!input.type.startsWith("training-")) return false;
  // The existing 0.2 day-status command remains owned by the stability module.
  if (input.type === "training-status") return false;
  const c = input as TrainingCommand,
    stamp = now.toISOString(),
    uid = s.profile.user_id;
  const meta = () => ({
    id: crypto.randomUUID(),
    user_id: uid,
    created_at: stamp,
    updated_at: stamp,
    deleted_at: null,
  });
  const find = <T extends { id: string; deleted_at: string | null }>(
    rows: T[],
    id: string,
  ): T => {
    const r = rows.find((x) => x.id === id && !x.deleted_at);
    if (!r) throw new Error("Trainingseintrag nicht gefunden.");
    return r;
  };
  const session = (id: string) => {
    const r = find(s.workout_sessions, id);
    if (r.status !== "active")
      throw new Error("Abgeschlossene Sessions bleiben unverändert.");
    return r;
  };
  const template = (id: string) => find(s.workout_templates, id);
  function addSets(item: SessionItem) {
    const count =
      item.item_type === "strength"
        ? item.targets.sets || 1
        : item.targets.rounds || 1;
    const existing = sessionSets(s, item.id);
    for (let i = 1; i <= count; i++) {
      if (!existing.some((x) => x.set_number === i))
        s.workout_sets.push({
          ...meta(),
          session_item_id: item.id,
          set_number: i,
          weight: null,
          reps: null,
          distance: null,
          duration: null,
          rpe: null,
          rir: null,
          notes: "",
          completed: false,
        });
    }
    for (const r of existing.filter((x) => x.set_number > count)) {
      r.deleted_at = stamp;
      r.updated_at = stamp;
    }
  }
  function copyTemplate(
    t: WorkoutTemplate,
    planId: string | null = t.training_plan_id,
  ) {
    const copy = {
      ...t,
      ...meta(),
      name: t.name.slice(0, 192) + " · Kopie",
      training_plan_id: planId,
      sort_order: s.workout_templates.filter(
        (x) => x.training_plan_id === planId && !x.deleted_at,
      ).length,
    };
    s.workout_templates.push(copy);
    for (const item of alive(s.workout_template_items).filter(
      (x) => x.workout_template_id === t.id,
    ))
      s.workout_template_items.push({
        ...structuredClone(item),
        ...meta(),
        workout_template_id: copy.id,
      });
    return copy;
  }
  switch (c.type) {
    case "training-plan-save": {
      const p = c.id ? find(s.training_plans, c.id) : null;
      const week = c.week || p?.week || [];
      if (
        week.some(
          (w) =>
            !s.workout_templates.some(
              (t) =>
                t.id === w.template_id &&
                t.training_plan_id === c.id &&
                !t.deleted_at,
            ),
        )
      )
        throw new Error("Wochenstruktur enthält eine fremde Vorlage.");
      if (p)
        Object.assign(p, {
          name: c.name,
          description: c.description,
          week,
          updated_at: stamp,
        });
      else
        s.training_plans.push({
          ...meta(),
          name: c.name,
          description: c.description,
          week,
          is_active: true,
          sort_order: alive(s.training_plans).length,
        });
      break;
    }
    case "training-plan-action": {
      const p = find(s.training_plans, c.id);
      if (c.action === "duplicate") {
        const copy = {
          ...structuredClone(p),
          ...meta(),
          name: p.name.slice(0, 192) + " · Kopie",
          sort_order: alive(s.training_plans).length,
          week: [] as typeof p.week,
        };
        s.training_plans.push(copy);
        const mapping = new Map<string, string>();
        for (const t of alive(s.workout_templates).filter(
          (x) => x.training_plan_id === p.id,
        ))
          mapping.set(t.id, copyTemplate(t, copy.id).id);
        copy.week = p.week.map((w) => ({
          ...w,
          template_id: mapping.get(w.template_id)!,
        }));
      } else if (c.action === "delete") {
        p.deleted_at = stamp;
        p.week = [];
        for (const t of s.workout_templates.filter(
          (x) => x.training_plan_id === p.id,
        )) {
          t.training_plan_id = null;
          t.updated_at = stamp;
        }
      } else p.is_active = c.action === "activate";
      p.updated_at = stamp;
      break;
    }
    case "training-template-save": {
      if (c.training_plan_id) find(s.training_plans, c.training_plan_id);
      if (c.id) {
        const t = template(c.id);
        Object.assign(t, {
          name: c.name,
          description: c.description,
          workout_type: c.workout_type,
          training_plan_id: c.training_plan_id,
          updated_at: stamp,
        });
        for (const p of s.training_plans)
          p.week = p.week.filter(
            (w) => w.template_id !== t.id || p.id === t.training_plan_id,
          );
      } else
        s.workout_templates.push({
          ...meta(),
          name: c.name,
          description: c.description,
          workout_type: c.workout_type,
          training_plan_id: c.training_plan_id,
          sort_order: alive(s.workout_templates).filter(
            (x) => x.training_plan_id === c.training_plan_id,
          ).length,
          archived: false,
        });
      break;
    }
    case "training-template-action": {
      const t = template(c.id);
      if (c.action === "duplicate") copyTemplate(t);
      else if (c.action === "delete") {
        t.deleted_at = stamp;
        for (const p of s.training_plans)
          p.week = p.week.filter((w) => w.template_id !== t.id);
        for (const x of s.scheduled_workouts.filter(
          (x) => x.workout_template_id === t.id && x.status === "planned",
        )) {
          x.status = "cancelled";
          x.updated_at = stamp;
        }
      } else t.archived = c.action === "archive";
      t.updated_at = stamp;
      break;
    }
    case "training-item-save": {
      const fields = {
        item_type: c.item_type,
        name: c.name,
        description: c.description,
        targets: structuredClone(c.targets),
        notes: c.notes,
        updated_at: stamp,
      };
      if (c.scope === "template") {
        template(c.target_id);
        if (c.id) {
          const item = find(s.workout_template_items, c.id);
          if (item.workout_template_id !== c.target_id)
            throw new Error("Ungültige Vorlage.");
          Object.assign(item, fields);
        } else
          s.workout_template_items.push({
            ...meta(),
            ...fields,
            workout_template_id: c.target_id,
            sort_order: alive(s.workout_template_items).filter(
              (x) => x.workout_template_id === c.target_id,
            ).length,
          });
      } else {
        const w = session(c.target_id);
        let item = c.id ? find(s.workout_session_items, c.id) : null;
        if (item && item.workout_session_id !== w.id)
          throw new Error("Ungültige Session.");
        if (!item) {
          item = {
            ...meta(),
            ...fields,
            workout_session_id: w.id,
            template_item_id: null,
            sort_order: alive(s.workout_session_items).filter(
              (x) => x.workout_session_id === w.id,
            ).length,
          };
          s.workout_session_items.push(item);
        } else Object.assign(item, fields);
        if (c.scope === "both") {
          if (!w.workout_template_id)
            throw new Error(
              "Leeres Workout hat keine Vorlage. Nutze nur dieses Training.",
            );
          template(w.workout_template_id);
          const original = item.template_item_id
            ? s.workout_template_items.find(
                (x) => x.id === item!.template_item_id && !x.deleted_at,
              )
            : null;
          if (original) Object.assign(original, fields);
          else {
            const t: TemplateItem = {
              ...meta(),
              ...fields,
              workout_template_id: w.workout_template_id,
              sort_order: alive(s.workout_template_items).filter(
                (x) => x.workout_template_id === w.workout_template_id,
              ).length,
            };
            s.workout_template_items.push(t);
            item.template_item_id = t.id;
          }
        }
        addSets(item);
      }
      break;
    }
    case "training-item-action": {
      const rows: Array<TemplateItem | SessionItem> =
        c.scope === "template"
          ? s.workout_template_items
          : s.workout_session_items;
      const item = find(rows, c.id);
      if (c.scope === "session")
        session((item as SessionItem).workout_session_id);
      if (c.action === "delete") {
        item.deleted_at = stamp;
        item.updated_at = stamp;
        if (c.scope === "session")
          for (const set of sessionSets(s, item.id)) {
            set.deleted_at = stamp;
            set.updated_at = stamp;
          }
      } else {
        const copy = {
          ...structuredClone(item),
          ...meta(),
          name: item.name.slice(0, 192) + " · Kopie",
          sort_order: Math.max(-1, ...alive(rows).map((x) => x.sort_order)) + 1,
        };
        if (c.scope === "template")
          s.workout_template_items.push(copy as TemplateItem);
        else {
          s.workout_session_items.push(copy as SessionItem);
          addSets(copy as SessionItem);
        }
      }
      break;
    }
    case "training-order": {
      const rows = s[c.collection]
        .filter((x) => !x.deleted_at)
        .filter(
          (x) =>
            c.collection === "training_plans" ||
            ("training_plan_id" in x
              ? x.training_plan_id === c.parent_id
              : "workout_template_id" in x
                ? x.workout_template_id === c.parent_id
                : "workout_session_id" in x &&
                  x.workout_session_id === c.parent_id),
        );
      if (c.collection === "workout_session_items") session(c.parent_id!);
      if (
        rows.length !== c.ids.length ||
        new Set(c.ids).size !== rows.length ||
        rows.some((x) => !c.ids.includes(x.id))
      )
        throw new Error("Ungültige Trainingsreihenfolge.");
      c.ids.forEach((id, i) =>
        Object.assign(
          rows.find((x) => x.id === id)!,
          { sort_order: i, updated_at: stamp },
        ),
      );
      break;
    }
    case "training-schedule": {
      const t = template(c.workout_template_id);
      if (t.archived && c.action === "save")
        throw new Error("Stelle diese archivierte Vorlage zuerst wieder her.");
      if (c.id) {
        const row = find(s.scheduled_workouts, c.id);
        if (row.status === "done")
          throw new Error("Erledigte Termine bleiben in der Historie.");
        Object.assign(row, {
          workout_template_id: t.id,
          planned_date: c.planned_date,
          status: c.action === "cancel" ? "cancelled" : "planned",
          updated_at: stamp,
        });
      } else if (c.action === "save")
        s.scheduled_workouts.push({
          ...meta(),
          workout_template_id: t.id,
          planned_date: c.planned_date,
          status: "planned",
        });
      break;
    }
    case "training-week": {
      const p = find(s.training_plans, c.plan_id);
      const start = new Date(c.week_start + "T12:00:00Z");
      if (start.getUTCDay() !== 1)
        throw new Error("Bitte einen Montag für den Wochenbeginn wählen.");
      for (const w of p.week) {
        const day = new Date(start);
        day.setUTCDate(day.getUTCDate() + w.weekday - 1);
        const planned_date = day.toISOString().slice(0, 10);
        if (
          !s.scheduled_workouts.some(
            (x) =>
              x.workout_template_id === w.template_id &&
              x.planned_date === planned_date &&
              x.status !== "cancelled",
          )
        )
          s.scheduled_workouts.push({
            ...meta(),
            workout_template_id: w.template_id,
            planned_date,
            status: "planned",
          });
      }
      break;
    }
    case "training-start": {
      if (s.workout_sessions.some((x) => x.status === "active"))
        throw new Error("Beende zuerst dein laufendes Workout.");
      const scheduled = c.scheduled_id
        ? find(s.scheduled_workouts, c.scheduled_id)
        : null;
      if (
        scheduled &&
        (scheduled.status !== "planned" ||
          scheduled.workout_template_id !== c.template_id)
      )
        throw new Error("Geplanter Termin passt nicht zur Vorlage.");
      const t = c.template_id ? template(c.template_id) : null;
      if (t?.archived) throw new Error("Vorlage ist archiviert.");
      const w = {
        ...meta(),
        workout_template_id: t?.id || null,
        scheduled_workout_id: scheduled?.id || null,
        name_snapshot: t?.name || c.name || "Spontanes Training",
        started_at: stamp,
        completed_at: null,
        duration_seconds: 0,
        status: "active" as const,
        notes: "",
        rating: null,
      };
      s.workout_sessions.push(w);
      for (const original of ordered(
        alive(s.workout_template_items).filter(
          (x) => x.workout_template_id === t?.id,
        ),
      )) {
        const item = {
          ...structuredClone(original),
          ...meta(),
          workout_session_id: w.id,
          template_item_id: original.id,
        };
        delete (item as Partial<typeof item>).workout_template_id;
        s.workout_session_items.push(item);
        addSets(item);
      }
      const day = s.day_plans.find(
        (x) => x.local_date === localClock(now, s.profile.timezone).date,
      );
      if (day) day.training_status = "planned";
      break;
    }
    case "training-set": {
      const set = find(s.workout_sets, c.id),
        item = find(s.workout_session_items, set.session_item_id);
      session(item.workout_session_id);
      Object.assign(set, {
        weight: c.weight,
        reps: c.reps,
        distance: c.distance,
        duration: c.duration,
        rpe: c.rpe,
        rir: c.rir,
        notes: c.notes,
        completed: c.completed,
        updated_at: stamp,
      });
      break;
    }
    case "training-finish": {
      const w = session(c.id);
      Object.assign(w, {
        status: c.cancel ? "cancelled" : "completed",
        completed_at: c.cancel ? null : stamp,
        duration_seconds: Math.max(
          0,
          (now.getTime() - new Date(w.started_at).getTime()) / 1000,
        ),
        notes: c.notes,
        rating: c.rating,
        updated_at: stamp,
      });
      if (!c.cancel) {
        if (w.scheduled_workout_id) {
          const planned = s.scheduled_workouts.find(
            (x) => x.id === w.scheduled_workout_id,
          )!;
          planned.status = "done";
          planned.updated_at = stamp;
        }
        const day = s.day_plans.find(
          (x) => x.local_date === localClock(now, s.profile.timezone).date,
        );
        if (day) day.training_status = "done";
      }
      break;
    }
    default:
      return false;
  }
  return true;
}
