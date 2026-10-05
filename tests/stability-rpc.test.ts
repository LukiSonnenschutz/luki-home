import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { applyCommand } from "../src/lib/domain";
import { upgradeState } from "../src/lib/stability";
import type { State } from "../src/lib/model";
test("0.1→0.2 Migration, RPC-Roundtrip, alter Client, Owner-RLS und atomarer Konflikt", async () => {
  const db = new PGlite(),
    a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002",
    date = "2026-10-05",
    now = new Date("2026-10-05T10:00:00Z");
  try {
    await db.exec(
      `create schema auth;create table auth.users(id uuid primary key);create role authenticated;create role anon;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.uid',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${a}'),('${b}');`,
    );
    const folder = new URL("../supabase/migrations/", import.meta.url),
      files = (await readdir(folder)).sort();
    for (const name of files.filter(
      (n) => !n.includes("v02") && !n.includes("v03"),
    ))
      await db.exec(await readFile(new URL(name, folder), "utf8"));
    await db.exec(`set role authenticated;set app.uid='${a}';`);
    const load = async (version = 2) =>
      upgradeState(
        (
          await db.query<{ s: State }>(
            `select public.luki_home_get_state${version === 2 ? "_v2" : ""}() s`,
          )
        ).rows[0].s,
      );
    let state = await load(1);
    applyCommand(
      state,
      {
        type: "task-create",
        date,
        title: "Bestehende Aufgabe",
        notes: "Unverändert",
        due_date: date,
      },
      now,
    );
    await db.query("select public.luki_home_save_state($1::jsonb,$2)", [
      JSON.stringify(state),
      0,
    ]);
    await db.exec("reset role");
    for (const name of files.filter((n) => n.includes("v02")))
      await db.exec(await readFile(new URL(name, folder), "utf8"));
    await db.exec(`set role authenticated;set app.uid='${a}';`);
    state = await load();
    assert.equal(state.tasks[0].notes, "Unverändert");
    assert.equal(state.revision, 1);
    applyCommand(
      state,
      {
        type: "goal-save",
        date,
        id: null,
        title: "Ziel A",
        why: "Darum",
        success_criteria: "Kriterium",
        category: "Firma",
        priority: 1,
        status: "active",
        is_focus: true,
        start_date: null,
        target_date: null,
      },
      now,
    );
    const g = state.goals[0];
    applyCommand(
      state,
      {
        type: "task-edit",
        date,
        id: state.tasks[0].id,
        title: state.tasks[0].title,
        notes: state.tasks[0].notes,
        due_date: date,
        goal_id: g.id,
      },
      now,
    );
    applyCommand(
      state,
      {
        type: "milestone-save",
        date,
        id: null,
        goal_id: g.id,
        title: "Schritt",
        description: "",
        due_date: null,
      },
      now,
    );
    applyCommand(state, { type: "coffee-add", date }, now);
    applyCommand(state, { type: "work", date, action: "start" }, now);
    applyCommand(state, { type: "training-status", date, status: "done" }, now);
    applyCommand(
      state,
      {
        type: "checkin",
        date,
        energy: 4,
        mood: 3,
        stress: 2,
        helped_text: "",
        tomorrow_text: "",
        submit: true,
        movement_done: true,
        training_done: true,
        work_end_kept: true,
      },
      now,
    );
    const save = async (s: State, rev: number) =>
      db.query("select public.luki_home_save_state_v2($1::jsonb,$2)", [
        JSON.stringify(s),
        rev,
      ]);
    await save(state, 1);
    let saved = await load();
    assert.equal(saved.tasks[0].goal_id, g.id);
    assert.equal(saved.goals.length, 1);
    assert.equal(saved.goal_milestones.length, 1);
    assert.equal(saved.daily_metrics[0].value, 1);
    assert.equal(saved.checkins[0].work_end_kept, true);
    assert.equal(saved.day_plans[0].training_status, "done");
    assert.equal(saved.work_sessions[0].status, "active");
    await assert.rejects(save(state, 1), /Revision conflict/);
    const bad = structuredClone(saved);
    bad.goal_milestones[0].goal_id = crypto.randomUUID();
    await assert.rejects(
      save(bad, saved.revision),
      /foreign key|row-level security/,
    );
    assert.equal((await load()).revision, saved.revision);
    // A still-open v1 app omits extension fields. Its write must retain the v2 relations and flags.
    const legacy = structuredClone(saved);
    delete legacy.tasks[0].goal_id;
    delete legacy.day_plans[0].training_status;
    delete legacy.checkins[0].work_end_kept;
    await db.query("select public.luki_home_save_state($1::jsonb,$2)", [
      JSON.stringify(legacy),
      saved.revision,
    ]);
    saved = await load();
    assert.equal(saved.tasks[0].goal_id, g.id);
    assert.equal(saved.checkins[0].work_end_kept, true);
    assert.equal(saved.day_plans[0].training_status, "done");
    assert.equal(saved.coffee_entries.length, 1);
    await db.exec(`set app.uid='${b}';`);
    const other = await load();
    assert.equal(other.tasks.length, 0);
    assert.equal(other.goals.length, 0);
    for (const table of [
      "goals",
      "goal_milestones",
      "coffee_entries",
      "work_sessions",
      "daily_metrics",
    ]) {
      assert.equal(
        (await db.query(`select * from luki_home.${table}`)).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            `update luki_home.${table} set user_id='${b}' where user_id='${a}' returning id`,
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            `delete from luki_home.${table} where user_id='${a}' returning id`,
          )
        ).rows.length,
        0,
      );
    }
    const foreign = structuredClone(other);
    foreign.goals = [g];
    await assert.rejects(save(foreign, other.revision), /Invalid row owner/);
    await assert.rejects(
      db.query(
        "insert into luki_home.goal_milestones select (jsonb_populate_record(null::luki_home.goal_milestones,$1::jsonb)).*",
        [
          JSON.stringify({
            ...saved.goal_milestones[0],
            id: crypto.randomUUID(),
            user_id: b,
          }),
        ],
      ),
      /row-level security|foreign key/,
    );
    await db.exec(`set app.uid='${a}';`);
    assert.equal((await load()).goals.length, 1);
    await db.exec("reset role;set role anon");
    await assert.rejects(
      db.query("select public.luki_home_get_state_v2()"),
      /permission denied/,
    );
    for (const table of [
      "goals",
      "goal_milestones",
      "coffee_entries",
      "work_sessions",
      "daily_metrics",
    ])
      await assert.rejects(
        db.query(`select * from luki_home.${table}`),
        /permission denied/,
      );
  } finally {
    await db.close();
  }
});
