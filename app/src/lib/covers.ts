/**
 * Cover-Suche. Reihenfolge der Quellen, von sicher zu unsicher:
 *  1. Open Library, Bild direkt zur ISBN
 *  2. Google Books, Bild direkt zur ISBN
 *  3. Open Library, Suche nach Titel und Autor:in. Ein Treffer zählt nur, wenn Titel UND
 *     Nachname der Autor:in wirklich passen (sonst landen fremde Bücher im Regal).
 *  4. Google Books, Suche nach Titel und Autor:in, gleiche strenge Prüfung
 * Eine kleine Warteschlange lässt höchstens zwei Anfragen gleichzeitig laufen.
 */
const cache = new Map<string, string | null>();
try {
  for (const [k, v] of Object.entries(JSON.parse(sessionStorage.getItem("bt-cover3") ?? "{}"))) cache.set(k, v as string | null);
} catch { /* egal */ }

function persist() {
  try {
    const obj: Record<string, string | null> = {};
    let n = 0;
    for (const [k, v] of cache) { obj[k] = v; if (++n > 3000) break; }
    sessionStorage.setItem("bt-cover3", JSON.stringify(obj));
  } catch { /* egal */ }
}

let active = 0;
let googlePaused = false; // nach einem 429 (zu viele Anfragen) für diese Sitzung aufhören
const waiting: (() => void)[] = [];
const MAX = 2;

function slot(): Promise<void> {
  if (active < MAX) { active++; return Promise.resolve(); }
  return new Promise((res) => waiting.push(() => { active++; res(); }));
}
function release() {
  active--;
  setTimeout(() => waiting.shift()?.(), 300);
}

/** Titel ohne Untertitel und Klammern, klein, ohne Akzente und Satzzeichen. */
export function normTitle(s: string) {
  return s
    .replace(/\(.*?\)/g, "")
    .split(/\s*[:|]\s*/)[0]
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9äöüß ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normName(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9äöüß ]+/g, " ").trim();
}

