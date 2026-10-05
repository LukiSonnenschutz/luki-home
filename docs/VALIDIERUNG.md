# Validierung — Luki Home 0.3.0

## Update-Prüfung 0.3

Die komplette Trainings-/Timer-Abnahme, Datenbankprüfung, Migration, Export 3, Grenzen und Rückweg sind in [UPDATE-0.3.md](UPDATE-0.3.md) beschrieben. Veröffentlichung und Production-Prüfung werden nach finaler GitHub-CI im Abschlussbericht festgehalten. Die folgenden Abschnitte dokumentieren frühere Versionen.

## Update-Prüfung am 5. Oktober 2026

- Produktions-Build/TypeScript, ESLint und 19 Fach-/Datenbanktests erfolgreich.
- Drei lokale Browsertests und ein Cloud-Vertragstest erfolgreich. Bestehende Auth-/Task-/Check-in-/Export-Abläufe bleiben erhalten; Ziele erstellen/bearbeiten/Status/Fokus, Meilensteine, gemeinsame Aufgaben, Kaffee, Kalorien, Protein, Bewegung, Training und Einstellungen geprüft.
- Work-Fokus/Pause/Fortsetzen/Ende, Seitenwechsel und Reload geprüft. Navigation aus Zielseiten aktualisiert jetzt die Adresse; Reload öffnet den ausgewählten Bereich.
- Migration 0.1→0.2 mit bestehenden Daten, RPCs, alter Client, atomarer Rollback und Revisionen in PostgreSQL geprüft. RLS verweigert A/B-Fremdzugriffe und anonymen Zugriff; Parent-Ziel wird geprüft.
- Desktop und 360-px-Mobilansicht geprüft: kein horizontaler Überlauf; helle Textkontraste korrigiert. Dark bleibt der Standard.
- Cloud-Vertragstest nutzt isolierte Supabase-HTTP/Auth-Fixture und PostgreSQL; echte Production-Abnahme erfolgt nach CI und Veröffentlichung.
- Vor dem Update wurde über die angemeldete Production-App ein ZIP exportiert und außerhalb des Git-Repositories als Luki-Home-Backup-vor-0.2.zip gesichert. Archivstruktur geprüft. Dies ist ein Anwendungsbackup, kein vollständiges Datenbank-/Auth-Backup.
- Rollback zu Code 95b90f4 / Deployment dpl_EngTsPN7E5hmRzENgt36Uv9jspNX beschrieben in UPDATE-0.2.md; neue Tabellen bleiben dabei erhalten.

Die folgenden Abschnitte dokumentieren frühere Prüfstände. Der aktuelle Veröffentlichungsstatus wird im Abschlussbericht separat festgehalten.

## Historisch: Luki Home 0.1.1

## Online-Vorbereitung am 4. Oktober 2026

- Produktions-Build einschließlich TypeScript-Prüfung und ESLint erfolgreich.
- 13 Fach-/Datenbanktests erfolgreich, einschließlich vollständigem Cloud-RPC-Roundtrip, atomarem Rollback, Revisionskonflikten, Nutzertrennung und ZIP-Import mit erhaltenen Beziehungen.
- Zwei lokale Browsertests und ein Cloud-Browsertest erfolgreich. Der Cloud-Test prüft Anmeldung, geschützte APIs, HttpOnly-Sitzung, ZIP-Übernahme, Speicherung nach Neuladen, verweigerten zweiten Import und Abmeldung.
- Cloud-Browsertests verwenden einen lokalen Supabase-Vertragsserver mit PGlite und erfundenen Zugangsdaten. Sie bestätigen keinen echten Supabase- oder Vercel-Betrieb.
- Geschäfts-Tabellen im Schema `public` wurden im Datenbanktest als unverändert geprüft; die neuen Tabellen verwenden ausschließlich `luki_home`.

Anschließend wurde die geprüfte Datenbankgrundlage als gemeinsame Migration `20261004174055_luki_home_isolated_core` auf dem vorhandenen Supabase-Projekt `okhzzjmtvjzmgbrsohms` angewendet. Host-Prüfung bestätigt RLS mit Eigentümerregeln für alle neun Tabellen, verweigerte anonyme Tabellen-/RPC-Zugriffe, `SECURITY INVOKER` und festen Suchpfad. Ein RPC-Aufruf ohne Auth-UID wurde korrekt verweigert. Der Security Advisor meldete keine Befunde für Luki Home; sieben bestehende Hinweise zu RLS ohne Policies betreffen ausschließlich Geschäftstabellen und wurden nicht verändert.

Noch offen: Supabase-Auth-Konto/Redirect-Konfiguration, echter angemeldeter RPC-Ablauf, Auth-E-Mails und HTTPS-Cookies auf dem Host, GitHub-Remote/CI, Vercel-Veröffentlichung und Cloud-Backups.

## Lokale Basis 0.1.0

Lokale Prüfung am 4. Oktober 2026 auf Windows mit Node.js 24.19.0.

- TypeScript-Prüfung und ESLint ohne Fehler.
- Next.js-Produktions-Build erfolgreich.
- Zehn automatisierte Fach-/Datenbanktests erfolgreich: idempotente Tage, Anker-Snapshots, Regeln und Snooze, Prioritäten/Löschverknüpfungen, Check-in-Entwurf/Abschluss, Sommer-/Winterzeit, Eingabevalidierung, Export von 1.105 Aufgaben, PostgreSQL-Migrationen/RLS und verschlüsselter SQLite-Restore.
- Zwei Browsertests erfolgreich: vollständiger Tagesablauf einschließlich Ab-/Anmeldung, Speicherung nach Neuladen, ZIP-Export, Konfliktantwort 409, Origin-Prüfung und verweigerte zweite Registrierung.
- Desktop und 360-px-Mobilansicht anhand gerenderter Screenshots geprüft; mobile Ansicht ohne horizontales Überlaufen.
- Isolierter Restore des kleinen Testdatensatzes: rund 0,5 Sekunden einschließlich Prozessstart. Daten blieben identisch; Sitzungen wurden entfernt. Falsche Passphrase und Überschreiben einer vorhandenen Datei wurden abgewiesen. Diese Messung ist keine Garantie für große Datenbanken oder andere Rechner.

Alle Browser- und Restore-Tests verwenden isolierte Datenbanken und Testkonten. Für die echte lokale App wurde kein Testkonto angelegt.

Die ursprünglichen PostgreSQL-Migrationen wurden mit PGlite geprüft, nicht auf einem Supabase-Host.
