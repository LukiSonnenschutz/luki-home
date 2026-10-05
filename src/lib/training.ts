import { z } from "zod";
import type { State } from "./model";
export const trainingCollections = [
  "training_plans",
  "workout_templates",
  "workout_template_items",
  "scheduled_workouts",
  "workout_sessions",
  "workout_session_items",
  "workout_sets",
] as const;
const id = z.string().uuid(),
  date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => {
      const v = new Date(d + "T12:00:00Z");
      return !Number.isNaN(v.getTime()) && v.toISOString().slice(0, 10) === d;
    }, "Ungültiges Datum."),
  text = z.string().trim().max(2000),
  name = z.string().trim().min(1).max(200),
  stamp = z.iso.datetime({ offset: true });
const number = (max: number) => z.number().finite().min(0).max(max).nullable();
export const itemTypes = [
  "strength",
  "distance",
  "time",
  "reps",
  "ergometer",
  "run",
  "round",
  "station",
] as const;
export const itemLabels = {
  strength: "Kraftübung",
  distance: "Distanz",
  time: "Zeit",
  reps: "Wiederholungen",
  ergometer: "Ergometer",
  run: "Run",
  round: "Runde",
  station: "Freie Station",
};
export const targetsSchema = z
  .object({
    sets: z.number().int().min(1).max(50).nullable(),
    reps_min: number(10000),
    reps_max: number(10000),
    weight: number(2000),
    unit: z.enum(["kg", "lb", "bodyweight"]),
    distance: number(1000000),
    duration: number(86400),
    rounds: z.number().int().min(1).max(100).nullable(),
    rpe: number(10),
    rir: number(20),
  })
  .refine(
    (t) =>
      t.reps_min === null || t.reps_max === null || t.reps_min <= t.reps_max,
    { message: "Wiederholungsbereich ist ungültig." },
  );
export type Targets = z.infer<typeof targetsSchema>;
export const emptyTargets: Targets = {
  sets: 3,
  reps_min: 8,
  reps_max: 8,
  weight: null,
  unit: "kg",
  distance: null,
  duration: null,
  rounds: null,
  rpe: null,
  rir: null,
};
const row = {
  id,
  user_id: id,
  created_at: stamp,
  updated_at: stamp,
  deleted_at: stamp.nullable(),
};
export const trainingSchemas = {
  training_plans: z.object({
    ...row,
    name,
    description: text,
    is_active: z.boolean(),
    sort_order: z.number().int().nonnegative(),
    week: z
      .array(
        z.object({ weekday: z.number().int().min(1).max(7), template_id: id }),
      )
      .max(100),
  }),
  workout_templates: z.object({
    ...row,
    training_plan_id: id.nullable(),
    name,
    description: text,
    workout_type: z.enum([
      "strength",
      "conditioning",
      "hybrid",
      "mobility",
      "free",
    ]),
    sort_order: z.number().int().nonnegative(),
    archived: z.boolean(),
  }),
  workout_template_items: z.object({
    ...row,
    workout_template_id: id,
    item_type: z.enum(itemTypes),
    name,
    description: text,
    sort_order: z.number().int().nonnegative(),
    targets: targetsSchema,
    notes: text,
  }),
  scheduled_workouts: z.object({
    ...row,
    workout_template_id: id,
    planned_date: date,
    status: z.enum(["planned", "done", "cancelled"]),
  }),
  workout_sessions: z.object({
    ...row,
    workout_template_id: id.nullable(),
    scheduled_workout_id: id.nullable(),
    name_snapshot: name,
    started_at: stamp,
    completed_at: stamp.nullable(),
    duration_seconds: z.number().finite().nonnegative(),
    status: z.enum(["active", "completed", "cancelled"]),
    notes: text,
    rating: z.number().int().min(1).max(5).nullable(),
  }),
  workout_session_items: z.object({
    ...row,
    workout_session_id: id,
    template_item_id: id.nullable(),
    item_type: z.enum(itemTypes),
    name,
    description: text,
    sort_order: z.number().int().nonnegative(),
    targets: targetsSchema,
    notes: text,
  }),
  workout_sets: z.object({
    ...row,
    session_item_id: id,
    set_number: z.number().int().min(1).max(100),
    weight: number(2000),
    reps: number(10000),
    distance: number(1000000),
    duration: number(86400),
    rpe: number(10),
    rir: number(20),
    notes: text,
    completed: z.boolean(),
  }),
};
export type TrainingPlan = z.infer<typeof trainingSchemas.training_plans>;
export type WorkoutTemplate = z.infer<typeof trainingSchemas.workout_templates>;
export type TemplateItem = z.infer<
  typeof trainingSchemas.workout_template_items
>;
export type ScheduledWorkout = z.infer<
  typeof trainingSchemas.scheduled_workouts
