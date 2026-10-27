# Changelog

## 0.3.2 — 2026-10-27 — Konfliktcode in Supabase korrigieren

- Versionskonflikte der drei bestehenden Speicher-RPCs verwenden `PT409` statt `40001`, damit PostgREST 14 keine Endlosschleife startet.
- Additive Funktionsmigration erhält Daten, Berechtigungen und alle bestehenden Prüfungen. Client behandelt beide Konfliktcodes als HTTP 409.
- 29 Fach-/Datenbanktests, inklusive idempotenter Migration, unveränderter ACL und unveränderter Daten bei Konflikten. Cloud-Fehlertests verwenden den tatsächlichen `PT409`-Vertrag.

## 0.3.1 — 2026-10-27 — Speicherschleife beheben

- Tagesabrufe speichern keine Snapshots mehr; notwendige Synchronisierung erfolgt einmalig und revisionsgeprüft.
- Abgelaufene Timer wiederholen fehlgeschlagene Aktualisierungen nicht bei jedem Sekundentick.
- Konflikte pausieren automatische Aktualisierung; Entwürfe bleiben für bewusstes erneutes Speichern erhalten.
- Keine Datenmigration. Prüfungen und Betrieb: [HOTFIX-0.3.1.md](docs/HOTFIX-0.3.1.md).

## 0.2.0 — 2026-10-05 — Ziele & Stabilität

- Zielübersicht und eigene Detailseiten, Fokus-Ziele, Statuswechsel, Meilensteine mit Reihenfolge; Aufgaben optional mit einem Ziel verbunden.
- Kaffeeeinträge mit Uhrzeit, Tageszähler, Limit und Cutoff; manuelle Kalorien-, Protein- und Bewegungswerte.
- Persistenter Fokus-/Pausen-Tracker mit Start/Pause/Fortsetzen/Ende, Zeitstempeln und Tagesstatistik.
- Persönliche Stabilitätseinstellungen, Theme, Trainingstatus und erweiterter Abend-Check-in.
- Dashboard mit Fokus-Zielen, nächstem Task-Schritt und konfigurierbaren Kaffee-, Work-, Bewegungs- und Feierabendhinweisen.
- Fünf neue RLS-Tabellen im vorhandenen Schema; additive Migration und v2-RPCs. v1-Schreibzugriffe erhalten neue Zielrelationen und Tagesflags.
- Exportformat 2 mit allen neuen Beziehungen; Import von Format 1 und 2. Keine Zugangsdaten oder geschäftlichen Luki-OS-Änderungen.
- Migration mit bestehenden Daten, zwei Nutzer, Konflikte, alte Clients, Timer und neue Browser-Abläufe getestet; Rückweg dokumentiert.

## 0.1.1 — 2026-10-04 — Online-Vorbereitung

- Supabase Auth mit eigener HttpOnly-Sitzung, bestätigter persönlicher Login-Adresse und Wiederherstellung.
- Relationaler Cloud-Adapter im isolierten Schema `luki_home`; atomare RPC-Speicherung mit Revisionen und RLS.
- Einmalige, validierte ZIP-Übernahme aus dem lokalen Betrieb in einen leeren Online-Zugang.
- Cloud-Modus auf Vercel ohne SQLite-Ersatzspeicherung; getrennte Anzeige „Online“/„Lokal“.
- Isolierte Cloud-Vertrags-, Import- und Datenbanktests. Noch keine Online-Veröffentlichung.

## 0.1.0 — 2026-10-04

- Lokaler Core mit Login, Tagesfokus, Aufgaben, fünf Stabilitätsankern und Abend-Check-in.
- Versionierte Regel-Auswertung mit Tagesunterdrückung und Snooze.
- SQLite-Speicherung mit transaktionalen Änderungen und Konflikterkennung.
- Dark Mode, responsive Darstellung und Rückblick auf gespeicherte Tage.
- Vollständiger ZIP-Export; verschlüsseltes Backup und isolierter Restore.
- Vorbereitete PostgreSQL-Migrationen und Tests für RLS/Constraints.
- Windows-Starter und Dokumentation für Betrieb, Passwort-Reset und spätere Cloud-Migration.
