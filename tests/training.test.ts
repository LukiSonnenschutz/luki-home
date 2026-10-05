import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import {
  newState,
  commandSchema,
  type State,
  type Command,
} from "../src/lib/model";
import { applyCommand } from "../src/lib/domain";
import {
  emptyTargets,
  trainingCollections,
  sessionSets,
  previousPerformance,
  alive,
  validateTrainingRelations,
} from "../src/lib/training";
import { exportState } from "../src/lib/export";
import { importArchive, validateImportedState } from "../src/lib/import";
import {
  expireWork,
  focusSeconds,
  plannedSeconds,
  preferences,
} from "../src/lib/stability";
import { toneSamples, alarmTones } from "../src/lib/audio";
const uid = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002",
  date = "2026-10-05",
  now = new Date("2026-10-05T10:00:00Z");
const run = (s: State, c: Command, time = now) =>
  applyCommand(s, commandSchema.parse(c), time);
export function trainingFixture(s = newState(uid)) {
  run(s, {
    type: "training-plan-save",
    date,
    id: null,
    name: "Plan A",
    description: "Frei",
  });
  run(s, {
    type: "training-plan-save",
    date,
    id: null,
    name: "Plan B",
    description: "",
  });
  run(s, {
    type: "training-template-save",
    date,
    id: null,
    training_plan_id: s.training_plans[0].id,
    name: "Upper A",
    description: "Kraft",
    workout_type: "hybrid",
  });
  const t = s.workout_templates[0];
  run(s, {
    type: "training-item-save",
    date,
    id: null,
    target_id: t.id,
    scope: "template",
    item_type: "strength",
    name: "Bankdrücken",
    description: "Kontrolliert",
    targets: { ...emptyTargets, weight: 80, reps_min: 6, reps_max: 8 },
    notes: "",
  });
  run(s, {
    type: "training-item-save",
    date,
    id: null,
    target_id: t.id,
    scope: "template",
    item_type: "run",
    name: "Run",
    description: "HYROX",
    targets: {
      ...emptyTargets,
      sets: null,
      reps_min: null,
      reps_max: null,
      rounds: 4,
      distance: 1000,
      duration: 300,
    },
    notes: "Frei",
  });
  return s;
}
test("Trainingspläne, Kopien, Reihenfolge, Wochenplanung, Verschieben und Löschen sind frei konfigurierbar", () => {
  const s = trainingFixture(),
    p = s.training_plans[0],
    t = s.workout_templates[0],
    items = s.workout_template_items;
  run(s, {
    type: "training-order",
    date,
    collection: "workout_template_items",
    parent_id: t.id,
    ids: [items[1].id, items[0].id],
  });
  assert.equal(items[1].sort_order, 0);
  run(s, {
    type: "training-plan-save",
    date,
    id: p.id,
    name: "Plan flexibel",
    description: "Editiert",
    week: [{ weekday: 2, template_id: t.id }],
  });
  run(s, { type: "training-week", date, plan_id: p.id, week_start: date });
  run(s, { type: "training-week", date, plan_id: p.id, week_start: date });
  assert.equal(s.scheduled_workouts.length, 1);
  assert.equal(s.scheduled_workouts[0].planned_date, "2026-10-06");
  run(s, {
    type: "training-schedule",
    date,
    id: s.scheduled_workouts[0].id,
    workout_template_id: t.id,
    planned_date: "2026-10-08",
    action: "save",
  });
  assert.equal(s.scheduled_workouts[0].status, "planned");
  run(s, { type: "training-plan-action", date, id: p.id, action: "duplicate" });
  const copy = s.training_plans[2],
    copyTemplate = s.workout_templates[1];
  assert.notEqual(copy.week[0].template_id, t.id);
  assert.equal(copyTemplate.training_plan_id, copy.id);
  assert.equal(
    s.workout_template_items.filter(
      (i) => i.workout_template_id === copyTemplate.id,
    ).length,
    2,
  );
  run(s, {
    type: "training-template-action",
    date,
    id: copyTemplate.id,
    action: "archive",
  });
  assert.throws(
    () =>
      run(s, {
        type: "training-start",
        date,
        template_id: copyTemplate.id,
        scheduled_id: null,
      }),
    /archiviert/,
  );
  run(s, {
    type: "training-template-action",
    date,
    id: copyTemplate.id,
    action: "restore",
  });
  run(s, { type: "training-plan-action", date, id: copy.id, action: "delete" });
  assert.equal(copyTemplate.training_plan_id, null);
  assert.equal(alive(s.training_plans).length, 2);
  run(s, {
    type: "training-template-action",
    date,
    id: t.id,
    action: "delete",
  });
  assert.equal(s.scheduled_workouts[0].status, "cancelled");
  validateTrainingRelations(s);
  assert.equal(
    commandSchema.safeParse({
      type: "training-week",
      date,
      plan_id: p.id,
      week_start: "2026-02-30",
    }).success,
    false,
  );
});
test("Sessions sind Momentaufnahmen; letzte Leistungen, nur heute und dauerhafte Änderung bleiben unabhängig", () => {
  const s = trainingFixture(),
    t = s.workout_templates[0];
  run(s, {
    type: "training-start",
    date,
    template_id: t.id,
    scheduled_id: null,
  });
  const first = s.workout_sessions[0],
    bench = s.workout_session_items[0],
    sets = sessionSets(s, bench.id);
  assert.equal(sets.length, 3);
  assert.equal(sessionSets(s, s.workout_session_items[1].id).length, 4);
  for (let i = 0; i < 3; i++)
    run(s, {
      type: "training-set",
      date,
      id: sets[i].id,
      weight: 80,
      reps: i === 2 ? 7 : 8,
      distance: null,
      duration: null,
      rpe: 8,
      rir: 1,
      notes: "Gespeichert",
      completed: true,
    });
  run(
    s,
    { type: "training-finish", date, id: first.id, notes: "Gut", rating: 4 },
    new Date(now.getTime() + 3600000),
  );
  const snapshot = JSON.stringify([
    first,
    ...s.workout_session_items,
    ...s.workout_sets,
  ]);
  run(
    s,
    { type: "training-start", date, template_id: t.id, scheduled_id: null },
    new Date(now.getTime() + 86400000),
  );
  const current = s.workout_session_items.find(
    (i) => i.workout_session_id !== first.id,
  )!;
  assert.deepEqual(
    previousPerformance(s, current)?.sets.map((r) => r.reps),
    [8, 8, 7],
  );
  assert.throws(
    () =>
      run(s, {
        type: "training-set",
        date,
        id: sets[0].id,
        weight: 90,
        reps: 8,
        distance: null,
        duration: null,
        rpe: null,
        rir: null,
        notes: "",
        completed: true,
      }),
    /unverändert/,
  );
  run(s, {
    type: "training-item-save",
    date,
    id: current.id,
    target_id: current.workout_session_id,
    scope: "session",
    item_type: "strength",
    name: "Kabeldrücken",
    description: "Nur heute",
    targets: { ...emptyTargets, sets: 2 },
    notes: "",
  });
  assert.equal(s.workout_template_items[0].name, "Bankdrücken");
  assert.equal(sessionSets(s, current.id).length, 2);
  run(s, {
    type: "training-item-save",
    date,
    id: current.id,
    target_id: current.workout_session_id,
    scope: "both",
    item_type: "strength",
    name: "Schrägbank",
    description: "Dauerhaft",
    targets: { ...emptyTargets, sets: 4 },
    notes: "",
  });
  assert.equal(s.workout_template_items[0].name, "Schrägbank");
  assert.equal(sessionSets(s, current.id).length, 4);
  assert.equal(
    JSON.stringify([
      first,
      ...s.workout_session_items.filter(
        (i) => i.workout_session_id === first.id,
      ),
      ...s.workout_sets.filter((r) =>
        [bench.id, s.workout_session_items[1].id].includes(r.session_item_id),
      ),
    ]),
    snapshot,
  );
  const count = s.workout_sessions.length;
  s.settings.preferences!.training_enabled = false;
  assert.equal(preferences(s).training_enabled, false);
  s.settings.preferences!.training_enabled = true;
  assert.equal(s.workout_sessions.length, count);
  validateTrainingRelations(s);
});
test("Export 3 übernimmt alle Trainingsbeziehungen und lehnt defekte / fremde Referenzen ab; Formate 1 und 2 bleiben lesbar", async () => {
  const s = trainingFixture();
  run(s, {
    type: "training-start",
    date,
    template_id: s.workout_templates[0].id,
    scheduled_id: null,
  });
  run(s, {
    type: "training-finish",
    date,
    id: s.workout_sessions[0].id,
    notes: "Export",
    rating: null,
  });
  const buffer = await exportState(s, now),
    zip = await JSZip.loadAsync(buffer),
    manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
  assert.equal(manifest.export_schema_version, 3);
  const imported = await importArchive(buffer, other);
  for (const key of trainingCollections) {
    assert.equal(imported[key].length, s[key].length);
    assert.ok(imported[key].every((r) => r.user_id === other));
  }
  assert.equal(
    imported.workout_sets[0].session_item_id,
    imported.workout_session_items[0].id,
  );
  const bad = structuredClone(s);
  bad.workout_sets[0].session_item_id = crypto.randomUUID();
  assert.throws(() => validateImportedState(bad, other), /Trainingsbeziehung/);
  bad.workout_sets[0] = structuredClone(s.workout_sets[0]);
  bad.workout_sets[0].user_id = other;
  assert.throws(() => validateImportedState(bad, other));
  for (const version of [1, 2]) {
    const old = await JSZip.loadAsync(buffer);
    old.file(
      "manifest.json",
      JSON.stringify({ ...manifest, export_schema_version: version }),
    );
    for (const key of trainingCollections) old.remove(key + ".json");
    const restored = await importArchive(
      await old.generateAsync({ type: "nodebuffer" }),
      other,
    );
    assert.equal(restored.training_plans.length, 0);
    assert.equal(restored.anchor_definitions.length, 5);
  }
});
test("15-Sekunden-Timer: Pause, Reload, Fortsetzen, Ablauf nach Suspend und Reset verwenden gespeicherte Zeiten", () => {
  const s = newState(uid);
  s.settings.preferences!.focus_minutes = 0.25;
  run(s, { type: "work", date, action: "start" });
  const w = s.work_sessions[0];
  assert.equal(plannedSeconds(w), 15);
  run(
    s,
    { type: "work", date, action: "pause" },
    new Date(now.getTime() + 5000),
  );
  assert.equal(focusSeconds(w, new Date(now.getTime() + 60000)), 5);
  const restored = JSON.parse(JSON.stringify(s)) as State;
  run(
    restored,
    { type: "work", date, action: "resume" },
    new Date(now.getTime() + 60000),
  );
  assert.equal(expireWork(restored, new Date(now.getTime() + 69000)), false);
  assert.equal(expireWork(restored, new Date(now.getTime() + 90000)), true);
  assert.equal(
    restored.work_sessions[0].ended_at,
    new Date(now.getTime() + 70000).toISOString(),
  );
  assert.equal(restored.work_sessions[0].elapsed_seconds, 15);
  assert.equal(restored.work_sessions[0].completed_by_timer, true);
  run(
    restored,
    { type: "work", date, action: "start" },
    new Date(now.getTime() + 100000),
  );
  run(
    restored,
    { type: "work", date, action: "reset" },
    new Date(now.getTime() + 103000),
  );
  assert.equal(restored.work_sessions[1].was_reset, true);
  assert.equal(restored.work_sessions[1].elapsed_seconds, 3);
  run(
    restored,
    { type: "work", date, action: "start" },
    new Date(now.getTime() + 120000),
  );
  run(
    restored,
    { type: "work", date, action: "pause" },
    new Date(now.getTime() + 140000),
  );
  assert.equal(restored.work_sessions[2].status, "done");
  assert.equal(restored.work_sessions[2].completed_by_timer, true);
  const legacy = { ...w, planned_seconds: undefined };
  assert.equal(plannedSeconds(legacy), legacy.planned_minutes * 60);
});
test("Fokusdauer je Block und bei Pause ändern erhält Fokuszeit und Standarddauer", () => {
  const s = newState(uid);
  const standard = preferences(s).focus_minutes;
  run(s, { type: "work", date, action: "start", minutes: 25 });
  const w = s.work_sessions[0];
  assert.equal(plannedSeconds(w), 1500);
  run(
    s,
    { type: "work", date, action: "pause" },
    new Date(now.getTime() + 10000),
  );
  run(
    s,
    { type: "work", date, action: "set-duration", minutes: 45 },
    new Date(now.getTime() + 20000),
  );
  assert.equal(plannedSeconds(w), 2700);
  assert.equal(w.status, "paused");
  assert.equal(focusSeconds(w, new Date(now.getTime() + 30000)), 10);
  assert.equal(preferences(s).focus_minutes, standard);
  assert.throws(
    () => run(s, { type: "work", date, action: "set-duration", minutes: 0.1 }),
    /Gesamtdauer/,
  );
  assert.throws(
    () => run(s, { type: "work", date, action: "set-duration" }),
    /Fokusdauer/,
  );
  for (const minutes of [0, 241, Infinity])
    assert.equal(
      commandSchema.safeParse({ type: "work", date, action: "start", minutes })
        .success,
      false,
    );
});
test("Vier eigene Signaltöne erzeugen unterschiedliche endliche Audiosignale und respektieren Lautstärke", () => {
  const signals = alarmTones.map((t) => toneSamples(t, 0.5, 8000));
  for (const signal of signals) {
    assert.equal(signal.length, 10400);
    assert.ok(
      [...signal].every((v) => Number.isFinite(v) && Math.abs(v) <= 0.15),
    );
    assert.ok(signal.some((v) => Math.abs(v) > 0.01));
  }
  for (let i = 0; i < signals.length; i++)
    for (let j = i + 1; j < signals.length; j++)
      assert.notDeepEqual(signals[i], signals[j]);
  assert.ok(toneSamples("bell", 0).every((v) => v === 0));
});
