import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { applyCommand, ensureDay } from "../src/lib/domain";
import type { State } from "../src/lib/model";
test("Cloud-RPC: vollständiger Roundtrip, Revisionen, Isolation und atomarer Rollback", async () => {
  const db = new PGlite();
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002";
  try {
    await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role authenticated;create role anon;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
      create table public.profiles(business_marker text);insert into public.profiles values('OS remains unchanged');insert into auth.users values('${a}'),('${b}');`);
    const folder = new URL("../supabase/migrations/", import.meta.url);
    for (const name of (await readdir(folder)).sort())
      await db.exec(await readFile(new URL(name, folder), "utf8"));
    await db.exec(`set role authenticated;set app.uid='${a}';`);
    const load = async () =>
      (
        await db.query<{ state: State }>(
          "select public.luki_home_get_state() as state",
        )
      ).rows[0].state;
    const state = await load();
    assert.equal(state.anchor_definitions.length, 5);
    assert.equal(state.revision, 0);
    const now = new Date("2026-10-04T15:00:00Z"),
      date = "2026-10-04";
    ensureDay(state, date);
    applyCommand(
      state,
      {
        type: "task-create",
        date,
        title: "Cloud-Aufgabe",
        notes: "Notiz",
        due_date: date,
      },
      now,
    );
    applyCommand(
      state,
      {
        type: "day",
        date,
        focus_text: "Fokus",
        focus_task_id: state.tasks[0].id,
        training_note: "Upper A",
        training_time: "18:00",
      },
      now,
    );
    applyCommand(
      state,
      { type: "highlight", date, id: state.tasks[0].id, enabled: true },
      now,
    );
    applyCommand(
      state,
      {
        type: "anchor",
        date,
        id: state.anchor_entries[0].id,
        status: "done",
        actual_local_time: "07:42",
        note: "Nachgetragen",
      },
      now,
    );
    applyCommand(
      state,
      {
        type: "checkin",
        date,
        energy: 4,
        mood: 3,
        stress: 2,
        helped_text: "Bewegung",
        tomorrow_text: "Ruhe",
        submit: true,
      },
      now,
    );
    await db.query("select public.luki_home_save_state($1::jsonb,$2)", [
      JSON.stringify(state),
      0,
    ]);
    const saved = await load();
    assert.equal(saved.revision, 1);
    assert.equal(saved.day_plans[0].training_time, "18:00");
    assert.deepEqual(saved.day_plans[0].highlights, [state.tasks[0].id]);
    assert.equal(
      saved.anchor_entries.find((e) => e.id === state.anchor_entries[0].id)!
        .actual_local_time,
      "07:42",
    );
    assert.equal(saved.checkins[0].energy, 4);
    await assert.rejects(
      db.query("select public.luki_home_save_state($1::jsonb,$2)", [
        JSON.stringify(state),
        0,
      ]),
      /Revision conflict/,
    );
    const invalid = structuredClone(saved);
    invalid.day_plans[0].focus_task_id = crypto.randomUUID();
    await assert.rejects(
      db.query("select public.luki_home_save_state($1::jsonb,$2)", [
        JSON.stringify(invalid),
        1,
      ]),
      /foreign key/,
    );
    const intact = await load();
    assert.equal(intact.revision, 1);
    assert.equal(intact.tasks[0].title, "Cloud-Aufgabe");
    await db.exec(`set app.uid='${b}';`);
    const other = await load();
    assert.equal(other.tasks.length, 0);
    await assert.rejects(
      db.query("select public.luki_home_save_state($1::jsonb,$2)", [
        JSON.stringify(saved),
        0,
      ]),
      /Invalid owner/,
    );
    await db.exec(`reset role;`);
    assert.equal(
      (
        await db.query<{ business_marker: string }>(
          "select * from public.profiles",
        )
      ).rows[0].business_marker,
      "OS remains unchanged",
    );
    await db.exec("set role anon;");
    await assert.rejects(
      db.query("select public.luki_home_get_state()"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