/** Nachname der ersten Autor:in (letztes Wort), z. B. "Colleen Hoover" → "hoover". */
function surname(author?: string) {
  if (!author) return "";
  const first = author.split(/[,;&]| und /)[0].trim();
  const parts = normName(first).split(" ").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

/** Passt ein gefundenes Buch wirklich zu unserem? Titel muss (fast) gleich sein, Autor:in muss stimmen. */
export function matches(ours: { title: string; author?: string }, found: { title?: string; authors?: string[] }) {
  const a = normTitle(ours.title), b = normTitle(found.title ?? "");
  if (!a || !b) return false;
  const titleOk = a === b || ((a.startsWith(b) || b.startsWith(a)) && Math.min(a.length, b.length) / Math.max(a.length, b.length) >= 0.6);
  if (!titleOk) return false;
  const sn = surname(ours.author);
  if (!sn) return true; // ohne Autor:in bei uns können wir nur den Titel prüfen
  return (found.authors ?? []).some((x) => normName(x).split(" ").includes(sn));
}

/** Merker am Buch: Die Person möchte ausdrücklich kein Bild, nur den farbigen Einband. */
export const NO_COVER = "none";

export interface Candidate { url: string; label: string; source: "openlibrary" | "googlebooks"; sure: boolean }

const GOOGLE_KEY = (import.meta.env.VITE_GOOGLE_BOOKS_KEY as string | undefined) || "";

async function olIsbn(isbn: string): Promise<Candidate | null> {
  try {
    const r = await fetch(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`, { method: "HEAD" });
    return r.ok ? { url: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`, label: "Open Library, zur ISBN", source: "openlibrary", sure: true } : null;
  } catch { return null; }
}

function googleUrl(links: any): string | null {
  const url: string | null = links?.thumbnail ?? links?.smallThumbnail ?? null;
  return url ? url.replace("http://", "https://").replace("&edge=curl", "").replace("zoom=1", "zoom=2") : null;
}

async function googleFetch(q: string, max = 1): Promise<any[]> {
  if (googlePaused) return [];
  const key = GOOGLE_KEY ? `&key=${GOOGLE_KEY}` : "";
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&fields=items(volumeInfo(title,authors,imageLinks,language))&maxResults=${max}${key}`);
  if (r.status === 429) { googlePaused = true; return []; }
  if (!r.ok) return [];
  const d = await r.json();
  return d.items ?? [];
}

async function googleIsbn(isbn: string): Promise<Candidate | null> {
  const items = await googleFetch(`isbn:${isbn}`, 1);
  const url = googleUrl(items[0]?.volumeInfo?.imageLinks);
  return url ? { url, label: "Google Books, zur ISBN", source: "googlebooks", sure: true } : null;
}

async function olSearch(title: string, author?: string, limit = 8): Promise<Candidate[]> {
  const p = new URLSearchParams({ title: normTitle(title), limit: String(limit), fields: "cover_i,title,author_name,language,first_publish_year" });
  if (author) p.set("author", author.split(/[,;&]| und /)[0].trim());
  const r = await fetch(`https://openlibrary.org/search.json?${p}`);
  if (!r.ok) return [];
  const d = await r.json();
  const out: Candidate[] = [];
  for (const x of d.docs ?? []) {
    if (!x.cover_i) continue;
    const sure = matches({ title, author }, { title: x.title, authors: x.author_name });
    const lang = (x.language ?? []).includes("ger") ? "deutsche Ausgabe" : (x.language ?? []).includes("eng") ? "englische Ausgabe" : "";
    out.push({ url: `https://covers.openlibrary.org/b/id/${x.cover_i}-L.jpg`, label: `Open Library: ${x.title}${x.author_name?.[0] ? ", " + x.author_name[0] : ""}${lang ? " (" + lang + ")" : ""}`, source: "openlibrary", sure });
  }
  // Deutsche Ausgaben zuerst, danach sichere Treffer
  return out.sort((a, b) => Number(b.label.includes("deutsche")) - Number(a.label.includes("deutsche")) || Number(b.sure) - Number(a.sure));
}

async function googleSearch(title: string, author?: string, limit = 6): Promise<Candidate[]> {
  let q = `intitle:"${normTitle(title)}"`;
  const sn = surname(author);
  if (sn) q += ` inauthor:${sn}`;
  const items = await googleFetch(q, limit);
  const out: Candidate[] = [];
  for (const it of items) {
    const v = it.volumeInfo ?? {};
    const url = googleUrl(v.imageLinks);
    if (!url) continue;
    const sure = matches({ title, author }, { title: v.title, authors: v.authors });
    const lang = v.language === "de" ? " (deutsche Ausgabe)" : v.language === "en" ? " (englische Ausgabe)" : "";
    out.push({ url, label: `Google Books: ${v.title}${v.authors?.[0] ? ", " + v.authors[0] : ""}${lang}`, source: "googlebooks", sure });
  }
  return out.sort((a, b) => Number(b.label.includes("deutsche")) - Number(a.label.includes("deutsche")) || Number(b.sure) - Number(a.sure));
}

/**
 * Bestes Cover, nur sichere Treffer. Erst die ISBN bei beiden Quellen, dann strenge Titelsuche.
 * Gibt null zurück, wenn nichts eindeutig passt (lieber Stoffeinband als falsches Bild).
 */
export async function findCover(book: { isbn?: string | null; title: string; author?: string }): Promise<string | null> {
  const key = book.isbn || `t:${book.title}|${book.author ?? ""}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  await slot();
  try {
    let url: string | null = null;
    if (book.isbn) {
      url = (await olIsbn(book.isbn))?.url ?? null;
      if (!url) { try { url = (await googleIsbn(book.isbn))?.url ?? null; } catch { /* weiter */ } }
    }
    if (!url) { try { url = (await olSearch(book.title, book.author)).find((c) => c.sure)?.url ?? null; } catch { /* weiter */ } }
    if (!url) { try { url = (await googleSearch(book.title, book.author)).find((c) => c.sure)?.url ?? null; } catch { /* weiter */ } }
    // Nur endgültige Antworten merken; bei Google-Pause später noch einmal versuchen
    if (url || !googlePaused) { cache.set(key, url); persist(); }
    return url;
  } finally {
    release();
  }
}

/** Alle Vorschläge aus allen Quellen, zum Aussuchen von Hand. Sichere Treffer stehen vorn. */
export async function coverCandidates(book: { isbn?: string | null; title: string; author?: string }): Promise<Candidate[]> {
  const jobs: Promise<Candidate[] | Candidate | null>[] = [];
  if (book.isbn) { jobs.push(olIsbn(book.isbn)); jobs.push(googleIsbn(book.isbn).catch(() => null)); }
  jobs.push(olSearch(book.title, book.author).catch(() => []));
  jobs.push(googleSearch(book.title, book.author).catch(() => []));
  const res = await Promise.all(jobs);
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const r of res) {
    for (const c of Array.isArray(r) ? r : r ? [r] : []) {
      const k = c.url.replace(/-[SML]\.jpg$/, "");
      if (seen.has(k)) continue;
      seen.add(k); out.push(c);
    }
  }
  return out.sort((a, b) => Number(b.sure) - Number(a.sure));
}

/** Kam dieses Cover aus der alten, losen Titelsuche? (Open-Library-Bilder ohne ISBN-Bezug) */
export function isGuessedCover(url?: string | null) {
  return !!url && /covers\.openlibrary\.org\/b\/id\//.test(url);
}

/**
 * Cover-Lauf: geht die übergebenen Bücher durch, sucht nur sichere Treffer und speichert sie.
 * Läuft so lange, bis die Liste durch ist oder abgebrochen wird.
 */
export async function coverRun(
  books: { id: string; isbn13?: string | null; title: string; author?: string }[],
  save: (bookId: string, url: string | null) => Promise<void>,
  onProgress: (done: number, total: number, found: number) => void,
  shouldStop: () => boolean,
  clearFirst = false
) {
  let done = 0, found = 0;
  for (const b of books) {
    if (shouldStop()) break;
    const url = await findCover({ isbn: b.isbn13, title: b.title, author: b.author });
    if (url) { found++; await save(b.id, url).catch(() => {}); }
    else if (clearFirst) await save(b.id, null).catch(() => {});
    done++;
    onProgress(done, books.length, found);
  }
  return { done, found };
}
