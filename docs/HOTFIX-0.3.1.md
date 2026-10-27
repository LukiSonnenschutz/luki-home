# Störungsbehebung 0.3.1 — 2026-10-27

## Anlass und Auftrag
Luki OS konnte Termine und Aufgaben nicht mehr laden. Die gemeinsame Supabase-Instanz zeigte erschöpfte PostgREST-Verbindungen (PGRST003), während wiederholte Luki-Home-Snapshot-Speicherungen mit SQLSTATE 40001 scheiterten. Lukas hat die dauerhafte direkte Behebung autorisiert. Bestehende Daten und Authentifizierung bleiben erhalten.

## Änderung
- GET /api/state liest einmal und projiziert Tagesinitialisierung, Regeln und Timerablauf ohne Snapshot-Speicherung. Die bestehende Get-RPC darf weiterhin nur ihre bisherige idempotente Konto-Erstanlage ausführen.
- Der Client persistiert erforderliche Tages-/Timeränderungen durch genau einen revisionsgeprüften POST synchronize. Nach Konflikt oder Fehler pausieren automatische Aktualisierungen; ein aktueller Stand kann bewusst geladen werden.
- Ein abgelaufener Timer löst pro Lauf-/Dauersignatur höchstens eine Aktualisierung aus, auch wenn sie fehlschlägt. Sekundenticks starten keine Wiederholung.
- Entfernt: drei unmittelbare serverseitige Wiederholungen fehlgeschlagener Lese-/Speicherabläufe. Manuelle Änderungen werden nie automatisch wiederholt. Bei 409 wird einmal gelesen; Formularentwürfe bleiben offen.
- Parallele Lade-/Speicherabläufe im selben Client werden ausgeschlossen. Keine neuen Tabellen, Migrationen, öffentlichen Zugriffe, Zugangsdaten oder Änderungen an Luki-OS-Fachmodulen.

## Prüfung
28 Unit-/PostgreSQL-Tests inklusive RLS, Nutzerisolation, atomarer Revisionen und unveränderlicher Trainingshistorie. Browserregressionen für lokalen Betrieb und Cloud-HTTP-Vertrag; neue Fälle prüfen GET ohne Speicher-RPC, dauerhaften 409 beim Timer über zehn simulierte Minuten, manuelles Wiederaufnehmen, erhaltene Formularentwürfe und veraltete Revision ohne Schreibversuch. Produktive Testdatensätze werden nicht angelegt.

## Betrieb und Rückweg
Veröffentlichung über LukiSonnenschutz/luki-home und das bestehende Vercel-Projekt. Bereits offene Home-Seiten nach Veröffentlichung neu laden, damit sie die neue Oberfläche erhalten. Auch alte Clients können mit dem neuen GET keine vollständigen Snapshots mehr über Leseabrufe speichern. Bei Wiederauftreten zuerst Funktionslogs und aktive PostgREST-Abfragen prüfen. Ein Rollback auf 0.3.0 führt die fehlerhafte Wiederholungslogik wieder ein und ist daher kein geeigneter dauerhafter Rückweg.
