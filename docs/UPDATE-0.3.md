# Update auf 0.3.0

Ausgangspunkt ist die produktive 0.2.0, GitHub `4cd5b4c8a75f2458d3a9634021230fdcb6d21cb0`, Vercel `dpl_HF4j6ePbcQxpReKSrEvhSejLPXoQ`. Das Geschäftsprojekt Luki OS und synchronisierte Projektquellen werden nicht geändert.

## Training und Daten

Die additive Migration `20261005110734_flexible_training_v03.sql` ergänzt sieben Tabellen im privaten Schema `luki_home`: `training_plans`, `workout_templates`, `workout_template_items`, `scheduled_workouts`, `workout_sessions`, `workout_session_items`, `workout_sets`. Alle haben Owner-RLS. Zusammengesetzte Parent-Fremdschlüssel mit `user_id` verhindern fremde Zuordnungen; Child-Policies prüfen zusätzlich erforderliche Parents. `anon` erhält keine Tabellen- oder v3-RPC-Rechte. Die RPCs verwenden SECURITY INVOKER und leeren search_path, Profile-Revision und Transaktion.

Pläne und Vorlagen sind frei editierbar. Wochenstruktur wird nur durch den ausdrücklichen Befehl des Benutzers auf eine gewählte Woche übertragen. Datiertes Training kann verschoben oder ausgetauscht werden; keine Bewertung als verpasst. Workouts können ohne Vorlage starten. Übungen/Stationen unterstützen Kraft, Distanz, Zeit, Wiederholungen, Ergometer, Run, Runden und freie Stationen. Ziele und tatsächlich erfasste Satzwerte sind getrennt. Sortieren funktioniert mit nativen Drag-Griffen und mit beschrifteten Pfeilen auf Touch-Geräten und per Tastatur.

Beim Start entstehen eigene Session-Items mit Namen, Typ, Zielen, Beschreibung und Notizen. Änderungen einer Vorlage verändern diese Momentaufnahme nicht. Im aktiven Workout kann eine Änderung nur die heutige Session oder zusätzlich die Vorlage betreffen. Abgeschlossene Sessions, deren Items und Satzwerte sind durch Datenbank-Trigger unveränderlich, einschließlich Verschieben eines historischen Childs zu einer anderen Session und Hinzufügen neuer historischer Werte. Identische Wiederholungs-Speicherung bleibt möglich. Bei Import wird der Parent innerhalb derselben Transaktion erst nach seinen Children abgeschlossen.

Löschen eines Plans/einer Vorlage/einer Komponente blendet den Eintrag mittels `deleted_at` aus. Gespeicherte Beziehungen und Historie bleiben erhalten. Planlöschung entfernt nur die Zuordnung der Vorlagen. Archivierte Vorlagen lassen sich wiederherstellen. Die Trainings-Preference blendet Navigation und Dashboard aus; sie löscht keine Daten.

## Fokus und Audio

Der vorhandene Work-/Pausentracker bleibt bestehen. Neue Felder: `planned_seconds`, `completed_by_timer`, `was_reset`. `planned_seconds` ist die Laufzeit von 0.3; alte Blöcke verwenden `planned_minutes × 60`. Die frühere Datenbank-Untergrenze von fünf Minuten in `planned_minutes` bleibt für alte Clients erhalten. Kurze Testblöcke werden deshalb zusätzlich exakt in Sekunden gespeichert.

Zeitberechnung nutzt Serverzeit, gespeicherte Startzeit und akkumulierte Fokussekunden. GET und Work-Befehle erkennen einen überschrittenen Ablauf und speichern dessen tatsächlichen Termin, ohne die Zeit eines suspendierten Tabs als zusätzliche Fokuszeit zu zählen. Reset schließt den bisherigen Block mit Reset-Markierung ab und zeigt einen neuen ungestarteten Timer; tatsächlich verstrichene Zeit bleibt nachvollziehbar. Die Pause wird weiterhin ausdrücklich gestartet/beendet.

Bell, Digital, Soft und Alert sind eigene synthetische Web-Audio-Signale, ohne fremde Audiodateien. Einstellungen enthalten Ton, Lautstärke, Aktivierung und Tontest. Nach Benutzerinteraktion wird der AudioContext freigegeben. Bei Ablauf erscheint ein Hinweis auf jeder App-Seite; derselbe Ton wird pro Block und Browser-Speicher einmal gestartet. Ein gesperrter Browser zeigt „Ton aktivieren“.

