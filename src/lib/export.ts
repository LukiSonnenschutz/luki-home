import JSZip from "jszip";
import { APP_VERSION } from "./version";
import type { State } from "./model";
import { trainingCollections } from "./training";
export async function exportState(s: State, now: Date) {
  const zip = new JSZip();
  const highlights = s.day_plans.flatMap((d) =>
    d.highlights.map((task_id, index) => ({
      user_id: s.profile.user_id,
      day_plan_id: d.id,
      task_id,
      position: index + 1,
    })),
  );
  const files: Record<string, unknown> = {
    ...Object.fromEntries(trainingCollections.map((key) => [key, s[key]])),
    goals: s.goals,
    goal_milestones: s.goal_milestones,
    coffee_entries: s.coffee_entries,
    work_sessions: s.work_sessions,
    daily_metrics: s.daily_metrics,
    categories: [
      "Gesundheit & Körper",
      "Beziehung & Familie",
      "Firma",
      "Abenteuer",
      "Persönliche Entwicklung",
      "Sonstiges",
    ],
    profile: s.profile,
    settings: s.settings,
    tasks: s.tasks,
    day_plans: s.day_plans.map((d) => {
      const { highlights: unused, ...row } = d;
      void unused;
      return row;
    }),
    day_task_highlights: highlights,
    anchor_definitions: s.anchor_definitions,
    anchor_entries: s.anchor_entries,
    checkins: s.checkins,
    intervention_events: s.intervention_events,
  };
  for (const [name, value] of Object.entries(files))
    zip.file(`${name}.json`, JSON.stringify(value, null, 2));
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        export_schema_version: 3,
        app_version: APP_VERSION,
        exported_at: now.toISOString(),
        timezone: s.profile.timezone,
        counts: Object.fromEntries(
          Object.entries(files).map(([name, data]) => [
            `${name}.json`,
            Array.isArray(data) ? data.length : 1,
          ]),
        ),
      },
      null,
      2,
    ),
  );
  zip.file(
    "README.txt",
    "Luki Home — persönlicher Datenexport\nAlle eigenen Anwendungsdaten, ohne Zugangsdaten. UTF-8 JSON.\nDatum: lokale Tageszuordnung; Zeitstempel: UTC.\nImport nur in einen leeren Online-Zugang. Systembackup separat; siehe README.\n",
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
