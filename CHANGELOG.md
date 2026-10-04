# Changelog

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
