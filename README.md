# Booktracker

Eine App für die eigene Buchsammlung: Regal, SuB, Lesejahre, Wunschliste, Statistik.
Läuft im Browser, lässt sich auf Handy und Computer wie eine App installieren und hat Konten,
damit später auch Freund:innen ihr eigenes Regal führen können.

## Was liegt wo

| Ordner | Inhalt |
| --- | --- |
| `app/` | Die Web-App (React, Vite, TypeScript). `npm run dev` startet sie lokal. |
| `supabase/migrations/` | Der Bauplan der Datenbank (Tabellen, Rechte). Wird einmal in Supabase eingespielt. |
| `scripts/` | Werkzeuge für den Umzug aus dem Google Sheet (`sheet_to_sql.py` erzeugt `data/import.sql`). |
| `data/raw/` | Rohdaten aus dem Sheet (Stand 13.10.2026), `data/import.sql` die fertige Einfüge-Datei. |
| `docs/` | Anleitungen: Einrichtung von Supabase und Cloudflare, Datenmodell. |

## Live

- App: https://booktracker.pages.dev (baut automatisch bei jedem Push auf `main`)
- Datenbank: Supabase-Projekt „booktracker“ (Frankfurt)

## Seiten

Start, Bibliothek (Karten oder Tabelle), Buchdetail, Buch eintragen (ISBN-Suche und Barcode-Scanner),
SuB-Zufallspicker, Regal (gesamt mit Filtern, nach Jahren), Reihen, Autor:innen, Ziele und Challenges (Bingo),
Wunschliste, Statistik, Einstellungen (Passwort, Export).

## Zwei Betriebsarten

- **Demo-Modus** (ohne Konto): Ohne die beiden Werte in `app/.env` liest die App `app/public/demo/data.json`
  und merkt sich Änderungen nur im Browser. Gut zum Ausprobieren.
- **Echter Betrieb**: Mit `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` in `app/.env` (Vorlage: `app/.env.example`)
  meldet man sich an, und alles liegt in der Datenbank. Siehe `docs/einrichtung.md`.

## Lokal starten

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm run build      # fertige Dateien in app/dist
```

## Daten aus dem Sheet übernehmen

```bash
python3 scripts/sheet_to_sql.py data/raw data/import.sql
# dann in Supabase (SQL-Editor) zuerst supabase/migrations/0001_init.sql ausführen,
# anschließend import.sql mit der eigenen Konto-ID statt :'owner' (siehe docs/einrichtung.md)
```
