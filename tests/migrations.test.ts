import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
test("PostgreSQL-Migrationen, Constraints und RLS trennen zwei Nutzer", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth; create table auth.users(id uuid primary key); create role authenticated; create role anon;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    const folder = new URL("../supabase/migrations/", import.meta.url);
    for (const name of (await readdir(folder)).sort())
      await db.exec(await readFile(new URL(name, folder), "utf8"));
    await db.exec("set search_path to luki_home,public;");
    const a = "00000000-0000-4000-8000-000000000001",
      b = "00000000-0000-4000-8000-000000000002",
      task = "00000000-0000-4000-8000-000000000003";
    await db.exec(
      `insert into auth.users values ('${a}'),('${b}'); insert into profiles(user_id,display_name) values ('${a}','A'),('${b}','B'); insert into tasks(id,user_id,title) values ('${task}','${b}','Privat B'); set role authenticated; set app.uid='${a}';`,
    );
    assert.equal((await db.query("select * from tasks")).rows.length, 0);
    await assert.rejects(
      db.query("insert into tasks(user_id,title) values ($1,$2)", [b, "Fremd"]),
      /row-level security/,
    );
    await assert.rejects(
      db.query(
        "insert into day_plans(user_id,local_date,focus_task_id) values ($1,$2,$3)",
        [a, "2026-10-04", task],
      ),
      /foreign key/,
    );
    const own = await db.query<{ id: string }>(
      "insert into tasks(user_id,title) values ($1,$2) returning id",
      [a, "Eigene Aufgabe"],
    );
    await assert.rejects(
      db.query("update tasks set user_id=$1 where id=$2", [b, own.rows[0].id]),
      /row-level security/,
    );
    await assert.rejects(
      db.query(
        "insert into checkins(user_id,local_date,energy) values ($1,$2,6)",
        [a, "2026-10-04"],
      ),
      /check constraint/,
    );
    await assert.rejects(
      db.query(
        "insert into checkins(user_id,local_date,submitted_at) values ($1,$2,now())",
        [a, "2026-10-04"],
      ),
      /check constraint/,
    );
    await db.exec(`reset role; set role anon;`);
    await assert.rejects(
      db.query("select * from luki_home.tasks"),
      /permission denied/,
    );
    await db.exec(`reset role; set role authenticated; set app.uid='${b}';`);
    assert.equal((await db.query("select * from tasks")).rows.length, 1);
    await db.query("delete from tasks where id=$1", [own.rows[0].id]);
    await db.exec(`reset role;`);
    assert.equal((await db.query("select * from tasks")).rows.length, 2);
  } finally {
    await db.close();
  }
});
