import JSZip from "jszip";
import { z } from "zod";
import { anchorKeys, dateSchema, timeSchema, type State } from "./model";
const id = z.string().uuid(),
  text = z.string().max(2000),
  short = z.string().max(200),
  timestamp = z.iso.datetime({ offset: true }),
  date = dateSchema;
const row = { id, user_id: id };
const score = z.number().int().min(1).max(5).nullable();
const rule = z.enum(["wake_up_late", "movement_missing", "work_end_due"]);
const stateSchema = z.object({
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
  return s;
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
      export_schema_version: z.literal(1),
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
