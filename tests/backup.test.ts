import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { newState } from "../src/lib/model";
test("Verschlüsseltes Backup und isolierter Restore erhalten Daten und beenden Sitzungen", () => {
  const folder = mkdtempSync(join(tmpdir(), "luki-restore-test-"));
  const source = join(folder, "source.sqlite");
  const target = join(folder, "restored.sqlite");
  const d = new DatabaseSync(source);
  const uid = "00000000-0000-4000-8000-000000000001";
  const state = newState(uid);
  state.profile.display_name = "Restore-Test";
  d.exec(
    "create table accounts(id text primary key,email text,password_hash text,created_at text); create table states(user_id text,revision integer,payload text); create table sessions(token_hash text,user_id text,expires_at integer); create table login_attempts(bucket text,count integer,expires_at integer); pragma user_version=1;",
  );
  d.prepare("insert into accounts values (?,?,?,?)").run(
    uid,
    "fixture@example.invalid",
    "fixture-hash",
    new Date().toISOString(),
  );
  d.prepare("insert into states values (?,?,?)").run(
    uid,
    0,
    JSON.stringify(state),
  );
  d.prepare("insert into sessions values (?,?,?)").run(
    "test-token",
    uid,
    Date.now() + 100000,
  );
  d.close();
  const env = {
    ...process.env,
    LUKI_DB_PATH: source,
    LUKI_BACKUP_DIR: folder,
    LUKI_BACKUP_PASSPHRASE: "isolated-test-passphrase-2026",
  };
  const backup = spawnSync(
    process.execPath,
    [resolve("scripts/local-backup.mjs")],
    { env, encoding: "utf8" },
  );
  assert.equal(backup.status, 0, backup.stderr);
  const archive = join(
    folder,
    readdirSync(folder).find((n) => n.endsWith(".luki-backup"))!,
  );
  assert.ok(!readFileSync(archive, "utf8").includes("Restore-Test"));
  const wrong = spawnSync(
    process.execPath,
    [
      resolve("scripts/local-restore.mjs"),
      archive,
      join(folder, "wrong.sqlite"),
    ],
    {
      env: { ...env, LUKI_BACKUP_PASSPHRASE: "incorrect-test-passphrase" },
      encoding: "utf8",
    },
  );
  assert.notEqual(wrong.status, 0);
  const start = performance.now();
  const restore = spawnSync(
    process.execPath,
    [resolve("scripts/local-restore.mjs"), archive, target],
    { env, encoding: "utf8" },
  );
  assert.equal(restore.status, 0, restore.stderr);
  const restored = new DatabaseSync(target);
  const row = restored.prepare("select payload from states").get() as {
    payload: string;
  };
  assert.deepEqual(JSON.parse(row.payload), state);
  assert.equal(
    (
      restored.prepare("select count(*) as n from sessions").get() as {
        n: number;
      }
    ).n,
    0,
  );
  restored.close();
  assert.notEqual(
    spawnSync(
      process.execPath,
      [resolve("scripts/local-restore.mjs"), archive, target],
      { env },
    ).status,
    0,
  );
  console.log(
    `Isolierter SQLite-Restore: ${Math.round(performance.now() - start)} ms.`,
  );
});
