import JSZip from "jszip";
import { z } from "zod";
import { anchorKeys, dateSchema, timeSchema, type State } from "./model";
import {
  categories,
  goalStatuses,
  preferenceSchema,
  upgradeState,
} from "./stability";
const id = z.string().uuid(),
  text = z.string().max(2000),
  short = z.string().max(200),
  timestamp = z.iso.datetime({ offset: true }),
  date = dateSchema;
const row = { id, user_id: id };
const score = z.number().int().min(1).max(5).nullable();
const rule = z.enum(["wake_up_late", "movement_missing", "work_end_due"]);
const stateSchema = z.object({
  goals: z
    .array(
      z
        .object({
          ...row,
          title: short.min(1),
          why: text,
          success_criteria: text,
          category: z.enum(categories),
          priority: z.number().int().min(1).max(3),
          status: z.enum(goalStatuses),
          is_focus: z.boolean(),
          start_date: date.nullable(),
          target_date: date.nullable(),
          completed_at: timestamp.nullable(),
          created_at: timestamp,
          updated_at: timestamp,
        })
        .refine(
          (g) =>
            (g.status === "achieved") === (g.completed_at !== null) &&
            (!g.start_date || !g.target_date || g.start_date <= g.target_date),
        ),
    )
    .max(20000)
    .default([]),
  goal_milestones: z
    .array(
      z
        .object({
          ...row,
          goal_id: id,
          title: short.min(1),
          description: text,
          status: z.enum(["open", "done"]),
          due_date: date.nullable(),
          sort_order: z.number().int().nonnegative(),
          completed_at: timestamp.nullable(),
          created_at: timestamp,
          updated_at: timestamp,
        })
        .refine((m) => (m.status === "done") === (m.completed_at !== null)),
    )
    .max(20000)
    .default([]),
  coffee_entries: z
    .array(z.object({ ...row, consumed_at: timestamp, created_at: timestamp }))
    .max(20000)
    .default([]),
  daily_metrics: z
    .array(
      z.object({
        ...row,
        date,
        metric_type: z.enum([
          "calories",
          "protein",
          "movement_minutes",
          "caffeine_count",
        ]),
        value: z.number().finite().min(0).max(20000),
        target: z.number().finite().min(0).max(20000).nullable(),
        unit: z.string().max(20),
        source: z.enum(["manual", "health", "external"]),
        created_at: timestamp,
        updated_at: timestamp,
      }),
    )
    .max(20000)
    .default([]),
  work_sessions: z
    .array(
      z
        .object({
          ...row,
          local_date: date,
          started_at: timestamp,
          ended_at: timestamp.nullable(),
          planned_minutes: z.number().int().min(5).max(240),
          planned_break_minutes: z.number().int().min(5).max(60),
          actual_minutes: z.number().finite().nonnegative(),
          elapsed_seconds: z.number().finite().nonnegative(),
          focus_started_at: timestamp.nullable(),
          status: z.enum(["active", "paused", "break", "done"]),
          break_started_at: timestamp.nullable(),
          break_ended_at: timestamp.nullable(),
          break_taken: z.boolean(),
          break_overrun: z.boolean(),
          created_at: timestamp,
          updated_at: timestamp,
        })
        .refine(
          (w) =>
            (w.status === "active") === (w.focus_started_at !== null) &&
            (w.status !== "break" || w.break_started_at !== null) &&
            (w.status !== "done" || w.ended_at !== null),
        ),
    )
    .max(20000)
    .default([]),
  schema_version: z.literal(1),
  revision: z.number().int().min(0),
  profile: z.object({
    user_id: id,
    display_name: short.trim().min(1),
    timezone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("de", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }),
  }),
  settings: z.object({
    preferences: preferenceSchema.optional(),
    work_end_target: timeSchema,
    movement_time: timeSchema,
    checkin_time: timeSchema,
    rules: z.object({
      wake_up_late: z.boolean(),
      movement_missing: z.boolean(),
      work_end_due: z.boolean(),
    }),
  }),
  tasks: z
    .array(
      z
        .object({
          ...row,
          title: short.trim().min(1),
          goal_id: id.nullable().optional(),
          notes: text,
          due_date: date.nullable(),
          status: z.enum(["open", "done"]),
          completed_at: timestamp.nullable(),
          created_at: timestamp,
          updated_at: timestamp,
        })
        .refine((t) => (t.status === "done") === (t.completed_at !== null)),
    )
    .max(20000),
  day_plans: z
    .array(
      z.object({
        ...row,
        local_date: date,
        focus_text: short,
        focus_task_id: id.nullable(),
        training_note: short,
        training_time: timeSchema.nullable(),
        training_status: z.enum(["open", "planned", "done"]).optional(),
        highlights: z.array(id).max(3),
      }),
    )
    .max(20000),
  anchor_definitions: z
    .array(
      z.object({
        ...row,
        key: z.enum(anchorKeys),
        label: short.min(1),
        description: text,
        target_time: timeSchema.nullable(),
        enabled: z.boolean(),
        position: z.number().int().min(0).max(4),
      }),
    )
    .length(5),
  anchor_entries: z
    .array(
      z
        .object({
          ...row,
          anchor_id: id,
          local_date: date,
          status: z.enum(["pending", "done", "skipped"]),
          actual_local_time: timeSchema.nullable(),
          recorded_at: timestamp.nullable(),
          note: text,
          label_snapshot: short,
          description_snapshot: text,
        })
        .refine((e) => (e.status === "pending") === (e.recorded_at === null)),
    )
    .max(20000),
  checkins: z
    .array(
      z
        .object({
          ...row,
          local_date: date,
          energy: score,
          movement_done: z.boolean().optional(),
          training_done: z.boolean().optional(),
          work_end_kept: z.boolean().optional(),
          mood: score,
          stress: score,
          helped_text: text,
          tomorrow_text: text,
          submitted_at: timestamp.nullable(),
          updated_at: timestamp,
          created_at: timestamp.optional(),
        })
        .refine(
          (c) =>
            !c.submitted_at ||
            (c.energy !== null && c.mood !== null && c.stress !== null),
        ),
    )
    .max(20000),
  intervention_events: z
    .array(
      z.object({
        ...row,
        local_date: date,
        rule_id: rule,
        rule_version: z.number().int().positive(),
        message_snapshot: text,
        first_shown_at: timestamp.nullable(),
        snoozed_until: timestamp.nullable(),
        dismissed_at: timestamp.nullable(),
      }),
    )
    .max(20000),
});
export { isEmptyForImport } from "./import-eligibility";
function unique(values: string[]) {
  return new Set(values).size === values.length;
}
export function validateImportedState(
  value: unknown,
  targetUserId: string,
): State {
  const s = stateSchema.parse(value);
  const source = s.profile.user_id;
  const tables = [
    s.goals,
    s.goal_milestones,
    s.coffee_entries,
    s.work_sessions,
    s.daily_metrics,
    s.tasks,
    s.day_plans,
    s.anchor_definitions,
    s.anchor_entries,
    s.checkins,
    s.intervention_events,
  ];
  if (
    tables.some(
      (rows) =>
        !unique(rows.map((r) => r.id)) ||
        rows.some((r) => r.user_id !== source),
    )
  )
    throw new Error(
      "Der Export enthält widersprüchliche IDs oder Nutzerzuordnungen.",
    );
  if (
    !unique(s.day_plans.map((d) => d.local_date)) ||
    !unique(s.checkins.map((c) => c.local_date)) ||
    !unique(s.anchor_definitions.map((a) => a.key)) ||
    !unique(s.anchor_definitions.map((a) => String(a.position))) ||
    !unique(s.anchor_entries.map((e) => `${e.anchor_id}:${e.local_date}`)) ||
    !unique(s.intervention_events.map((e) => `${e.rule_id}:${e.local_date}`))
  )
    throw new Error("Der Export enthält doppelte Tagesdaten.");
  const tasks = new Set(s.tasks.map((t) => t.id)),
    anchors = new Set(s.anchor_definitions.map((a) => a.id));
  const goals = new Set(s.goals.map((g) => g.id));
  if (
    s.tasks.some((t) => t.goal_id && !goals.has(t.goal_id)) ||
    s.goal_milestones.some((m) => !goals.has(m.goal_id)) ||
    !unique(s.daily_metrics.map((m) => `${m.date}:${m.metric_type}`)) ||
    s.work_sessions.filter((w) => w.status !== "done").length > 1
  )
    throw new Error("Ungültige Verknüpfungen oder doppelte Tageswerte.");
  if (
    s.day_plans.some(
      (d) =>
        !unique(d.highlights) ||
        d.highlights.some((t) => !tasks.has(t)) ||
        (d.focus_task_id && !tasks.has(d.focus_task_id)),
    ) ||
    s.anchor_entries.some((e) => !anchors.has(e.anchor_id))
  )
    throw new Error("Der Export enthält ungültige Verknüpfungen.");
  s.profile.user_id = targetUserId;
  for (const rows of tables) for (const row of rows) row.user_id = targetUserId;
  return upgradeState(s);
}
export async function importArchive(
  bytes: Uint8Array,
  targetUserId: string,
): Promise<State> {
  if (bytes.byteLength > 10 * 1024 * 1024)
    throw new Error("Der Export darf höchstens 10 MB groß sein.");
  const zip = await JSZip.loadAsync(bytes);
  let total = 0;
  const json = async (name: string): Promise<unknown> => {
    const file = zip.file(`${name}.json`);
    if (!file) throw new Error(`Im Export fehlt ${name}.json.`);
    const raw = await new Promise<string>((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      let size = 0;
      const stream = file.nodeStream("nodebuffer");
      stream.on("data", (chunk: Uint8Array) => {
        size += chunk.length;
        total += chunk.length;
        if (size > 8 * 1024 * 1024 || total > 32 * 1024 * 1024) {
          stream.pause();
          reject(new Error("Die entpackten Daten sind zu groß."));
          return;
        }
        chunks.push(chunk);
      });
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      stream.resume();
    });
    return JSON.parse(raw);
  };
  const manifest = z
    .object({
      export_schema_version: z.union([z.literal(1), z.literal(2)]),
      counts: z.record(z.string(), z.number().int().nonnegative()),
    })
    .parse(await json("manifest"));
  const files: Record<string, unknown> = {};
  for (const name of [
    "profile",
    "settings",
    "tasks",
    "day_plans",
    "day_task_highlights",
    "anchor_definitions",
    "anchor_entries",
    "checkins",
    "intervention_events",
    ...(manifest.export_schema_version === 2
      ? [
          "goals",
          "goal_milestones",
          "coffee_entries",
          "work_sessions",
          "daily_metrics",
          "categories",
        ]
      : []),
  ]) {
    files[name] = await json(name);
    if (
      manifest.counts[`${name}.json`] !==
      (Array.isArray(files[name]) ? (files[name] as unknown[]).length : 1)
    )
      throw new Error(
        "Datensatzanzahl stimmt nicht mit dem Export-Manifest überein.",
      );
  }
  const highlights = z
    .array(
      z.object({
        user_id: id,
        day_plan_id: id,
        task_id: id,
        position: z.number().int().min(1).max(3),
      }),
    )
    .parse(files.day_task_highlights);
  const days = z
    .array(z.object({ id, user_id: id }).passthrough())
    .parse(files.day_plans);
  const profile = z.object({ user_id: id }).parse(files.profile);
  if (
    highlights.some(
      (h) =>
        h.user_id !== profile.user_id ||
        !days.some((d) => d.id === h.day_plan_id),
    ) ||
    !unique(highlights.map((h) => `${h.day_plan_id}:${h.position}`))
  )
    throw new Error("Ungültige Prioritätszuordnung im Export.");
  const value = {
    schema_version: 1,
    revision: 0,
    ...files,
    day_plans: days.map((d) => ({
      ...d,
      highlights: highlights
        .filter((h) => h.day_plan_id === d.id)
        .sort((a, b) => a.position - b.position)
        .map((h) => h.task_id),
    })),
  };
  return validateImportedState(value, targetUserId);
}
