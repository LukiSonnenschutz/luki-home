import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";

test("v1/v2/v3 revision conflicts use PT409 without changing data, ACL or function behavior", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth; create table auth.users(id uuid primary key);
      create role authenticated; create role anon;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      insert into auth.users values('00000000-0000-4000-8000-000000000001');`);
    const folder = new URL("../supabase/migrations/", import.meta.url);
    const names = (await readdir(folder)).sort();
    for (const name of names.filter((n) => !n.includes("non_retryable")))
      await db.exec(await readFile(new URL(name, folder), "utf8"));
    const metadata = async () =>
      (
        await db.query(
          `select proname, proacl::text, prosecdef, proconfig from pg_proc where proname in ('luki_home_save_state','luki_home_save_state_v2','luki_home_save_state_v3') order by proname`,
        )
      ).rows;
    const before = await metadata();
    const sql = await readFile(
      new URL(
        names.find((n) => n.includes("non_retryable"))!,
        folder,
      ),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql); // Safe if already applied.
    assert.deepEqual(await metadata(), before);
    await db.exec(
      "set role authenticated; set app.uid='00000000-0000-4000-8000-000000000001';",
    );
    const load = async () =>
      (
        await db.query<{ state: unknown }>(
          "select public.luki_home_get_state_v3() as state",
        )
      ).rows[0].state;
    const state = await load();
    for (const name of [
      "luki_home_save_state",
      "luki_home_save_state_v2",
      "luki_home_save_state_v3",
    ]) {
      await assert.rejects(
        db.query(`select public.${name}($1::jsonb,-1)`, [
          JSON.stringify(state),
        ]),
        (e: unknown) => {
          assert.equal((e as { code: string }).code, "PT409");
          return true;
        },
      );
      assert.deepEqual(await load(), state);
    }
    await db.exec("set role anon;");
    await assert.rejects(
      db.query("select public.luki_home_save_state_v3('{}',-1)"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