Die tatsächliche 15-Sekunden-Prüfung erfasst die Ablaufmeldung, gespeicherten Done-Status und den Start eines nicht stummen AudioBuffers am echten Browser-Ausgang. Sie bestätigt keine menschliche Hörprüfung an jedem Gerät. Browser-Autoplay, Gerätestummschaltung, Energiesparmodus und Tab-/Betriebssystem-Suspend können Ausgabe verzögern oder verhindern. Nach Rückkehr wird der Stand korrigiert; es gibt keinen Service Worker oder garantierten OS-Wecker. Verhalten von Web Audio: [MDN Best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

## Export und Backup

Exportformat **3** enthält alle sieben Trainingssammlungen sowie Timer-/Ton-Preferences und bisherige Daten. Import prüft Typen, Kalenderdaten, Owner, IDs, Parent-Beziehungen, Satznummern und Manifest-Zählungen. Formate **1 und 2** bleiben unterstützt und erzeugen leere Trainingssammlungen. Import ist weiterhin nur in einen leeren Online-Zugang möglich, ohne Zusammenführen oder Überschreiben vorhandener Daten.

Vor der Migration wurde ein aktuelles persönliches 0.2-ZIP über die angemeldete Production-App heruntergeladen und außerhalb von Git als `Luki-Home-Backup-vor-0.3.zip` gespeichert. SHA256: `31E8C5D5AE8A7FB0B5A7EC84ABD9979EFFFAFE67AAE67A33C90A981725FAE8A4`. Offline-Importprüfung bestätigt drei Aufgaben, einen Kaffee-Eintrag, einen Work-Block und einen Tageswert. Dies ist ein Anwendungsbackup; eine vollständige Datenbank-/Auth-Sicherung bzw. PITR wurde nicht bestätigt.

## Prüfungen und Veröffentlichung

Vor Production: TypeScript, ESLint, Fach-/PostgreSQL-Tests, Next-Production-Build, sechs lokale Browserabläufe und Supabase-HTTP/Auth-Vertragstest. Fachprüfungen umfassen Pläne, Duplikate, Wochenstruktur, Terminumzug, Kraft-/Rundensätze, aktuelle/dauerhafte Änderung, immutable History, Export 1/2/3, Timerzeiten und vier eigene Audiosignale. PostgreSQL-Prüfungen verwenden reale Migrationen mit bestehenden 0.2-Daten, zwei Ownern und anon, alte v2-Preferences, Revisionen, atomare Fehler und Snapshot-Import. Browser prüfen Upper A/B, HYROX mit vier freien Stationen, Pfeile/Drag-and-drop, Satzwerte, Reload, Historie, Modul-Schalter und echten 15-Sekunden-Timer. Desktop/360 px werden visuell auf Bedienbarkeit und Überlauf geprüft.

GitHub-CI muss auf dem finalen PR-Stand erfolgreich sein. Danach additive Migration kontrolliert anwenden und Zeilenzahlen/Fingerprints der bisherigen 14 Tabellen unmittelbar davor/danach vergleichen; neue Work-Spalten beim Vergleich ausnehmen. Anschließend Migration-Registry/Dateiname abgleichen, finale CI abwarten, PR mergen, Vercel READY abwarten und die angemeldete App sowie Exportformat prüfen. Tests erzeugen ausschließlich isolierte Daten, keine Produktions-Workouts.

## Rückweg und Grenzen

Bei Codeproblemen das vorherige Deployment `dpl_HF4j6ePbcQxpReKSrEvhSejLPXoQ` oder den genannten 0.2-Commit wieder zuweisen. Additive Tabellen/RPCs behalten; keine DROP-/Rückwärtsmigration. v2 schreibt die Trainingssammlungen nicht und erhält neue Preference-Schlüssel. Training bleibt für ein erneutes Upgrade gespeichert, ist in 0.2 jedoch unsichtbar. Vor Rollback einen frischen Export sichern und Schreibzugriffe während des Wechsels pausieren. Provider-Restore nur bei einem nachgewiesenen Datenproblem und gesonderter Freigabe.

Kein automatisches Training, keine Progressionsalgorithmen, medizinische Entscheidungen, Social-Funktionen oder externe Health-Anbindung. Ganze Sessions müssen explizit abgeschlossen werden; Satzeingaben werden pro Satz gespeichert. HYROX-Runden sind pro Station modelliert, nicht als erzwungener globaler Zirkel. Pläne werden vom Benutzer angelegt; es werden keine künstlichen A/B-Produktionsdaten erzeugt.
