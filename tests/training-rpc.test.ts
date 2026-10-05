import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { applyCommand } from "../src/lib/domain";
import { upgradeState } from "../src/lib/stability";
import { emptyTargets, trainingCollections } from "../src/lib/training";
import type { State, Command } from "../src/lib/model";
test("0.3 PostgreSQL: Migration, v3-Roundtrip, zwei Owner, Anon-Sperre, Import, Konflikt und unveränderliche Historie", async () => {
  const db = new PGlite(),
    a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002",
    date = "2026-10-05",
    now = new Date("2026-10-05T10:00:00Z");
  try {
    await db.exec(
      `create schema auth;create table auth.users(id uuid primary key);create role authenticated;create role anon;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.uid',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${a}'),('${b}');create table public.business(marker text);insert into public.business values('untouched');`,
    );
    const folder = new URL("../supabase/migrations/", import.meta.url),
      files = (await readdir(folder)).sort();
    for (const name of files.filter((n) => !n.includes("v03")))
      await db.exec(await readFile(new URL(name, folder), "utf8"));
    await db.exec(`set role authenticated;set app.uid='${a}';`);
    const load = async (v = 3) =>
      upgradeState(
        (
          await db.query<{ s: State }>(
            `select public.luki_home_get_state_v${v}() s`,
          )
        ).rows[0].s,
      );
    let s = await load(2);
    applyCommand(
      s,
      {
        type: "task-create",
        date,
        title: "0.2 bleibt",
        notes: "Wichtig",
        due_date: null,
      },
      now,
    );
    await db.query("select public.luki_home_save_state_v2($1::jsonb,$2)", [
      JSON.stringify(s),
      s.revision,
    ]);
    const before = await load(2);
    await db.exec("reset role");
    for (const name of files.filter((n) => n.includes("v03")))
      await db.exec(await readFile(new URL(name, folder), "utf8"));
    await db.exec(`set role authenticated;set app.uid='${a}';`);
    s = await load();
    assert.deepEqual(s.tasks, before.tasks);
    assert.equal(s.revision, before.revision);
    const mutate = (c: Command) => applyCommand(s, c, now),
      save = async () => {
        await db.query("select public.luki_home_save_state_v3($1::jsonb,$2)", [
          JSON.stringify(s),
          s.revision,
        ]);
        s = await load();
      };
    mutate({
      type: "training-plan-save",
      date,
      id: null,
      name: "Plan A",
      description: "",
    });
    const plan = s.training_plans[0].id;
    mutate({
      type: "training-template-save",
      date,
      id: null,
      training_plan_id: plan,
      name: "Upper",
      description: "",
      workout_type: "strength",
    });
    const template = s.workout_templates[0].id;
    mutate({
      type: "training-item-save",
      date,
      id: null,
      target_id: template,
      scope: "template",
      item_type: "strength",
      name: "Bench",
      description: "",
      targets: { ...emptyTargets },
      notes: "",
    });
    mutate({
      type: "training-schedule",
      date,
      id: null,
      workout_template_id: template,
      planned_date: date,
      action: "save",
    });
    mutate({
      type: "training-start",
      date,
      template_id: template,
      scheduled_id: s.scheduled_workouts[0].id,
    });
    await save();
    const session = s.workout_sessions[0].id,
      item = s.workout_session_items[0].id,
      set = s.workout_sets[0].id;
    mutate({
      type: "training-set",
      date,
      id: set,
      weight: 80,
      reps: 8,
      distance: null,
      duration: null,
      rpe: 8,
      rir: 1,
      notes: "Satz",
      completed: true,
    });
    mutate({
      type: "training-finish",
      date,
      id: session,
      notes: "Fertig",
      rating: 4,
    });
    await save();
    assert.equal(s.workout_sessions[0].status, "completed");
    assert.equal(s.workout_sets[0].weight, 80);
    assert.equal(s.scheduled_workouts[0].status, "done");
    // Re-saving an identical completed snapshot remains valid.
    await save();
    const frozen = JSON.stringify(s.workout_sessions[0]);
    mutate({
      type: "training-start",
      date,
      template_id: template,
      scheduled_id: null,
    });
    await save();
    const active = s.workout_sessions.find((w) => w.status === "active")!,
      activeItem = s.workout_session_items.find(
        (i) => i.workout_session_id === active.id,
      )!;
    const rejects = [
      [
        `update luki_home.workout_sessions set data=jsonb_set(data,'{notes}','"changed"') where id='${session}'`,
      ],
      [`delete from luki_home.workout_sessions where id='${session}'`],
      [
        `update luki_home.workout_session_items set workout_session_id='${active.id}',data=jsonb_set(data,'{workout_session_id}','"${active.id}"') where id='${item}'`,
      ],
      [
        `update luki_home.workout_sets set session_item_id='${activeItem.id}',data=jsonb_set(data,'{session_item_id}','"${activeItem.id}"') where id='${set}'`,
      ],
      [`delete from luki_home.workout_sets where id='${set}'`],
      [`delete from luki_home.workout_session_items where id='${item}'`],
    ];
    for (const [sql] of rejects)
      await assert.rejects(db.exec(sql), /immutable/);
    const extra = {
      ...s.workout_sets.find((r) => r.id === set)!,
      id: crypto.randomUUID(),
      set_number: 99,
    };
    await assert.rejects(
      db.query(
        "insert into luki_home.workout_sets(id,user_id,data,session_item_id) values($1,$2,$3::jsonb,$4)",
        [extra.id, a, JSON.stringify(extra), item],
      ),
      /immutable/,
    );
    const changed = structuredClone(s);
    changed.workout_sets.find((r) => r.id === set)!.reps = 99;
    await assert.rejects(
      db.query("select public.luki_home_save_state_v3($1::jsonb,$2)", [
        JSON.stringify(changed),
        s.revision,
      ]),
      /immutable/,
    );
    assert.equal((await load()).revision, s.revision);
    assert.equal(
      JSON.stringify(
        (await load()).workout_sessions.find((w) => w.id === session),
      ),
      frozen,
    );
    const stale = structuredClone(s);
    stale.training_plans[0].name = "Must roll back";
    await assert.rejects(
      db.query("select public.luki_home_save_state_v3($1::jsonb,$2)", [
        JSON.stringify(stale),
        s.revision - 1,
      ]),
      /Revision conflict/,
    );
    assert.equal((await load()).training_plans[0].name, "Plan A");
    // v2 preferences preserve fields introduced in v3.
    s.settings.preferences!.alarm_tone = "digital";
    s.settings.preferences!.training_enabled = false;
    await save();
    const old = structuredClone(s);
    delete (
      old.settings.preferences! as Partial<
        NonNullable<typeof old.settings.preferences>
      >
    ).alarm_tone;
    delete (
      old.settings.preferences! as Partial<
        NonNullable<typeof old.settings.preferences>
      >
    ).training_enabled;
    await db.query("select public.luki_home_save_state_v2($1::jsonb,$2)", [
      JSON.stringify(old),
      s.revision,
    ]);
    s = await load();
    assert.equal(s.settings.preferences!.alarm_tone, "digital");
    assert.equal(s.settings.preferences!.training_enabled, false);
    await db.exec(`set app.uid='${b}';`);
    const other = await load();
    for (const table of trainingCollections) {
      assert.equal(
        (await db.query(`select * from luki_home.${table}`)).rows.length,
        0,
      );
      assert.equal(
        (await db.query(`update luki_home.${table} set data=data returning id`))
          .rows.length,
        0,
      );
      assert.equal(
        (await db.query(`delete from luki_home.${table} returning id`)).rows
          .length,
        0,
      );
    }
    for (const [table, fields] of [
      ["workout_template_items", ["workout_template_id"]],
      ["scheduled_workouts", ["workout_template_id"]],
      [
        "workout_sessions",
        [
          "workout_template_id",
          "scheduled_workout_id",
          "status",
          "completed_at",
        ],
      ],
      ["workout_session_items", ["workout_session_id", "template_item_id"]],
      ["workout_sets", ["session_item_id"]],
    ] as const) {
      const source = s[table][0] as unknown as Record<string, unknown>;
      const row: Record<string, unknown> = {
        ...source,
        id: crypto.randomUUID(),
        user_id: b,
      };
      if (table === "workout_sessions") {
        row.status = "active";
        row.completed_at = null;
      }
      const columns = ["id", "user_id", "data", ...fields];
      const values = [
        row.id,
        b,
        JSON.stringify(row),
        ...fields.map((f) => row[f]),
      ];
      await assert.rejects(
        db.query(
          `insert into luki_home.${table}(${columns.join(",")}) values(${columns.map((_, i) => "$" + (i + 1) + (i === 2 ? "::jsonb" : "")).join(",")})`,
          values,
        ),
        /foreign key|row-level security/,
      );
    }
    const row = {
      ...s.workout_templates[0],
      id: crypto.randomUUID(),
      user_id: b,
    };
    await assert.rejects(
      db.query(
        "insert into luki_home.workout_templates(id,user_id,data,training_plan_id) values($1,$2,$3::jsonb,$4)",
        [row.id, b, JSON.stringify(row), plan],
      ),
      /foreign key/,
    );
    const foreign = { ...s.training_plans[0], id: crypto.randomUUID() };
    await assert.rejects(
      db.query(
        "insert into luki_home.training_plans(id,user_id,data) values($1,$2,$3::jsonb)",
        [foreign.id, a, JSON.stringify(foreign)],
      ),
      /row-level security/,
    );
    // Completed snapshot import stages its parent until children are stored.
    const imported = structuredClone(s);
    imported.profile = other.profile;
    imported.revision = other.revision;
    imported.anchor_definitions = other.anchor_definitions;
    imported.tasks = [];
    imported.day_plans = [];
    imported.anchor_entries = [];
    for (const key of trainingCollections)
      for (const row of imported[key]) row.user_id = b;
    // UUIDs are globally unique; export import into another deployment can reuse IDs,
    // while this same database test remaps them to model a distinct source deployment.
    const map = new Map(
      trainingCollections.flatMap((k) =>
        imported[k].map((r) => [r.id, crypto.randomUUID()]),
      ),
    );
    for (const key of trainingCollections)
      for (const row of imported[key]) {
        row.id = map.get(row.id)!;
        for (const field of [
          "training_plan_id",
          "workout_template_id",
          "workout_session_id",
          "template_item_id",
          "scheduled_workout_id",
          "session_item_id",
        ] as const) {
          if (field in row) {
            const obj = row as unknown as Record<string, unknown>;
            if (typeof obj[field] === "string")
              obj[field] = map.get(obj[field] as string);
          }
        }
      }
    await db.query("select public.luki_home_save_state_v3($1::jsonb,$2)", [
      JSON.stringify(imported),
      imported.revision,
    ]);
    const restored = await load();
    assert.equal(
      restored.workout_sessions.filter((w) => w.status === "completed").length,
      1,
    );
    assert.ok(restored.workout_sets.some((r) => r.weight === 80));
    await db.exec("reset role;set role anon");
    for (const table of trainingCollections)
      await assert.rejects(
        db.exec(`select * from luki_home.${table}`),
        /permission denied/,
      );
    for (const rpc of ["get_state_v3()", "save_state_v3('{}'::jsonb,0)"])
      await assert.rejects(
        db.exec(`select public.luki_home_${rpc}`),
        /permission denied/,
      );
    await db.exec("reset role");
    assert.equal(
      (await db.query<{ marker: string }>("select marker from public.business"))
        .rows[0].marker,
      "untouched",
    );
    assert.equal(
      (
        await db.query(
          "select * from pg_tables where schemaname='luki_home' and rowsecurity",
        )
      ).rows.length,
      21,
    );
  } finally {
    await db.close();
  }
});
