# Luki Home 0.1.1

Persönliche Web-App für Fokus, Aufgaben, Stabilitätsanker und Abend-Check-in. Next.js/React/TypeScript, lokaler SQLite-Betrieb oder Supabase Auth/PostgreSQL für Online-Betrieb. Die Projektdateien unter `../sources/` werden nicht verwendet oder verändert. Eine Online-Veröffentlichung ist noch nicht erfolgt.

## Start auf diesem Rechner

**`Start-Luki-Home.cmd` doppelklicken**, dann [Luki Home öffnen](http://127.0.0.1:3100). Beim ersten Besuch Name, E-Mail und Passwort mit mindestens zwölf Zeichen wählen. Die E-Mail ist die lokale Anmeldekennung; die App verschickt keine E-Mails.

Der Start erfolgt auf `127.0.0.1`. Das lokale Konto wird einmal angelegt; es gibt keine öffentliche Registrierung. Zum Beenden im Startfenster Strg+C drücken. Nach einem Neustart bleiben deine Daten erhalten. Der Server muss laufen, damit die App erreichbar ist.

Der bereits durch Codex gestartete Server lässt sich mit `powershell -NoProfile -File .\Stop-Luki-Home.ps1` beenden. Danach kann der normale Starter verwendet werden.

Auf anderen Entwicklungsrechnern mit Node.js 24+ und pnpm:

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Entwicklung: `pnpm dev`. Änderungen am Code brauchen vor dem nächsten Produktionsstart einen neuen Build. Der Windows-Starter verwendet die vorhandene Node-Installation oder den gebündelten Codex-Runtime-Pfad.

## Enthalten

- Anmeldung, Abmeldung und lokale Passwort-Wiederherstellung.
- Heute-Dashboard mit Tagesfokus und optionaler Aufgabenverknüpfung.
- Aufgaben erstellen, bearbeiten, erledigen, wieder öffnen und löschen; Inbox, Fälligkeit und höchstens drei Tagesprioritäten.
- Fünf einstellbare Anker mit Status, tatsächlicher Zeit, Notiz und unabhängigen Tagesdaten.
- Abend-Check-in: Energie, Stimmung und Stress (1–5), zwei Textfelder, Entwurf oder Abschluss.
- Drei zeitabhängige Hinweise mit Priorität, 30 Minuten Snooze und Schließen für den Tag.
- Frühere Tage und Rückblick, responsive Oberfläche, Tastaturbedienung und Dark Mode.
- Vollständiger persönlicher ZIP-Export aller Anwendungsdaten.
- Verschlüsseltes SQLite-Systembackup und geprüfter Restore in eine neue Datei.
- Vorbereitete PostgreSQL-Migrationen mit RLS für einen späteren Supabase-Betrieb.
- Supabase-Adapter mit eigener Sitzung, persönlicher E-Mail-Freigabe, atomarer Speicherung und Konflikterkennung.
- Einmalige Übernahme eines ZIP-Exports in einen noch leeren Online-Zugang.

Die Uhrzeiten 08:00 / 14:00 / 17:00 / 20:30 sind Startwerte und in den Einstellungen veränderbar. Hinweise erscheinen während der sichtbaren App-Nutzung, nicht als Push-Mitteilung bei geschlossenem Browser. Training ist eine freie Tagesnotiz. Trainingstracking, Ziele, Musteranalyse und zusammenführende/überschreibende Importe sind spätere Ausbaustufen.

Konfigurationen beeinflussen neue Tages-Snapshots. Deaktivierte Anker bleiben im bereits begonnenen Tag sichtbar, erzeugen aber keine weiteren Hinweise. Zeitzone, Hinweiszeiten und Regel-Schalter gelten sofort. Während offene Formulare bearbeitet werden, wird der Tagesinhalt nicht im Hintergrund ausgetauscht. Nach einem Tagwechsel wird „Heute“ beim nächsten Laden/Aktualisieren geöffnet, sofern kein historisches Datum ausgewählt ist.

## Daten und Konfiguration

Ohne zusätzliche Konfiguration funktioniert der lokale Betrieb. Optional `.env.example` nach `.env.local` kopieren. `LUKI_DB_PATH` legt einen anderen Datenbankpfad fest. Standard: `data/luki-home.sqlite`, mit zugehörigen WAL-Dateien. Diese Dateien sind vom Git-Tracking ausgeschlossen. Die Daten liegen serverseitig auf diesem Rechner, nicht in Browser-LocalStorage. Das Betriebssystemkonto hat Zugriff auf die Datenbankdateien; SQLite selbst ist nicht verschlüsselt.

SQLite verwendet hier ein versioniertes JSON-Dokument je Konto, das in einer Transaktion geändert wird. Validierung und Domänenregeln sichern Beziehungen und Eingaben. Revisionen verhindern, dass ein alter Browserstand neuere Eingaben überschreibt. Mit `LUKI_STORAGE=supabase` arbeitet derselbe Core mit relationalen PostgreSQL-Tabellen im separaten Schema `luki_home`. Der Cloud-Adapter ist implementiert, aber noch nicht mit einem echten Projekt verbunden. Auf Vercel ist der lokale SQLite-Modus gesperrt; fehlende Online-Konfiguration führt nicht zu einer Ersatzspeicherung auf flüchtigem Server-Dateisystem.

Der Login verwendet gesalzene scrypt-Passworthashes und zufällige serverseitige Sitzungen mit sieben Tagen Laufzeit. Cookies sind HttpOnly/SameSite=Strict, und Schreibaufrufe prüfen den Origin. Zugriffsprüfungen erfolgen auf jedem privaten API-Endpunkt. Der lokale Modus lehnt öffentliche Hostnamen ab; für spätere Veröffentlichung ist Supabase Auth statt lokaler Anmeldung vorgesehen.

## Export

In der Seitenleiste oder den Einstellungen „Daten exportieren“ wählen. Die ZIP-Datei enthält Profil, Einstellungen, Aufgaben, Tagespläne, Prioritäten, Ankerdefinitionen, Tagesanker, Check-ins, Regelereignisse und ein Manifest mit Anzahl je Datei und Formatversion. Zugangsdaten werden nicht exportiert. Im Online-Modus kann dieser Export in den Einstellungen einmalig in einen leeren Zugang übernommen werden. Alle Beziehungen bleiben erhalten; Nutzer-IDs werden dem verifizierten Online-Konto zugeordnet. Ein Zugang mit eigenen Tagesdaten wird nicht überschrieben. Der Export ersetzt nicht das folgende Systembackup.

## Backup und Restore

Die Werkzeuge befinden sich in `scripts/`. Sie benötigen Node.js 24+. Ein Backup nutzt die SQLite-Backup-API für einen konsistenten Snapshot und verschlüsselt ihn mit AES-256-GCM. Das Backup enthält auch das Konto mit Passworthash. Aufbewahrung und automatische Ausführung sind noch nicht eingerichtet; Backup-Speicher und Passphrase müssen zuerst gewählt werden.

Passphrase verdeckt eingeben und Backup erstellen (im App-Verzeichnis):

```powershell
$taskSecret = Read-Host 'Backup-Passphrase (mindestens 16 Zeichen)' -AsSecureString
$env:LUKI_BACKUP_PASSPHRASE = [System.Net.NetworkCredential]::new('', $taskSecret).Password
try { node scripts/local-backup.mjs } finally { Remove-Item Env:LUKI_BACKUP_PASSPHRASE }
```

Optional `LUKI_BACKUP_DIR` auf einen getrennten, gesicherten Speicher setzen. Standard `backups/` liegt auf demselben Rechner und schützt allein nicht gegen dessen Verlust. `last-success.json` erlaubt später die Überwachung eines täglichen Jobs. Ein geplanter Job soll fehlgeschlagene Läufe melden und sieben Tagesstände plus vier Wochenstände aufbewahren. Diese Planung wird erst mit eingerichtetem Speicher/Secret automatisiert.

Restore zunächst in eine **neue, noch nicht existierende Datei**:

```powershell
$taskSecret = Read-Host 'Backup-Passphrase' -AsSecureString
$env:LUKI_BACKUP_PASSPHRASE = [System.Net.NetworkCredential]::new('', $taskSecret).Password
try {
  node scripts/local-restore.mjs backups/DEIN-BACKUP.luki-backup data/restored.sqlite
} finally { Remove-Item Env:LUKI_BACKUP_PASSPHRASE }
```

Die Passphrase muss erhalten bleiben; ohne sie kann das Backup nicht entschlüsselt werden. Restore prüft Verschlüsselung, SQLite-Integrität und Formatversion und entfernt gespeicherte Sitzungen. Zum isolierten Prüfen mit `LUKI_DB_PATH` auf die wiederhergestellte Datei starten. Für eine Wiederinbetriebnahme den laufenden Server beenden, Pfad in `.env.local` setzen und neu starten. Bestehende Dateien werden vom Restore-Werkzeug niemals überschrieben.

## Passwort vergessen

Mit Zugriff auf diesen Rechner kann das lokale Passwort zurückgesetzt werden:

```powershell
$taskSecret = Read-Host 'Neues Passwort (mindestens 12 Zeichen)' -AsSecureString
$env:LUKI_NEW_PASSWORD = [System.Net.NetworkCredential]::new('', $taskSecret).Password
try { node scripts/reset-password.mjs DEINE-EMAIL } finally { Remove-Item Env:LUKI_NEW_PASSWORD }
```

Alle vorhandenen Sitzungen dieses Kontos enden. Es gibt keinen E-Mail-Reset im lokalen Modus.

## Prüfung und Entwicklung

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:cloud
```

Die lokale Browserprüfung startet einen eigenen Server auf Port 3101 mit einer frischen Testdatenbank; echte Daten werden nicht verändert. Sie prüft Anmeldung, Tagesablauf, Neuladen, Export, Konflikte, Origin-Prüfung und 360-px-Layout. Die Cloud-Vertragsprüfung läuft auf Port 3102 mit einer isolierten Supabase-HTTP-Testumgebung auf 54329 und PostgreSQL via PGlite. Sie prüft Cloud-Login/Cookies, Datenübernahme, Speichern, Wiederladen, Import-Sperre und Abmeldung. Es werden keine echten Cloud-Zugänge oder E-Mails verwendet. Domänentests prüfen Datum/Sommerzeit, Regeln, Prioritäten, Check-in, großen Export und Import-Validierung. Backup/Restore wird in einem isolierten temporären Verzeichnis getestet. PostgreSQL-Migrationen/RPCs/RLS werden gegen zwei Testnutzer und eine unabhängige Geschäftstabelle geprüft; das ersetzt keinen Test auf einem echten Supabase-Projekt.

Git: `main` = lokaler freigegebener Stand, `develop` = Integration, `feature/...` = einzelne Änderungen. Versionsnummer steht in `package.json`, Änderungen in `CHANGELOG.md`. Lokales Repository ist eingerichtet; noch kein GitHub-Remote vorhanden. Cloud-Deployment, automatisierte externe Backups und Supabase-Restore sind nicht eingerichtet.

## Online-Betrieb

Der fertige Adapter benötigt Supabase-Projektzugriff, einen bestätigten Auth-Nutzer und eine eigene Vercel-Anwendung. Einrichtung und noch offene Voraussetzungen stehen in [docs/ONLINE.md](docs/ONLINE.md). Bei Wiederverwendung des Luki-OS-Projekts werden keine Geschäftstabellen umgebaut. Die Luki-Home-Migrationen dürfen nicht blind über die bestehende Migration-Historie von Luki OS geschoben werden. Keine Service-Schlüssel im Browser verwenden.

Technische Quellen: [Next.js Installation](https://nextjs.org/docs/app/getting-started/installation), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase Backup](https://supabase.com/docs/guides/platform/backups).
