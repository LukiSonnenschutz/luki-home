# Prompt log

## 2026-10-27 — Störung dauerhaft beheben

Lukas meldet: Luki OS lädt die Seite, kann jedoch weder Termine/Aufträge noch Aufgaben laden oder anlegen. Nach Diagnose der gemeinsamen Supabase-Verbindungen und einer wiederholten Snapshot-Speicherung aus Luki Home lautet die Freigabe: „ja dauerhaft direkt umsetzen“.

Umgesetzt wird die Begrenzung der Home-Synchronisierung und Konfliktbehandlung im bestehenden Projekt, einschließlich Regressionstests, Veröffentlichung über das vorhandene Git-/Vercel-Projekt und anschließender Live-Prüfung von Luki OS. Bestehende Fach- und Trainingsdaten bleiben erhalten. Details: docs/HOTFIX-0.3.1.md.

Die anschließende Live-Prüfung bestätigte außerdem den von Supabase dokumentierten PostgREST-14-Fehler bei benutzerdefiniertem SQLSTATE 40001. Im autorisierten Auftrag zur dauerhaften Behebung wird deshalb der Konfliktcode der drei bestehenden Speicherfunktionen auf PT409 korrigiert. Bestehende Daten und Berechtigungen bleiben erhalten. Details: docs/HOTFIX-0.3.2.md.
