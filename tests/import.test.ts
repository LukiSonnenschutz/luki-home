import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { newState } from "../src/lib/model";
import { ensureDay, applyCommand } from "../src/lib/domain";
import { exportState } from "../src/lib/export";
import {
  importArchive,
  validateImportedState,
  isEmptyForImport,
} from "../src/lib/import";
const source = "00000000-0000-4000-8000-000000000001",
  target = "00000000-0000-4000-8000-000000000002";
test("ZIP-Übernahme erhält Beziehungen und ordnet alle Daten dem neuen Auth-Konto zu", async () => {
  const s = newState(source);
  const date = "2026-10-04";
  const now = new Date("2026-10-04T08:00:00Z");
  ensureDay(s, date);
  applyCommand(
    s,
    {
      type: "task-create",
      date,
      title: "Übernehmen",
      notes: "",
      due_date: null,
    },
    now,
  );
  applyCommand(
    s,
    { type: "highlight", date, id: s.tasks[0].id, enabled: true },
    now,
  );
  const imported = await importArchive(await exportState(s, now), target);
  assert.equal(imported.profile.user_id, target);
  assert.equal(imported.tasks[0].user_id, target);
  assert.equal(imported.tasks[0].id, s.tasks[0].id);
  assert.deepEqual(imported.day_plans[0].highlights, [s.tasks[0].id]);
  assert.equal(
    imported.anchor_entries[0].anchor_id,
    s.anchor_entries[0].anchor_id,
  );
  assert.equal(isEmptyForImport(imported), false);
  const bad = structuredClone(s);
  bad.day_plans[0].focus_task_id = crypto.randomUUID();
  assert.throws(() => validateImportedState(bad, target), /Verknüpfungen/);
  bad.day_plans[0].focus_task_id = null;
  bad.tasks[0].user_id = target;
  assert.throws(() => validateImportedState(bad, target), /Nutzerzuordnungen/);
});
test("Import prüft Manifest, Formatversion und leere Zielzugänge", async () => {
  const s = newState(source);
  ensureDay(s, "2026-10-04");
  assert.equal(isEmptyForImport(s), true);
  s.anchor_entries[0].note = "Eigene Daten";
  assert.equal(isEmptyForImport(s), false);
  const zip = await JSZip.loadAsync(await exportState(s, new Date()));
  const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
  manifest.counts["tasks.json"] = 123;
  zip.file("manifest.json", JSON.stringify(manifest));
  await assert.rejects(
    importArchive(await zip.generateAsync({ type: "uint8array" }), target),
    /Manifest/,
  );
  manifest.export_schema_version = 99;
  zip.file("manifest.json", JSON.stringify(manifest));
  await assert.rejects(
    importArchive(await zip.generateAsync({ type: "uint8array" }), target),
  );
});
