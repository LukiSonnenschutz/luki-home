# Luki Home 0.1.1 — Online-Einrichtung

Code: Online-Adapter implementiert. Veröffentlichung: noch nicht erfolgt. Bestehender GitHub-Eigentümer ist `LukiSonnenschutz`; das private Repository `luki-os` gehört zur Geschäftsanwendung. Dessen Produktion `os.luki-sonnenschutz.de` wird nicht als Ziel von Luki Home verwendet.

## Bestehende Konten nutzen

Eine eigene Vercel-Anwendung `luki-home` und ein eigenes privates GitHub-Repository sind vorgesehen. Ein eigener Supabase-Datenbankbereich kann im vorhandenen Projekt genutzt werden, sofern dessen Projektzugriff, Auth-Konfiguration und Kapazität dies erlauben. Alternativ lässt sich ein separates Supabase-Projekt verwenden. Es werden keine bestehenden Geschäftsdaten oder Auth-Einstellungen ungeprüft verändert.

Die Tabellen heißen `luki_home.profiles`, `luki_home.tasks` usw. Der Schema-Name wird nicht als zusätzliche öffentliche Data-API-Schemafreigabe benötigt. Zwei eng begrenzte, authentifizierte Funktionen in `public` lesen und speichern ausschließlich den eigenen Luki-Home-Datenstand. Beide sind `SECURITY INVOKER`; RLS bleibt aktiv. Der Adapter nutzt keinen Service-Role-Schlüssel.

Das Speichern ersetzt einen kleinen persönlichen Snapshot innerhalb einer Transaktion und prüft eine gesperrte Revision. Fremde Nutzer-IDs werden nicht als Schreibberechtigung akzeptiert. Bei wachsender Historie kann dies später auf gezielte Einzelschreiboperationen erweitert werden; das aktuelle Modell ist bewusst für den persönlichen Core ausgelegt.

## Supabase vorbereiten

1. Vor jeder Änderung vorhandene Schema-/Funktionsnamen und Migration-Historie prüfen. Ist `luki_home` schon belegt, zuerst dessen Herkunft klären.
2. Die fünf SQL-Dateien aus `supabase/migrations/` geordnet als geprüfte, atomare Luki-Home-Migration anwenden. Bei einem bestehenden Luki-OS-Projekt nicht dessen Migration-Register mit dem lokalen Luki-Home-Register reparieren oder ersetzen. Die Anwendung berührt keine Geschäftstabelle.
3. Vorhandenen bestätigten Supabase-Auth-Nutzer für den Eigentümer verwenden. Falls noch keiner existiert, nur diesen Nutzer kontrolliert einladen. Das Passwort wählt der Eigentümer selbst. Bestehende Passwörter werden nicht aus SQLite kopiert.
4. `LUKI_ALLOWED_EMAIL` auf die bestätigte persönliche Login-Adresse festlegen. Die Anwendung bietet keine Registrierung; andere Projektbenutzer erhalten keinen App-Zugang. RLS trennt unabhängig davon alle Daten nach Auth-UID.
5. Luki-Home-Adresse bzw. Callback `/auth/callback` als erlaubtes Auth-Redirect-Ziel ergänzen, ohne die Luki-OS-Redirect-Ziele zu entfernen. Im gemeinsamen Projekt nicht dessen globale Site-URL oder E-Mail-Templates ohne Prüfung ersetzen. Passwort-Recovery nutzt das explizite Luki-Home-Redirect-Ziel. Optional auf einem separaten Projekt sind `/auth/confirm?token_hash=…&type=recovery` und `type=invite` als unterstützte eigene Template-Ziele verfügbar.
6. Mit zwei Testnutzern echte RLS-/RPC- und Session-Tests durchführen; keine echten Luki-OS-Bestellungen verändern.

## Vercel konfigurieren

Eigenes Projekt, Framework Next.js, Node.js 24, Build `pnpm build`. Persönliche Datenbankdateien, Sitzungen und `.env.local` werden nicht hochgeladen.

Erforderliche Umgebungsvariablen:

