import type { Entry } from "../data/types";

/** Text vergleichbar machen: klein, ohne Akzente, ohne Satzzeichen. */
export function normText(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ß&]+/g, " ")
    .split(" ").filter((w) => w && !["&", "and", "und", "et", "y"].includes(w)).join(" "); // „&“ und „and“ gleich behandeln
}

export const normIsbn = (s: string | null | undefined) => (s ?? "").replace(/[^0-9Xx]/g, "").toUpperCase();

/** Haupttitel ohne Untertitel, Bandangabe in Klammern usw. */
function mainTitle(t: string) {
  return normText(t.split(/:| [-–] | \(/)[0]);
}

function sameTitle(a: string, b: string) {
  const na = normText(a), nb = normText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // „Titel“ und „Titel: Sonderausgabe“ sind dasselbe Buch, „Titel (Vol. 7)“ und „Titel (Vol. 8)“ nicht
  const ma = mainTitle(a), mb = mainTitle(b);
  return ma === mb && (ma === na || mb === nb);
}

/** Nachname + erster Buchstabe des Vornamens, damit „S. J. Maas“ und „Sarah J. Maas“ gleich sind. */
function authorKey(name: string) {
  const parts = normText(name).split(" ").filter(Boolean);
  if (!parts.length) return "";
  return `${parts[parts.length - 1]}|${parts[0][0]}`;
}

export type Duplicate = { e: Entry; kind: "isbn" | "title" };

/**
 * Sucht in der eigenen Bibliothek nach demselben Buch:
 * gleiche ISBN = genau diese Ausgabe; gleicher Titel und gleiche Autor:in = vermutlich eine andere Ausgabe.
 */
export function findDuplicates(
  entries: Entry[],
  q: { isbn?: string; title?: string; authors?: string[] },
  excludeUserBookId?: string
): Duplicate[] {
  const isbn = normIsbn(q.isbn);
  const authorKeys = new Set((q.authors ?? []).map(authorKey).filter(Boolean));
  const out: Duplicate[] = [];
  for (const e of entries) {
    if (e.mine.id === excludeUserBookId) continue;
    if (isbn.length >= 10 && normIsbn(e.book.isbn13) === isbn) { out.push({ e, kind: "isbn" }); continue; }
    if (!q.title) continue;
    const titleHit = sameTitle(q.title, e.book.title) || (!!e.book.original_title && sameTitle(q.title, e.book.original_title));
    if (!titleHit) continue;
    const theirs = e.authors.map((a) => authorKey(a.name)).filter(Boolean);
    // Ohne Autor:innen-Angabe auf einer Seite reicht der Titel
    if (!authorKeys.size || !theirs.length || theirs.some((k) => authorKeys.has(k))) out.push({ e, kind: "title" });
  }
  return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "isbn" ? -1 : 1));
}
