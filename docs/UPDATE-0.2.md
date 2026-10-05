# Update auf 0.2.0

## Ausgangspunkt und Migration

Production-Ausgangspunkt: GitHub-Commit `95b90f438b11067236c9fb2df155d293c2ef7e86`, Vercel-Deployment `dpl_EngTsPN7E5hmRzENgt36Uv9jspNX` (0.1.1). Vor Änderungen wurden GitHub-Stand, neun bestehende Luki-Home-Tabellen mit RLS, Migrationshistorie und UI geprüft. Geschäftliche Tabellen im Schema public werden nicht geändert.

Die mit Supabase CLI angelegte Migration `20261005073432_goals_stability_v02.sql` ergänzt `luki_home.goals`, `goal_milestones`, `coffee_entries`, `work_sessions`, `daily_metrics`. Bestehende Tabellen erhalten nullable `tasks.goal_id`, `user_settings.preferences`, `day_plans.training_status` und drei Check-in-Flags. Keine Tabelle und keine bestehende Spalte wird gelöscht. Einstellungen bleiben in der vorhandenen Tabelle; es gibt keinen parallelen Preference-Speicher.

RLS schützt alle neuen Tabellen. Meilensteine prüfen zusätzlich die Eigentümerschaft des Parent-Ziels; zusammengesetzte Fremdschlüssel verhindern fremde Ziel-/Task-Zuordnungen. Kein Browser verwendet einen Service-Role-Key. v2-RPCs laufen als SECURITY INVOKER mit leerem search_path, ohne anonymes Ausführungsrecht. Optimistische Revisionen und eine Transaktion schützen vollständige Änderungen vor Konflikten und Teil-Speicherung.

Alte RPCs bleiben verfügbar. Die bestehende Snapshot-Speicherung erhält 0.2-Erweiterungen auch bei einem noch geöffneten alten Client. Ziele, Meilensteine, Kaffee, Work und Metrics werden durch v1-Schreibzugriffe nicht gelöscht. 0.2 nutzt eigene v2-RPCs. Für lokale SQLite-Daten erfolgt eine additive Payload-Erweiterung beim Lesen; physische SQLite-Struktur und Login bleiben unverändert.

## Backup und Restore

Am 5. Oktober 2026 wurde vor diesem Update über den angemeldeten Production-Zugang ein ZIP exportiert und außerhalb des Git-Repositories als `Luki-Home-Backup-vor-0.2.zip` gesichert. Die Archivstruktur wurde geprüft. Dies bestätigt keine vollständige Datenbank-/Auth-Sicherung.

Vor einem Update einen persönlichen ZIP-Export über Einstellungen erstellen und sicher außerhalb des Repositorys ablegen. Dieser enthält Anwendungsdaten und Beziehungen, keine Zugangsdaten. Import ist ausschließlich in einen leeren Online-Zugang möglich; 0.1- und 0.2-Exporte werden validiert. Kein Zusammenführen oder Überschreiben bestehender Daten.

SQLite-Systembackup: `pnpm backup:local` mit dem in README beschriebenen Passphrase-Verfahren. Restore ausschließlich in eine neue Datei mit `pnpm restore:local`; der automatisierte Test prüft Datenerhalt und entfernt alte Sitzungen.

Supabase-Systemrestore: zusätzlich eine Datenbanksicherung über den Provider bzw. einen geeigneten sicheren pg_dump-Prozess erstellen. Ob automatische Backups/PITR im gebuchten Projekt verfügbar sind, muss im Supabase-Dashboard geprüft werden. Ein ZIP ist kein vollständiger Datenbank- oder Auth-Backup. Hier werden keine Sicherungszugänge oder Secrets in Git gespeichert.

## Rollback

Bei Problemen das genannte vorherige Vercel-Deployment wieder als Production zuweisen oder den GitHub-Code auf den Ausgangscommit zurückführen. Die additive Migration und neuen Tabellen erhalten; kein DROP und keine Rückwärtsmigration. 0.1 kann die bisherigen Bereiche weiterhin nutzen und erhält 0.2-Relationsfelder. Neue 0.2-Daten bleiben für das erneute Upgrade gespeichert; sie sind in der alten Oberfläche nicht sichtbar. Vor einem Rollback aktuelle Daten exportieren und Schreibzugriffe während des Wechsels pausieren. Eine Datenbanksicherung nur bei nachgewiesenem Datenproblem und gesonderter Freigabe wiederherstellen, da ein Restore neuere Daten verdrängen kann.

## Prüfungen

- Bestehende Auth-/Task-/Check-in-/Export-/Backup-Abläufe.
- PostgreSQL: echte Migration 0.1→0.2 mit bestehenden Aufgaben; RLS mit A/B und anon; Meilenstein-Parent, v1-Client, Revisionen und atomarer Fehler-Rollback.
- Neue Domain-Abläufe: Ziele/Meilensteine/Task-Verbindung, Status, Kaffee/Zeitzone/Tageswechsel, Work-Zustandsautomat/Reload/Überziehung, Tageswerte und Training.
- Browser: Zielseiten, Kaffee und Metrics nach Reload, Tracker nach Navigation/Reload, Einstellungen und mobile Ansicht. Supabase-HTTP/Auth-Vertrag wird mit einer isolierten PostgreSQL-Fixture geprüft; diese ersetzt nicht den persönlichen Live-Login.

Nach Deployment persönlichen Login, gespeicherte Aufgaben und alle neuen Bereiche im Browser prüfen. Falls noch keine authentifizierte Browser-Sitzung vorliegt, meldet sich Lukas selbst an; keine Passwörter in den Chat senden.

## Host-Prüfung der Migration

Am 5. Oktober 2026 nach erfolgreicher GitHub-CI für cf474419 wurde die Migration über Supabase angewendet. Registry-Version: 20261005073432, Name goals_stability_v02. Die SQL-Datei ist auf diese registrierte Version abgestimmt, damit der nächste CLI-Migrationsabgleich konsistent bleibt.

Zeilenzahlen und Fingerprints aller ursprünglichen Spalten der neun bestehenden Luki-Home-Tabellen sind vor/nach Migration identisch. Die fünf neuen Tabellen sind leer. Alle 14 Tabellen haben Owner-RLS; Meilensteine zusätzlich Parent-Prüfung. Beide v2-RPCs sind SECURITY INVOKER, fester leerer search_path, keine anonyme Ausführung.

Security Advisor: keine Befunde zu Luki-Home-Tabellen. Sieben bestehende INFO-Hinweise betreffen public-Geschäftstabellen. Außerdem meldet der Provider deaktivierten Schutz vor bekannten geleakten Passwörtern für den gemeinsamen Auth-Dienst. Die globale Auth-Konfiguration wurde im Update nicht geändert; Aktivierung/Verfügbarkeit separat prüfen: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.