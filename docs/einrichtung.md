# Einrichtung: Supabase, Cloudflare, GitHub

Diese Anleitung führt einmal durch alle Schritte, vom leeren Konto bis zur installierbaren App.
Es wird nichts programmiert, alles sind Klicks und ein paar Kopiervorgänge.

## 1. Supabase (die Datenbank mit Konten)

1. Auf https://supabase.com ein Konto anlegen (kostenlos) und „New project“ wählen.
   Name: `booktracker`, Region: `Central EU (Frankfurt)`, ein Datenbank-Passwort vergeben und gut aufheben.
2. Warten, bis das Projekt steht (etwa zwei Minuten).
3. Links im Menü **SQL Editor** öffnen, „New query“, den kompletten Inhalt von
   `supabase/migrations/0001_init.sql` einfügen und auf **Run** klicken. Damit sind alle Tabellen angelegt.
4. Links **Authentication → Providers**: „Email“ ist schon an. Dort „Confirm email“ ausschalten, wenn
   der Anmelde-Link reichen soll. Google und Apple können später dazukommen.
5. Links **Project Settings → API**: Dort stehen zwei Werte, die die App braucht:
   - `Project URL` → wird `VITE_SUPABASE_URL`
   - `anon public` Schlüssel → wird `VITE_SUPABASE_ANON_KEY`
   Beide in `app/.env` eintragen (Vorlage `app/.env.example`). Der `service_role`-Schlüssel bleibt geheim und
   kommt nirgends in die App.

### Die 1.551 Bücher einspielen

1. App einmal starten und mit der eigenen E-Mail anmelden. Dadurch entsteht das Konto.
2. In Supabase unter **Authentication → Users** die eigene **User UID** kopieren (eine lange Kennung wie
   `3f2a9c1e-…`).
3. Im **SQL Editor** eine neue Abfrage öffnen, den Inhalt von `data/import.sql` einfügen und darin
   `:'owner'` überall durch `'<die UID>'` ersetzen (Suchen und Ersetzen im Editor, inklusive der Anführungszeichen).
   Dann **Run**. Das dauert einige Sekunden.
4. App neu laden: Alle Bücher, die Wunschliste, Verkäufe und das Bingo sind da.

Falls etwas schiefgeht: Der Import ist so gebaut, dass er beim zweiten Durchlauf nichts doppelt anlegt.

## 2. GitHub (der Code)

1. Auf https://github.com/new ein neues Repository anlegen: Name `booktracker`, privat, ohne README.
2. Den Code dorthin schicken (einmalig, aus diesem Ordner):
   ```bash
   git remote add origin https://github.com/<dein-name>/booktracker.git
   git push -u origin main
   ```
   Danach übernimmt das Claude bei jeder Änderung.

## 3. Cloudflare Pages (die Veröffentlichung)

1. Auf https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git**.
2. GitHub verbinden und das Repository `booktracker` wählen.
3. Einstellungen für den Bau:
   - Framework preset: `Vite`
   - Root directory: `app`
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Unter **Environment variables** die beiden Werte aus Supabase eintragen:
   `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` (für Production und Preview).
5. **Save and Deploy**. Nach etwa einer Minute gibt es eine Adresse wie `booktracker-xyz.pages.dev`.
   Jeder neue Stand auf GitHub wird ab jetzt automatisch veröffentlicht.
6. In Supabase unter **Authentication → URL Configuration** diese Adresse als „Site URL“ und unter
   „Redirect URLs“ eintragen, sonst führt der Anmelde-Link ins Leere.

Eine eigene Adresse (zum Beispiel `buecher.deine-domain.de`) lässt sich später unter
**Custom domains** anhängen.

## 4. Auf dem Handy installieren

- iPhone: Adresse in Safari öffnen, Teilen-Symbol, „Zum Home-Bildschirm“.
- Android: Adresse in Chrome öffnen, im Menü „App installieren“.
- Computer: In Chrome oder Edge erscheint rechts in der Adressleiste ein Installieren-Symbol.

Danach öffnet sich der Booktracker mit eigenem Icon und ohne Browserleiste, auch offline für das, was
schon einmal geladen wurde.
