# Datenmodell

Der Bauplan steht in `supabase/migrations/0001_init.sql`. Hier die Idee dahinter in Worten.

## Zwei Schichten

**Gemeinsame Buchdaten** (für alle Nutzer:innen gleich):

| Tabelle | Inhalt |
| --- | --- |
| `books` | Ein Buch: Titel, Originaltitel, ISBN, Klappentext, Verlag, Seiten, Art (Buch, Manga, …), Genre, Untergenres, Zielgruppe, Zeit, Schauplatz, Erzählperspektive, Hauptfiguren, Tropes, Triggerwarnungen, Cover, Reihe und Band |
| `authors` | Autor:innen mit Herkunft und Geschlecht |
| `book_authors` | Welche Autor:innen zu welchem Buch gehören (mit Reihenfolge) |
| `series` | Reihen mit Anzahl Bände, abgeschlossen ja/nein, Art der Reihe |
| `adaptations` | Verfilmungen, Serien, Anime, Spiele zu einem Buch |

**Persönliche Daten** (gehören einer Person, Spalte `user_id`):

| Tabelle | Inhalt |
| --- | --- |
| `profiles` | Das Konto: Anzeigename, Handle, Bild |
| `user_books` | Mein Verhältnis zum Buch: Status (lese, SuB, ungelesen, gelesen, abgebrochen), meine Ausgabe (Medium, Format, Edition, Extras, Preis, gekauft), Hörbuch-Angaben, Bewertung (Sterne, Kurzbewertung, Erwartung, Spice, Burn), Notiz, Rezension, aktuelle Seite |
| `readings` | Jeder einzelne Lesevorgang: Erstlesung, Rereads, Abbrüche mit Datum, Dauer und Abbruchgrund |
| `wishlist_items` | Wunschliste mit Erscheinungsdatum, Wunschformat, Preis, Priorität, Empfehlung |
| `sales` | Verkauf und Verkaufsplan |
| `goals` | Jahresziele (Bücher, SuB, Reihen) |
| `challenges` + `challenge_entries` | Challenges und Bingo-Felder |
| `favorites` | Tops (Bücher, Graphics, Autor:innen) |
| `friendships`, `share_links` | Freundschaften und Freigabe-Links für später |

## Rechte

- Buchdaten darf jede angemeldete Person lesen und ergänzen.
- Persönliche Daten sieht nur die Person selbst. Freund:innen (angenommene Freundschaft) dürfen lesen.
- Das regelt die Datenbank selbst (Row Level Security), nicht die App. Auch ein Fehler in der App kann
  deshalb keine fremden Daten zeigen.

## Übersetzung aus dem Sheet

| Sheet | Datenbank |
| --- | --- |
| Lesestatus „Gelesen / TBR / Ungelesen / DNF / Current Read / Second Read“ | `gelesen / tbr / ungelesen / abgebrochen / lese / lese` |
| Spice 🥛 bis 🌶️🌶️🌶️🌶️🌶️ | `spice` 0 bis 5 |
| Kurzbewertung 💕 Love … 💥 Hate | `verdict` love, like, middle, dislike, hate, idk |
| Rating „4.5“ | `rating` 4.5 (ein Ausreißer „5.5“ wurde auf 5 begrenzt) |
| „❔“ und „❌“ | leer |
| Einkaufspreis „9,99 €“ | `price_cents` 999 |
| Länge „13:31:00“ | `duration_min` 811 |
| Begonnen/Beendet nur mit Jahr („2019“) | `started_text` / `finished_text`, kein Datum |
| Spalte Reread und Tab ReReads | zusätzliche Zeilen in `readings` mit `read_number` 2, 3, … |
| Tab DNFs | Abbruchdetails am ersten Lesevorgang (Seite, Prozent, Gründe, endgültig) |
| Reihenart „Fortlaufende Reihe, Spin Off“ | `series.kind` = Fortlaufende Reihe, `books.series_roles` = {Spin Off} |

Ergebnis des Testlaufs: 1.551 Bücher, 591 Autor:innen, 440 Reihen, 912 Lesevorgänge (davon 42 Rereads,
7 Abbrüche), 442 Wünsche, 30 Verkäufe, 11 Favoriten, 25 Bingo-Felder. 12 ISBNs waren ungültig und 13 doppelt,
diese Bücher sind ohne ISBN drin und lassen sich später über die ISBN-Suche in der App ergänzen.
