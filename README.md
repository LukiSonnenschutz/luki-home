# Luki Home 0.3.0

Persönliche Web-App für Ziele, Aufgaben, Stabilität und Abend-Check-in. Next.js/React/TypeScript, lokaler SQLite-Betrieb oder Supabase Auth/PostgreSQL für Online-Betrieb. Production: [luki-home.vercel.app](https://luki-home.vercel.app). Die Projektdateien unter `../sources/` werden nicht verwendet oder verändert.

## Neu in 0.3

- Freie Trainingspläne A/B und weitere Pläne, eigene Vorlagen, Wochenstruktur und verschiebbare Termine.
- Kraft, HYROX und gemischte Workouts mit frei sortierbaren Übungen/Stationen; Drag-and-drop sowie Touch-/Tastaturpfeile.
- Laufende Sessions mit tatsächlichen Satz-/Rundenwerten, letzter erfasster Leistung und unveränderlicher Historie. Änderungen nur heute oder dauerhaft an der Vorlage.
- Training in den Einstellungen ausblenden, ohne Daten zu löschen.
- Fokus-Timer mit Reset, persistierter Ablaufzeit, vier selbst erzeugten Signaltönen, Lautstärke und Tontest.
- Exportformat 3 einschließlich Training; ältere Formate 1/2 bleiben importierbar.

Architektur, Abnahme und Rückweg: [UPDATE-0.3.md](docs/UPDATE-0.3.md).

## Historisch: Neu in 0.2

- Ziele mit Warum, Erfolgskriterium, sechs Kategorien, Priorität, Status, Zeitraum und optionalem Fokus. Mehr als fünf Fokus-Ziele erzeugen einen Hinweis, keine Sperre.
- Eigene Zielseiten unter `/goals/[id]`, sortierbare Meilensteine und zugehörige Aufgaben. Der nächste Schritt wird aus offenen Aufgaben abgeleitet.
- Kaffeezähler mit Uhrzeiten, letztem Kaffee, Tageslimit und Cutoff. Standard: 3 / 13:00; ein Hinweis verhindert keine ehrliche Erfassung.
- Fokus-/Pausen-Tracker mit 75 / 15 Minuten als Startwert. Serverzeit, gespeicherte Zeitstempel und kumulierte Fokuszeit überstehen Pause, Seitenwechsel, Reload und Tageswechsel. Zu lange Fokusblöcke erzeugen einen direkten Pausenhinweis.
- Manuelle Tageswerte für Kalorien, optional Protein und Bewegung; Quellen `manual`, `health`, `external`. Keine Mahlzeiten- oder Lebensmitteldatenbank. Der API-Befehl `metric` kann einen externen Tageswert annehmen; eine externe Integration ist nicht enthalten.
- Training als Tagesstatus offen/geplant/erledigt und freie Notiz. Keine automatische Wochenplanung, Übungen oder Progression.
- Einstellungen für Werktags-/Wochenend-Aufstehen, Kaffee, Fokus/Pause, Feierabend, Nährstoffziele und Theme; deaktivierbare Hinweise.
- Erweiterter Check-in mit Bewegung, Training und Feierabend; Dashboard mit Fokus-Zielen und Stabilitätswerten.

Migration, Kompatibilität, Abnahme und Rückweg: [UPDATE-0.2.md](docs/UPDATE-0.2.md).

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

Die Uhrzeiten 08:00 / 09:00 (Wochenende) / 14:00 / 17:00 / 20:30 sind veränderbare Startwerte. Hinweise erscheinen während der sichtbaren App-Nutzung; kein Push bei geschlossenem Browser. Ein Pausenende nach mindestens der geplanten Dauer zählt als eingehalten; mehr als fünf zusätzliche Minuten zählen als überzogen. Der Fokus-Hinweis wird nach 15 zusätzlichen Minuten direkter. Ein Timer kann Bildschirmzeit anzeigen, aber tatsächliches Verlassen des Bildschirms nicht feststellen. Zusammenführende oder überschreibende Importe sind nicht enthalten.

Konfigurationen beeinflussen neue Tages-Snapshots. Deaktivierte Anker bleiben im bereits begonnenen Tag sichtbar, erzeugen aber keine weiteren Hinweise. Zeitzone, Hinweiszeiten und Regel-Schalter gelten sofort. Während offene Formulare bearbeitet werden, wird der Tagesinhalt nicht im Hintergrund ausgetauscht. Nach einem Tagwechsel wird „Heute“ beim nächsten Laden/Aktualisieren geöffnet, sofern kein historisches Datum ausgewählt ist.

## Daten und Konfiguration

Ohne zusätzliche Konfiguration funktioniert der lokale Betrieb. Optional `.env.example` nach `.env.local` kopieren. `LUKI_DB_PATH` legt einen anderen Datenbankpfad fest. Standard: `data/luki-home.sqlite`, mit zugehörigen WAL-Dateien. Diese Dateien sind vom Git-Tracking ausgeschlossen. Die Daten liegen serverseitig auf diesem Rechner, nicht in Browser-LocalStorage. Das Betriebssystemkonto hat Zugriff auf die Datenbankdateien; SQLite selbst ist nicht verschlüsselt.

SQLite verwendet ein versioniertes JSON-Dokument je Konto; neue Felder werden beim Lesen additiv ergänzt. Änderungen werden transaktional gespeichert. Revisionen verhindern Überschreiben aus alten Browserständen. Mit `LUKI_STORAGE=supabase` arbeitet derselbe Core mit relationalen PostgreSQL-Tabellen im separaten Schema `luki_home` und Supabase Auth. Auf Vercel ist der lokale SQLite-Modus gesperrt; fehlende Cloud-Konfiguration führt nicht zu einer Ersatzspeicherung auf flüchtigem Dateisystem.

Der Login verwendet gesalzene scrypt-Passworthashes und zufällige serverseitige Sitzungen mit sieben Tagen Laufzeit. Cookies sind HttpOnly/SameSite=Strict, und Schreibaufrufe prüfen den Origin. Zugriffsprüfungen erfolgen auf jedem privaten API-Endpunkt. Der lokale Modus lehnt öffentliche Hostnamen ab; für spätere Veröffentlichung ist Supabase Auth statt lokaler Anmeldung vorgesehen.

## Export

In der Seitenleiste oder den Einstellungen „Daten exportieren“ wählen. Das ZIP enthält Profil, Einstellungen, Aufgaben, Kategorien, Ziele, Meilensteine, Kaffeeeinträge, Work-Sessions, Daily Metrics, Tagespläne, Prioritäten, Anker, Check-ins und Regelereignisse sowie ein Manifest mit Formatversion 2 und Datensatzanzahlen. Keine Auth-Sitzungen, Passwörter oder Schlüssel. Die Work-Sessions enthalten nur Fokus-/Pausendaten. Im Online-Modus ist ein einmaliger Import in einen leeren Zugang möglich; Beziehungen bleiben erhalten und Nutzer-IDs werden dem bestätigten Konto zugeordnet. Auch alte Format-1-Exporte werden gelesen. Bestehende Daten werden nicht überschrieben. Der Export ersetzt kein Systembackup.

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