| Name | Inhalt |
| --- | --- |
| `LUKI_STORAGE` | `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL des freigegebenen Supabase-Projekts |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable-/Anon-Schlüssel, niemals Service-Role |
| `APP_ORIGIN` | feste HTTPS-Adresse dieser Luki-Home-Anwendung, ohne Pfad |
| `LUKI_ALLOWED_EMAIL` | bestätigte Login-Adresse des Eigentümers |

Preview und Production erhalten jeweils die passende feste Adresse und bewusst gewählte Datenbank. Nicht jedes beliebige Preview-Hostname-Muster als Auth-Redirect erlauben. Die Cloud-Sitzung verwendet ihren eigenen HttpOnly-Cookie-Namen `luki-home-auth`. Auth-Cookies einer anderen Anwendung werden nicht übernommen.

Nach dem Deployment: Login, Session-Erneuerung, Logout, unerlaubter Login, geschützte APIs, Tagesablauf, Neuladen und Export live prüfen. Erst danach produktive Nutzung bestätigen. Eine eigene Domain kann anschließend zugeordnet werden; keine vorhandene OS-Domain ersetzen.

## Lokale Daten übernehmen

1. Lokale App öffnen und „Daten exportieren“ wählen.
2. Online mit dem bestätigten Eigentümerkonto anmelden.
3. Im noch leeren Online-Zugang: Einstellungen → Lokale Daten übernehmen → ZIP auswählen → „Lokalen Export übernehmen“.
4. Manifestanzahlen und ausgewählte Tagesdaten prüfen. Die lokale Datenbank bleibt unverändert als Rückfallmöglichkeit erhalten.

Der Import kontrolliert Formatversion, Datensatzanzahlen, Beziehungen, IDs, Skalen, Status und Größenlimits. Er kopiert keine Passwörter oder Sitzungen und verhindert ein Überschreiben bereits genutzter Zugänge. Bei parallelen Änderungen greift die Revisionserkennung.

## Backup

Der persönliche ZIP-Export funktioniert in beiden Betriebsarten. Die vorhandenen verschlüsselten SQLite-Werkzeuge sichern ausschließlich den lokalen Betrieb. Für den Online-Betrieb sind verfügbare Supabase-Backups und ein unabhängiges Backup des Luki-Home-Bereichs samt Restore zu konfigurieren und real zu testen. Ein vollständiger Dump eines gemeinsam verwendeten Geschäftsprojekts wird nicht ungefragt als persönliches Backup hochgeladen. Auth-UID-Zuordnung und die beiden RPC-Funktionen müssen beim Wiederherstellen berücksichtigt werden.

## Aktuell offene Zugänge

- GitHub ist verbunden; bestehendes privates Luki-OS-Repository bestätigt.
- Supabase ist verbunden. Im bestehenden Projekt `Luki-OS` (`okhzzjmtvjzmgbrsohms`) wurden die fünf geprüften SQL-Dateien zusammen als Migration `20261004174055_luki_home_isolated_core` angewendet. Sie nicht erneut ausführen oder ungeprüft per CLI pushen; die lokale Dateiaufteilung unterscheidet sich von diesem gemeinsamen Migrationseintrag.
- Alle neun neuen Tabellen im Schema `luki_home` haben RLS und Eigentümerregeln. Beide RPCs laufen als `SECURITY INVOKER` mit festem leerem Suchpfad; anonyme Ausführung und Tabellenzugriffe sind gesperrt. Ein Aufruf ohne Auth-UID wurde auf dem Host korrekt verweigert.
- Noch kein Supabase-Auth-Konto vorhanden. Anmeldeadresse, Kontoanlage und Redirect-Adressen sind offen. Keine Auth-Einstellungen oder Geschäftstabellen wurden geändert.
- Der Versuch, Vercel im Browser zu öffnen, wurde ausdrücklich wegen abgelehnter Nutzerberechtigung blockiert. Diese Sperre wird nicht durch eine andere Browseroberfläche, CLI oder indirektes Deployment umgangen.
- Es wurde noch kein Luki-Home-Projekt auf Vercel veröffentlicht. Der echte angemeldete Cloud-Ablauf und Datenimport sind weiterhin offen.

Technische Grundlage: [Supabase SSR für Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [Supabase Datenbankfunktionen](https://supabase.com/docs/guides/database/functions).
