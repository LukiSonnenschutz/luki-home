# Störungsbehebung 0.3.2 — 2026-10-27

Ergänzt die Schutzmaßnahmen aus [0.3.1](HOTFIX-0.3.1.md). Die Live-Prüfung nach dem ersten Deployment zeigte weiter laufende Datenbankwiederholungen, obwohl der neue Client keine weiteren Versuche startete.

## Bestätigte Ursache

PostgREST 14.18 wiederholt benutzerdefinierte SQLSTATE-40001-Fehler endlos. Alle drei vorhandenen Home-Speicherfunktionen verwendeten diesen Code für fachliche Versionskonflikte. Dadurch konnten wenige konkurrierende Speicherungen die gemeinsame REST-Verbindungskapazität belegen und Luki OS mit PGRST003 blockieren. [Offizielle Supabase-Fehlerbeschreibung und Abhilfe](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions).

## Dauerhafte Korrektur

Migration `non_retryable_revision_conflicts` ersetzt ausschließlich den Fehlercode in den bestehenden Definitionen von `luki_home_save_state`, `_v2` und `_v3`: `PT409` liefert einen endgültigen HTTP-409-Konflikt. Eigentümer, ACL, SECURITY INVOKER, search_path, Revisionsprüfung und Funktionslogik bleiben erhalten. Keine Tabellen- oder Datenänderungen. Der Client erkennt den neuen und den bisherigen Code.

Die Migration wurde nach isolierter PostgreSQL-Prüfung auf der bestehenden Instanz angewandt. Anschließend enthielten alle drei Funktionen PT409 und keinen 40001 mehr. Die zehn zuvor über Logs zugeordneten Verbindungen waren bei der gezielten Bereinigungsabfrage bereits beendet; es musste kein Backend beendet und die Datenbank nicht neu gestartet werden. Danach waren keine Home-Speicherabfragen mehr aktiv.

## Prüfung und Sicherheitsgrenzen

29 Fach-/PostgreSQL-Tests einschließlich Nutzerisolation, RLS, vorhandener Historie, Funktionsberechtigungen, idempotenter Migration und Konflikten ohne Datenänderung. Cloud-Browsertests prüfen den HTTP-PT409-Vertrag, erhaltene Entwürfe und ausbleibende automatische Wiederholungen. Keine produktiven Testeinträge.

Alle 21 Home-Tabellen behalten RLS. Bestehende Hinweise zu nicht indizierten Fremdschlüsseln, ungenutzten Indizes und deaktivierter Prüfung kompromittierter Passwörter werden nicht im Rahmen dieser Störungsbehebung verändert. OS-Tabellen haben weiterhin RLS ohne Client-Policies und werden wie zuvor über ihren geschützten Server angesprochen.

Ein Rückwechsel auf SQLSTATE 40001 würde die Endlosschleife wieder ermöglichen. Bei künftigen fachlichen Konflikten PT409 beibehalten.
