import test from "node:test";
import assert from "node:assert/strict";
import { newState, commandSchema, dateSchema } from "../src/lib/model";
import { applyCommand, ensureDay, evaluateRules } from "../src/lib/domain";
import { localClock } from "../src/lib/time";
import { exportState } from "../src/lib/export";
import JSZip from "jszip";
const date = "2026-10-04";
const uid = "00000000-0000-4000-8000-000000000001";
test("Tagesinitialisierung ist idempotent und übernimmt keine erledigten Anker", () => {
  const s = newState(uid);
  ensureDay(s, date);
  s.anchor_entries[0].status = "done";
  ensureDay(s, date);
  ensureDay(s, "2026-10-05");
  assert.equal(s.day_plans.length, 2);
  assert.equal(s.anchor_entries.length, 10);
  assert.equal(s.anchor_entries[5].status, "pending");
});
test("Snapshots bleiben nach Änderungen erhalten; deaktivierte Anker fehlen am nächsten Tag", () => {
  const s = newState(uid);
  ensureDay(s, date);
  const before = s.anchor_entries[0].description_snapshot;
  s.anchor_definitions[0].description = "Neu";
  s.anchor_definitions[1].enabled = false;
  ensureDay(s, "2026-10-05");
  assert.equal(s.anchor_entries[0].description_snapshot, before);
  assert.equal(
    s.anchor_entries.filter((e) => e.local_date === "2026-10-05").length,
    4,
  );
});
test("Regeln: genaue Zeitgrenze, Priorität, Snooze, Schließen, Wiederöffnen und historische Tage", () => {
  const s = newState(uid);
  s.settings.preferences!.wake_weekend = "08:00";
  ensureDay(s, date);
  assert.equal(evaluateRules(s, date, new Date("2026-10-04T06:00:00Z")), null);
  assert.equal(
    evaluateRules(s, date, new Date("2026-10-04T06:01:00Z"))?.rule_id,
    "wake_up_late",
  );
  const now = new Date("2026-10-04T15:00:00Z");
  const event = evaluateRules(s, date, now)!;
  assert.equal(event.rule_id, "work_end_due");
  const count = s.intervention_events.length;
  evaluateRules(s, date, now);
  assert.equal(s.intervention_events.length, count);
  applyCommand(
    s,
    { type: "intervention", date, id: event.id, action: "snooze" },
    now,
  );
  assert.notEqual(evaluateRules(s, date, now)?.rule_id, "work_end_due");
  assert.equal(
    evaluateRules(s, date, new Date(now.getTime() + 30 * 60_000))?.rule_id,
    "work_end_due",
  );
  applyCommand(
    s,
    { type: "intervention", date, id: event.id, action: "dismiss" },
    now,
  );
  assert.notEqual(evaluateRules(s, date, now)?.rule_id, "work_end_due");
  const wake = s.anchor_entries[0];
  wake.status = "done";
  assert.notEqual(evaluateRules(s, date, now)?.rule_id, "wake_up_late");
  wake.status = "pending";
  assert.equal(evaluateRules(s, date, now)?.rule_id, "wake_up_late");
  wake.status = "skipped";
  assert.notEqual(evaluateRules(s, date, now)?.rule_id, "wake_up_late");
  s.settings.rules.movement_missing = false;
  assert.equal(evaluateRules(s, date, now), null);
  assert.equal(evaluateRules(s, "2026-10-03", now), null);
});
test("Drei Prioritäten und Löschen aller Verknüpfungen", () => {
  const s = newState(uid);
  const now = new Date();
  const p = ensureDay(s, date);
  for (let i = 0; i < 4; i++)
    applyCommand(
      s,
      {
        type: "task-create",
        date,
        title: `Aufgabe ${i}`,
        notes: "",
        due_date: null,
      },
      now,
    );
  for (let i = 0; i < 3; i++)
    applyCommand(
      s,
      { type: "highlight", date, id: s.tasks[i].id, enabled: true },
      now,
    );
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "highlight", date, id: s.tasks[3].id, enabled: true },
        now,
      ),
    /höchstens/,
  );
  p.focus_task_id = s.tasks[0].id;
  p.focus_text = "Bleibt";
  applyCommand(s, { type: "task-delete", date, id: s.tasks[0].id }, now);
  assert.equal(p.highlights.length, 2);
  assert.equal(p.focus_task_id, null);
  assert.equal(p.focus_text, "Bleibt");
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "task-status", date, id: crypto.randomUUID(), status: "done" },
        now,
      ),
    /nicht gefunden/,
  );
});
test("Check-in Entwurf und Abschluss aktualisieren genau einen Tagesdatensatz", () => {
  const s = newState(uid);
  const now = new Date();
  const base = {
    type: "checkin" as const,
    date,
    energy: 3,
    mood: 4,
    stress: null,
    helped_text: "Spaziergang",
    tomorrow_text: "",
  };
  applyCommand(s, { ...base, submit: false }, now);
  assert.equal(s.checkins[0].submitted_at, null);
  assert.throws(
    () => applyCommand(s, { ...base, submit: true }, now),
    /Bewertungen/,
  );
  applyCommand(s, { ...base, stress: 2, submit: true }, now);
  assert.equal(s.checkins.length, 1);
  assert.ok(s.checkins[0].submitted_at);
});
test("Europe/Berlin: Mitternacht und beide Zeitumstellungen", () => {
  assert.deepEqual(
    localClock(new Date("2026-10-03T22:00:00Z"), "Europe/Berlin"),
    { date: "2026-10-04", time: "00:00" },
  );
  assert.equal(
    localClock(new Date("2026-03-29T01:30:00Z"), "Europe/Berlin").time,
    "03:30",
  );
  assert.equal(
    localClock(new Date("2026-10-25T00:30:00Z"), "Europe/Berlin").time,
    "02:30",
  );
  assert.equal(
    localClock(new Date("2026-10-25T01:30:00Z"), "Europe/Berlin").time,
    "02:30",
  );
});
test("Validierung verweigert falsche Datumswerte, Zeiten und Scores", () => {
  assert.equal(dateSchema.safeParse("2026-02-30").success, false);
  assert.equal(
    commandSchema.safeParse({
      type: "checkin",
      date,
      energy: 6,
      mood: 1,
      stress: 2,
      helped_text: "",
      tomorrow_text: "",
      submit: true,
    }).success,
    false,
  );
  assert.equal(
    commandSchema.safeParse({
      type: "anchor",
      date,
      id: uid,
      status: "done",
      actual_local_time: "25:00",
      note: "",
    }).success,
    false,
  );
});
test("ZIP-Export enthält mehr als 1000 Einträge und alle Beziehungen", async () => {
  const s = newState(uid);
  const now = new Date();
  for (let i = 0; i < 1105; i++)
    applyCommand(
      s,
      { type: "task-create", date, title: `T${i}`, notes: "", due_date: null },
      now,
    );
  applyCommand(
    s,
    { type: "highlight", date, id: s.tasks[0].id, enabled: true },
    now,
  );
  const zip = await JSZip.loadAsync(await exportState(s, now));
  const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
  const tasks = JSON.parse(await zip.file("tasks.json")!.async("string"));
  assert.equal(manifest.counts["tasks.json"], 1105);
  assert.equal(tasks.length, 1105);
  const highlights = JSON.parse(
    await zip.file("day_task_highlights.json")!.async("string"),
  );
  assert.equal(highlights[0].task_id, s.tasks[0].id);
  assert.ok(
    !Object.keys(zip.files).some((k) => /password|^sessions\.json$|secret/.test(k)),
  );
});
