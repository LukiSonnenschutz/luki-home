import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { newState, type State } from "./model";
import { upgradeState } from "./stability";

let instance: DatabaseSync | undefined;
export function db() {
  if (!instance) {
    const path = resolve(process.env.LUKI_DB_PATH || "data/luki-home.sqlite");
    mkdirSync(dirname(path), { recursive: true });
    instance = new DatabaseSync(path);
    const version = instance.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    if (version.user_version > 1) {
      instance.close();
      instance = undefined;
      throw new Error(
        "Diese Datenbank benötigt eine neuere Luki-Home-Version.",
      );
    }
    instance.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS states(user_id TEXT PRIMARY KEY REFERENCES accounts(id), revision INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL CHECK(json_valid(payload)));
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(id), expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS login_attempts(bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
      PRAGMA user_version=1;`);
  }
  return instance;
}
export function transaction<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    d.exec("COMMIT");
    return result;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
export function createState(userId: string, name: string) {
  const s = newState(userId, name);
  db()
    .prepare("INSERT INTO states(user_id, payload) VALUES (?, ?)")
    .run(userId, JSON.stringify(s));
}
export function readState(userId: string): State {
  const row = db()
    .prepare("SELECT payload FROM states WHERE user_id = ?")
    .get(userId) as { payload: string } | undefined;
  if (!row) throw new Error("Profil nicht gefunden.");
  return upgradeState(JSON.parse(row.payload) as State);
}
export function updateState<T>(userId: string, fn: (state: State) => T) {
  return transaction(() => {
    const state = readState(userId);
    const before = JSON.stringify(state);
    const result = fn(state);
    if (JSON.stringify(state) !== before) {
      state.revision++;
      db()
        .prepare(
          "UPDATE states SET payload = ?, revision = ? WHERE user_id = ?",
        )
        .run(JSON.stringify(state), state.revision, userId);
    }
    return { state, result };
  });
}
