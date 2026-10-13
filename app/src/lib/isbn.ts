/** ISBN-Hilfen und Buchdaten-Suche bei Open Library und Google Books. */

export function cleanIsbn(v: string): string | null {
  const d = v.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (d.length === 10) {
    const core = "978" + d.slice(0, 9);
    return core + check13(core);
  }
  if (d.length === 13 && /^\d+$/.test(d) && check13(d.slice(0, 12)) === d[12]) return d;
  return null;
}

function check13(core12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core12[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

export interface LookupResult {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  pages?: number;
  first_published?: string;
  blurb?: string;
  cover_url?: string;
  language?: string[];
  source: "openlibrary" | "googlebooks";
}

const LANG: Record<string, string> = { ger: "Deutsch", de: "Deutsch", eng: "Englisch", en: "Englisch", kor: "Koreanisch", ko: "Koreanisch", jpn: "Japanisch", ja: "Japanisch", fre: "Französisch", fr: "Französisch" };

async function openLibrary(isbn: string): Promise<LookupResult | null> {
  const r = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
  if (!r.ok) return null;
  const b = await r.json();
  const authors: string[] = [];
  for (const a of b.authors ?? []) {
    try {
      const ar = await fetch(`https://openlibrary.org${a.key}.json`);
      if (ar.ok) authors.push((await ar.json()).name);
    } catch { /* Autor:in bleibt leer */ }
  }
  const desc = typeof b.description === "string" ? b.description : b.description?.value;
  return {
    title: b.title,
    subtitle: b.subtitle,
    authors,
    publisher: b.publishers?.[0],
    pages: b.number_of_pages,
    first_published: b.publish_date,
    blurb: desc,
    cover_url: b.covers?.[0] ? `https://covers.openlibrary.org/b/id/${b.covers[0]}-L.jpg` : undefined,
    language: (b.languages ?? []).map((l: any) => LANG[String(l.key).split("/").pop() ?? ""]).filter(Boolean),
    source: "openlibrary"
  };
}

async function googleBooks(isbn: string): Promise<LookupResult | null> {
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
  if (!r.ok) return null;
  const d = await r.json();
  const v = d.items?.[0]?.volumeInfo;
  if (!v) return null;
  return {
    title: v.title,
    subtitle: v.subtitle,
    authors: v.authors,
    publisher: v.publisher,
    pages: v.pageCount,
    first_published: v.publishedDate,
    blurb: v.description,
    cover_url: v.imageLinks?.thumbnail?.replace("http://", "https://").replace("&edge=curl", ""),
    language: v.language ? [LANG[v.language] ?? v.language] : [],
    source: "googlebooks"
  };
}

/** Fragt beide Quellen und nimmt aus jeder, was die andere nicht hat. */
export async function lookupIsbn(raw: string): Promise<LookupResult | null> {
  const isbn = cleanIsbn(raw);
  if (!isbn) throw new Error("Das ist keine gültige ISBN.");
  const [ol, gb] = await Promise.all([openLibrary(isbn).catch(() => null), googleBooks(isbn).catch(() => null)]);
  if (!ol && !gb) return null;
  const first = ol ?? gb!;
  const second = ol ? gb : null;
  const merged: LookupResult = { ...first };
  if (second) {
    for (const k of Object.keys(second) as (keyof LookupResult)[]) {
      const cur = merged[k];
      if (cur == null || (Array.isArray(cur) && cur.length === 0) || cur === "") (merged as any)[k] = second[k];
    }
    // Google hat meist den besseren Klappentext
    if (second.blurb && (!merged.blurb || merged.blurb.length < 80)) merged.blurb = second.blurb;
  }
  return merged;
}
