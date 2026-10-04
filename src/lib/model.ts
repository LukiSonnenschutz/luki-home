import { z } from "zod";

export const anchorKeys = [
  "wake_up",
  "morning_movement",
  "coffee_rule",
  "meal",
  "work_end",
] as const;
export type AnchorKey = (typeof anchorKeys)[number];
export type AnchorStatus = "pending" | "done" | "skipped";
export type RuleId = "wake_up_late" | "movement_missing" | "work_end_due";
export interface Profile {
  user_id: string;
  display_name: string;
  timezone: string;
}
export interface Settings {
  work_end_target: string;
  movement_time: string;
  checkin_time: string;
  rules: Record<RuleId, boolean>;
}
export interface Task {
  id: string;
  user_id: string;
  title: string;
  notes: string;
  due_date: string | null;
  status: "open" | "done";
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface AnchorDefinition {
  id: string;
  user_id: string;
  key: AnchorKey;
  label: string;
  description: string;
  target_time: string | null;
  enabled: boolean;
  position: number;
}
export interface AnchorEntry {
  id: string;
  user_id: string;
  anchor_id: string;
  local_date: string;
  status: AnchorStatus;
  actual_local_time: string | null;
  recorded_at: string | null;
  note: string;
  label_snapshot: string;
  description_snapshot: string;
}
export interface DayPlan {
  id: string;
  user_id: string;
  local_date: string;
  focus_text: string;
  focus_task_id: string | null;
  training_note: string;
  training_time: string | null;
  highlights: string[];
}
export interface Checkin {
  id: string;
  user_id: string;
  local_date: string;
  energy: number | null;
  mood: number | null;
  stress: number | null;
  helped_text: string;
  tomorrow_text: string;
  submitted_at: string | null;
  updated_at: string;
  created_at?: string;
}
export interface Intervention {
  id: string;
  user_id: string;
  local_date: string;
  rule_id: RuleId;
  rule_version: number;
  message_snapshot: string;
  first_shown_at: string | null;
  snoozed_until: string | null;
  dismissed_at: string | null;
}
export interface State {
  schema_version: 1;
  revision: number;
  profile: Profile;
  settings: Settings;
  tasks: Task[];
  day_plans: DayPlan[];
  anchor_definitions: AnchorDefinition[];
  anchor_entries: AnchorEntry[];
  checkins: Checkin[];
  intervention_events: Intervention[];
}
export interface Dashboard {
  state: State;
  date: string;
  today: string;
  serverTime: string;
  activeRule: Intervention | null;
  mode: "local" | "supabase";
}

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Ungültiges Datum");
const id = z.string().uuid();
const shortText = z.string().trim().max(200);
const note = z.string().max(2000);
const score = z.number().int().min(1).max(5).nullable();
const base = { date: dateSchema };
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("day"),
    ...base,
    focus_text: shortText,
    focus_task_id: id.nullable(),
    training_note: shortText,
    training_time: timeSchema.nullable(),
  }),
  z.object({
    type: z.literal("task-create"),
    ...base,
    title: shortText.min(1),
    notes: note,
    due_date: dateSchema.nullable(),
  }),
  z.object({
    type: z.literal("task-edit"),
    ...base,
    id,
    title: shortText.min(1),
    notes: note,
    due_date: dateSchema.nullable(),
  }),
  z.object({
    type: z.literal("task-status"),
    ...base,
    id,
    status: z.enum(["open", "done"]),
  }),
  z.object({ type: z.literal("task-delete"), ...base, id }),
  z.object({ type: z.literal("highlight"), ...base, id, enabled: z.boolean() }),
  z.object({
    type: z.literal("anchor"),
    ...base,
    id,
    status: z.enum(["pending", "done", "skipped"]),
    actual_local_time: timeSchema.nullable(),
    note,
  }),
  z.object({
    type: z.literal("checkin"),
    ...base,
    energy: score,
    mood: score,
    stress: score,
    helped_text: note,
    tomorrow_text: note,
    submit: z.boolean(),
  }),
  z.object({
    type: z.literal("intervention"),
    ...base,
    id,
    action: z.enum(["snooze", "dismiss"]),
  }),
  z.object({
    type: z.literal("settings"),
    ...base,
    display_name: shortText.min(1),
    timezone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("de", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }),
    work_end_target: timeSchema,
    movement_time: timeSchema,
    checkin_time: timeSchema,
    rules: z.object({
      wake_up_late: z.boolean(),
      movement_missing: z.boolean(),
      work_end_due: z.boolean(),
    }),
    anchors: z
      .array(
        z.object({
          id,
          enabled: z.boolean(),
          description: note,
          target_time: timeSchema.nullable(),
        }),
      )
      .length(5),
  }),
]);
export type Command = z.infer<typeof commandSchema>;

export function newState(user_id: string, display_name = "Lukas"): State {
  const defaults: [AnchorKey, string, string, string | null][] = [
    ["wake_up", "Aufstehen", "Bewusst in den Tag starten.", "08:00"],
    [
      "morning_movement",
      "Morgenbewegung",
      "Eine kleine Bewegungseinheit, die heute zu dir passt.",
      null,
    ],
    [
      "coffee_rule",
      "Kaffee-Regel",
      "Trage deine persönliche Kaffee-Regel in den Einstellungen ein.",
      null,
    ],
    ["meal", "Essen", "Zeit für eine bewusste Mahlzeit.", null],
    [
      "work_end",
      "Feierabend",
      "Arbeit sichern und den Tag abschließen.",
      "17:00",
    ],
  ];
  return {
    schema_version: 1,
    revision: 0,
    profile: { user_id, display_name, timezone: "Europe/Berlin" },
    settings: {
      work_end_target: "17:00",
      movement_time: "14:00",
      checkin_time: "20:30",
      rules: { wake_up_late: true, movement_missing: true, work_end_due: true },
    },
    tasks: [],
    day_plans: [],
    anchor_entries: [],
    checkins: [],
    intervention_events: [],
    anchor_definitions: defaults.map(
      ([key, label, description, target_time], position) => ({
        id: crypto.randomUUID(),
        user_id,
        key,
        label,
        description,
        target_time,
        position,
        enabled: true,
      }),
    ),
  };
}
