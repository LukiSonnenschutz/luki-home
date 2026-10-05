import { DatabaseSync } from "node:sqlite";
import { scryptSync, randomBytes } from "node:crypto";
import { resolve } from "node:path";
const email = process.argv[2]?.toLowerCase();
const password = process.env.LUKI_NEW_PASSWORD;
if (!email || !password || password.length < 12 || password.length > 128)
  throw new Error(
    "E-Mail als Argument und LUKI_NEW_PASSWORD (12–128 Zeichen) erforderlich.",
  );
const db = new DatabaseSync(
  resolve(process.env.LUKI_DB_PATH || "data/luki-home.sqlite"),
);
try {
  db.exec("BEGIN IMMEDIATE");
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 64).toString("hex");
  const result = db
    .prepare("UPDATE accounts SET password_hash = ? WHERE email = ?")
    .run(`${salt}:${digest}`, email);
  if (result.changes !== 1) throw new Error("Konto nicht gefunden.");
  db.prepare(
    "DELETE FROM sessions WHERE user_id = (SELECT id FROM accounts WHERE email = ?)",
  ).run(email);
  db.exec("COMMIT");
  console.log("Passwort geändert. Vorhandene Sitzungen wurden beendet.");
} catch (e) {
  db.exec("ROLLBACK");
  throw e;
} finally {
  db.close();
}
