import { DatabaseSync } from "node:sqlite";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { scryptSync, createDecipheriv } from "node:crypto";
const [sourceArg, targetArg] = process.argv.slice(2);
if (!sourceArg || !targetArg)
  throw new Error(
    "Aufruf: node scripts/local-restore.mjs <Backup> <NEUE Datenbankdatei>",
  );
if (!process.env.LUKI_BACKUP_PASSPHRASE)
  throw new Error("LUKI_BACKUP_PASSPHRASE fehlt.");
const target = resolve(targetArg);
const envelope = JSON.parse(await readFile(resolve(sourceArg), "utf8"));
if (
  envelope.format !== "luki-local-backup" ||
  envelope.version !== 1 ||
  envelope.cipher !== "aes-256-gcm"
)
  throw new Error("Unbekanntes Backupformat.");
const decode = (key) => Buffer.from(envelope[key], "base64");
const decipher = createDecipheriv(
  "aes-256-gcm",
  scryptSync(process.env.LUKI_BACKUP_PASSPHRASE, decode("salt"), 32),
  decode("iv"),
);
decipher.setAuthTag(decode("tag"));
const data = Buffer.concat([decipher.update(decode("data")), decipher.final()]);
await mkdir(dirname(target), { recursive: true });
await writeFile(target, data, { flag: "wx" }); // Refuse overwriting any existing file.
let db;
try {
  db = new DatabaseSync(target);
  const check = db.prepare("PRAGMA integrity_check").get();
  if (Object.values(check)[0] !== "ok")
    throw new Error("Integritätsprüfung fehlgeschlagen.");
  if (Object.values(db.prepare("PRAGMA user_version").get())[0] !== 1)
    throw new Error("Unbekannte Datenbankversion.");
  for (const row of db.prepare("SELECT payload FROM states").all()) {
    const state = JSON.parse(row.payload);
    if (state.schema_version !== 1)
      throw new Error("Unbekannte Datenformatversion.");
  }
  db.exec("DELETE FROM sessions; DELETE FROM login_attempts;");
  console.log(
    `Restore geprüft: ${target}. Sitzungen wurden entfernt; erneute Anmeldung erforderlich.`,
  );
} catch (e) {
  db?.close();
  db = undefined;
  await unlink(target);
  throw e;
} finally {
  db?.close();
}
