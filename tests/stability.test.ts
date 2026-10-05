import test from "node:test";
import assert from "node:assert/strict";
import { newState, commandSchema } from "../src/lib/model";
import { applyCommand, ensureDay, evaluateRules } from "../src/lib/domain";
import {
  coffeeForDay,
  focusSeconds,
  nextStep,
  stabilityHints,
  upgradeState,
} from "../src/lib/stability";
import { exportState } from "../src/lib/export";
import {
  importArchive,
  validateImportedState,
  isEmptyForImport,
} from "../src/lib/import";
const uid = "00000000-0000-4000-8000-000000000001",
  date = "2026-10-05",
  now = new Date("2026-10-05T10:00:00Z");
function goal(s: ReturnType<typeof newState>) {
  applyCommand(
    s,
    {
      type: "goal-save",
      date,
      id: null,
      title: "Belastbare Hüfte",
      why: "Beweglich bleiben",
      success_criteria: "Beschwerdearme Bewegung",
      category: "Gesundheit & Körper",
      priority: 1,
      status: "active",
      is_focus: true,
      start_date: null,
      target_date: null,
    },
    now,
  );
  return s.goals[0];
}
test("Ziele, Statuswechsel, Meilensteine, Reihenfolge und gemeinsame Aufgabenlogik", () => {
  const s = newState(uid),
    g = goal(s);
  applyCommand(
    s,
    {
      type: "task-create",
      date,
      title: "Termin vereinbaren",
      notes: "",
      due_date: date,
      goal_id: g.id,
    },
    now,
  );
  assert.equal(nextStep(s, g.id)?.title, "Termin vereinbaren");
  applyCommand(
    s,
    { type: "task-status", date, id: s.tasks[0].id, status: "done" },
    now,
  );
  assert.equal(nextStep(s, g.id), undefined);
  for (const title of ["Beratung", "Alltagsbewegung"])
    applyCommand(
      s,
      {
        type: "milestone-save",
        date,
        id: null,
        goal_id: g.id,
        title,
        description: "",
        due_date: null,
      },
      now,
    );
  applyCommand(
    s,
    {
      type: "milestone-order",
      date,
      goal_id: g.id,
      ids: [s.goal_milestones[1].id, s.goal_milestones[0].id],
    },
    now,
  );
  assert.equal(s.goal_milestones[1].sort_order, 0);
  applyCommand(
    s,
    {
      type: "milestone-status",
      date,
      id: s.goal_milestones[0].id,
      status: "done",
    },
    now,
  );
  assert.equal(s.goal_milestones[0].completed_at, now.toISOString());
  for (const status of ["paused", "achieved", "discarded", "active"] as const) {
    applyCommand(s, { type: "goal-status", date, id: g.id, status }, now);
    assert.equal(g.status, status);
    assert.equal(!!g.completed_at, status === "achieved");
  }
  applyCommand(s, { type: "goal-focus", date, id: g.id, enabled: false }, now);
  assert.equal(g.is_focus, false);
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: "task-edit",
          date,
          id: s.tasks[0].id,
          title: "T",
          notes: "",
          due_date: null,
          goal_id: crypto.randomUUID(),
        },
        now,
      ),
    /Ziel/,
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "milestone-order", date, goal_id: g.id, ids: [] },
        now,
      ),
    /Sortierung/,
  );
});
test("Kaffee: Zeitzone, Tageswechsel, Uhrzeiten, Cutoff und Tageszähler", () => {
  const s = newState(uid);
  applyCommand(s, { type: "coffee-add", date }, now);
  applyCommand(
    s,
    { type: "coffee-add", date },
    new Date("2026-10-05T11:01:00Z"),
  );
  assert.equal(coffeeForDay(s, date).length, 2);
  assert.equal(s.daily_metrics[0].value, 2);
  assert.equal(coffeeForDay(s, "2026-10-06").length, 0);
  assert.match(
    stabilityHints(s, date, new Date("2026-10-05T11:00:00Z")).join(),
    /Zeitfenster/,
  );
  assert.throws(
    () => applyCommand(s, { type: "coffee-add", date: "2026-10-04" }, now),
    /heute/,
  );
  assert.equal(coffeeForDay(JSON.parse(JSON.stringify(s)), date).length, 2);
});
test("Work-Timer: Pause, Reload, Fortsetzen, Ende, echte Pause und Überziehung", () => {
  const s = newState(uid);
  applyCommand(s, { type: "work", date, action: "start" }, now);
  applyCommand(
    s,
    { type: "work", date, action: "pause" },
    new Date(now.getTime() + 600000),
  );
  let w = s.work_sessions[0];
  assert.equal(focusSeconds(w, new Date(now.getTime() + 1200000)), 600);
  const reloaded = JSON.parse(JSON.stringify(s));
  applyCommand(
    reloaded,
    { type: "work", date, action: "resume" },
    new Date(now.getTime() + 1200000),
  );
  w = reloaded.work_sessions[0];
  assert.equal(focusSeconds(w, new Date(now.getTime() + 1500000)), 900);
  assert.match(
    stabilityHints(reloaded, date, new Date(now.getTime() + 6000000)).join(),
    /zu lange/,
  );
  applyCommand(
    reloaded,
    { type: "work", date, action: "break-start" },
    new Date(now.getTime() + 1500000),
  );
  applyCommand(
    reloaded,
    { type: "work", date, action: "break-end" },
    new Date(now.getTime() + 3000000),
  );
  assert.equal(w.actual_minutes, 15);
  assert.equal(w.break_taken, true);
  assert.equal(w.break_overrun, true);
  assert.equal(w.status, "done");
  assert.throws(
    () => applyCommand(reloaded, { type: "work", date, action: "resume" }, now),
    /Fokusblock/,
  );
  applyCommand(reloaded, { type: "work", date, action: "start" }, now);
  assert.throws(
    () => applyCommand(reloaded, { type: "work", date, action: "start" }, now),
    /laufenden/,
  );
  applyCommand(
    reloaded,
    { type: "work", date, action: "end" },
    new Date(now.getTime() + 60000),
  );
  assert.equal(reloaded.work_sessions[1].actual_minutes, 1);
});
test("Tageswerte, Check-in und Training: keine doppelten Daten; Bewegung unterdrückt Hinweis", () => {
  const s = newState(uid);
  s.settings.rules.wake_up_late = false;
  s.settings.rules.work_end_due = false;
  for (const value of [1800, 1840])
    applyCommand(
      s,
      {
        type: "metric",
        date,
        metric_type: "calories",
        value,
        source: "manual",
      },
      now,
    );
  assert.equal(s.daily_metrics.length, 1);
  assert.equal(s.daily_metrics[0].value, 1840);
  assert.equal(s.daily_metrics[0].target, 2500);
  applyCommand(
    s,
    {
      type: "metric",
      date,
      metric_type: "movement_minutes",
      value: 25,
      source: "manual",
    },
    now,
  );
  assert.equal(evaluateRules(s, date, new Date("2026-10-05T15:00:00Z")), null);
  applyCommand(s, { type: "training-status", date, status: "planned" }, now);
  assert.equal(s.day_plans[0].training_status, "planned");
  for (const stress of [3, 2])
    applyCommand(
      s,
      {
        type: "checkin",
        date,
        energy: 4,
        mood: 4,
        stress,
        helped_text: "Radfahren",
        tomorrow_text: "",
        submit: true,
        movement_done: true,
        training_done: false,
        work_end_kept: true,
      },
      now,
    );
  assert.equal(s.checkins.length, 1);
  assert.equal(s.checkins[0].work_end_kept, true);
  assert.equal(s.checkins[0].stress, 2);
  assert.equal(
    commandSchema.safeParse({
      type: "metric",
      date,
      metric_type: "calories",
      value: -1,
      source: "manual",
    }).success,
    false,
  );
});
test("0.1-Payloads und ZIPs erhalten ihre Daten; 0.2-Export erhält alle Beziehungen", async () => {
  const s = newState(uid);
  ensureDay(s, date);
  goal(s);
  applyCommand(
    s,
    {
      type: "task-create",
      date,
      title: "Nächster Schritt",
      notes: "",
      due_date: null,
      goal_id: s.goals[0].id,
    },
    now,
  );
  applyCommand(s, { type: "coffee-add", date }, now);
  applyCommand(s, { type: "work", date, action: "start" }, now);
  const target = "00000000-0000-4000-8000-000000000002";
  const imported = await importArchive(await exportState(s, now), target);
  assert.equal(imported.tasks[0].goal_id, imported.goals[0].id);
  assert.equal(imported.coffee_entries[0].user_id, target);
  assert.equal(imported.work_sessions[0].user_id, target);
  assert.equal(isEmptyForImport(imported), false);
  const old = JSON.parse(JSON.stringify(newState(uid)));
  delete old.goals;
  delete old.goal_milestones;
  delete old.coffee_entries;
  delete old.work_sessions;
  delete old.daily_metrics;
  delete old.settings.preferences;
  assert.equal(upgradeState(old).anchor_definitions.length, 5);
  assert.equal(validateImportedState(old, target).goals.length, 0);
  const bad = structuredClone(s);
  bad.goal_milestones.push({
    id: crypto.randomUUID(),
    user_id: uid,
    goal_id: crypto.randomUUID(),
    title: "Ungültig",
    description: "",
    status: "open",
    due_date: null,
    sort_order: 0,
    completed_at: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
  assert.throws(() => validateImportedState(bad, target), /Verknüpfungen/);
});