>;
export type WorkoutSession = z.infer<typeof trainingSchemas.workout_sessions>;
export type SessionItem = z.infer<typeof trainingSchemas.workout_session_items>;
export type WorkoutSet = z.infer<typeof trainingSchemas.workout_sets>;
export interface TrainingState {
  training_plans: TrainingPlan[];
  workout_templates: WorkoutTemplate[];
  workout_template_items: TemplateItem[];
  scheduled_workouts: ScheduledWorkout[];
  workout_sessions: WorkoutSession[];
  workout_session_items: SessionItem[];
  workout_sets: WorkoutSet[];
}
const base = { date };
export const trainingCommandSchemas = [
  z.object({
    type: z.literal("training-plan-save"),
    ...base,
    id: id.nullable(),
    name,
    description: text,
    week: trainingSchemas.training_plans.shape.week.optional(),
  }),
  z.object({
    type: z.literal("training-plan-action"),
    ...base,
    id,
    action: z.enum(["duplicate", "delete", "activate", "deactivate"]),
  }),
  z.object({
    type: z.literal("training-template-save"),
    ...base,
    id: id.nullable(),
    training_plan_id: id.nullable(),
    name,
    description: text,
    workout_type: trainingSchemas.workout_templates.shape.workout_type,
  }),
  z.object({
    type: z.literal("training-template-action"),
    ...base,
    id,
    action: z.enum(["duplicate", "archive", "restore", "delete"]),
  }),
  z.object({
    type: z.literal("training-item-save"),
    ...base,
    id: id.nullable(),
    target_id: id,
    scope: z.enum(["template", "session", "both"]),
    item_type: z.enum(itemTypes),
    name,
    description: text,
    targets: targetsSchema,
    notes: text,
  }),
  z.object({
    type: z.literal("training-item-action"),
    ...base,
    id,
    scope: z.enum(["template", "session"]),
    action: z.enum(["duplicate", "delete"]),
  }),
  z.object({
    type: z.literal("training-order"),
    ...base,
    collection: z.enum([
      "training_plans",
      "workout_templates",
      "workout_template_items",
      "workout_session_items",
    ]),
    parent_id: id.nullable(),
    ids: z.array(id).max(1000),
  }),
  z.object({
    type: z.literal("training-schedule"),
    ...base,
    id: id.nullable(),
    workout_template_id: id,
    planned_date: date,
    action: z.enum(["save", "cancel"]),
  }),
  z.object({
    type: z.literal("training-week"),
    ...base,
    plan_id: id,
    week_start: date,
  }),
  z.object({
    type: z.literal("training-start"),
    ...base,
    template_id: id.nullable(),
    scheduled_id: id.nullable(),
    name: name.optional(),
  }),
  z.object({
    type: z.literal("training-set"),
    ...base,
    id,
    weight: number(2000),
    reps: number(10000),
    distance: number(1000000),
    duration: number(86400),
    rpe: number(10),
    rir: number(20),
    notes: text,
    completed: z.boolean(),
  }),
  z.object({
    type: z.literal("training-finish"),
    ...base,
    id,
    notes: text,
    rating: z.number().int().min(1).max(5).nullable(),
    cancel: z.boolean().optional(),
  }),
] as const;
export type TrainingCommand = z.infer<(typeof trainingCommandSchemas)[number]>;
export function upgradeTraining(s: State): State {
  for (const key of trainingCollections) s[key] ??= [];
  return s;
}
export function alive<T extends { deleted_at: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => !r.deleted_at);
}
export function ordered<T extends { sort_order: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order);
}
export function sessionSets(s: State, itemId: string) {
  return alive(s.workout_sets)
    .filter((x) => x.session_item_id === itemId)
    .sort((a, b) => a.set_number - b.set_number);
}
export function previousPerformance(s: State, item: SessionItem) {
  const sessions = s.workout_sessions
    .filter((x) => x.status === "completed" && x.id !== item.workout_session_id)
    .sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || ""));
  for (const session of sessions) {
    const previous = alive(s.workout_session_items).find(
      (x) =>
        x.workout_session_id === session.id &&
        x.name.trim().toLocaleLowerCase() ===
          item.name.trim().toLocaleLowerCase() &&
        x.item_type === item.item_type &&
        x.targets.unit === item.targets.unit,
    );
    if (previous) {
      const sets = sessionSets(s, previous.id);
      if (
        sets.some(
          (r) =>
            r.completed ||
            [r.weight, r.reps, r.distance, r.duration, r.rpe, r.rir].some(
              (v) => v !== null,
            ),
        )
      )
        return { session, item: previous, sets };
    }
  }
  return null;
}
export function validateTrainingRelations(s: State) {
  const has = (key: keyof TrainingState, id: string | null) =>
    id === null || s[key].some((r) => r.id === id);
  if (
    s.workout_templates.some(
      (x) => !has("training_plans", x.training_plan_id),
    ) ||
    s.workout_template_items.some(
      (x) => !has("workout_templates", x.workout_template_id),
    ) ||
    s.scheduled_workouts.some(
      (x) => !has("workout_templates", x.workout_template_id),
    ) ||
    s.workout_sessions.some(
      (x) =>
        !has("workout_templates", x.workout_template_id) ||
        !has("scheduled_workouts", x.scheduled_workout_id) ||
        (x.status === "completed") !== (x.completed_at !== null),
    ) ||
    s.workout_session_items.some(
      (x) =>
        !has("workout_sessions", x.workout_session_id) ||
        !has("workout_template_items", x.template_item_id) ||
        (x.template_item_id !== null &&
          s.workout_template_items.find((t) => t.id === x.template_item_id)
            ?.workout_template_id !==
            s.workout_sessions.find((w) => w.id === x.workout_session_id)
              ?.workout_template_id),
    ) ||
    s.workout_sets.some(
      (x) => !has("workout_session_items", x.session_item_id),
    ) ||
    s.training_plans.some((p) =>
      p.week.some(
        (w) =>
          !s.workout_templates.some(
            (t) =>
              t.id === w.template_id &&
              t.training_plan_id === p.id &&
              !t.deleted_at,
          ),
      ),
    )
  )
    throw new Error("Ungültige Trainingsbeziehung.");
  if (s.workout_sessions.filter((x) => x.status === "active").length > 1)
    throw new Error("Mehrere laufende Workouts sind nicht zulässig.");
  const keys = alive(s.workout_sets).map(
    (x) => `${x.session_item_id}:${x.set_number}`,
  );
  if (new Set(keys).size !== keys.length)
    throw new Error("Doppelte Satznummer.");
}
