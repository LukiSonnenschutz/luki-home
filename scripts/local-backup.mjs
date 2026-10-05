import { DatabaseSync, backup } from "node:sqlite";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { randomBytes, scryptSync, createCipheriv } from "node:crypto";
const passphrase = process.env.LUKI_BACKUP_PASSPHRASE;
if (!passphrase || passphrase.length < 16)
  throw new Error(
    "LUKI_BACKUP_PASSPHRASE muss mindestens 16 Zeichen enthalten.",
  );
const source = resolve(process.env.LUKI_DB_PATH || "data/luki-home.sqlite");
const target = resolve(process.env.LUKI_BACKUP_DIR || "backups");
await mkdir(target, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const snapshot = resolve(
  target,
  `.snapshot-${randomBytes(8).toString("hex")}.sqlite`,
);
const output = resolve(target, `luki-home-${stamp}.luki-backup`);
const database = new DatabaseSync(source, { readOnly: true });
try {
  await backup(database, snapshot);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    scryptSync(passphrase, salt, 32),
    iv,
  );
  const encrypted = Buffer.concat([
    cipher.update(await readFile(snapshot)),
    cipher.final(),
  ]);
  await writeFile(
    output,
    JSON.stringify({
      format: "luki-local-backup",
      version: 1,
      created_at: new Date().toISOString(),
      cipher: "aes-256-gcm",
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: encrypted.toString("base64"),
    }),
    { flag: "wx" },
  );
  // A heartbeat marker for monitoring tools. It never contains credentials.
  await writeFile(
    resolve(dirname(output), "last-success.json"),
    JSON.stringify({
      created_at: new Date().toISOString(),
      filename: output.split(/[\\/]/).pop(),
    }),
  );
  console.log(`Verschlüsseltes Backup erstellt: ${output}`);
} finally {
  database.close();
  await unlink(snapshot).catch(() => {});
}
