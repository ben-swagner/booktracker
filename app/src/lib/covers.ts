/**
 * Cover-Suche in Stufen, wenn das direkte ISBN-Bild bei Open Library fehlt:
 *  1. Open Library, Suche nach Titel und Autor:in (findet auch andere Ausgaben desselben Buchs)
 *  2. Google Books per ISBN (ohne Schlüssel knapp bemessen, deshalb zuletzt)
 * Eine kleine Warteschlange lässt höchstens zwei Anfragen gleichzeitig laufen.
 */
const cache = new Map<string, string | null>();
try {
  for (const [k, v] of Object.entries(JSON.parse(sessionStorage.getItem("bt-cover2") ?? "{}"))) cache.set(k, v as string | null);
} catch { /* egal */ }

function persist() {
  try {
    const obj: Record<string, string | null> = {};
    let n = 0;
    for (const [k, v] of cache) { obj[k] = v; if (++n > 3000) break; }
    sessionStorage.setItem("bt-cover2", JSON.stringify(obj));
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

function norm(s: string) {
  return s.replace(/\(.*?\)/g, "").replace(/\s*[-–:].*$/, "").trim();
}

async function openLibrarySearch(title: string, author?: string): Promise<string | null> {
  const p = new URLSearchParams({ title: norm(title), limit: "5", fields: "cover_i,title,author_name" });
  if (author) p.set("author", author.split(/[,;]/)[0].trim());
  const r = await fetch(`https://openlibrary.org/search.json?${p}`);
  if (!r.ok) return null;
  const d = await r.json();
  const doc = (d.docs ?? []).find((x: any) => x.cover_i);
  return doc ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null;
}

const GOOGLE_KEY = (import.meta.env.VITE_GOOGLE_BOOKS_KEY as string | undefined) || "";

async function googleBooks(isbn: string): Promise<string | null> {
  if (googlePaused) return null;
  const key = GOOGLE_KEY ? `&key=${GOOGLE_KEY}` : "";
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&fields=items(volumeInfo/imageLinks)&maxResults=1${key}`);
  if (r.status === 429) { googlePaused = true; return null; }
  if (!r.ok) return null;
  const d = await r.json();
  const links = d.items?.[0]?.volumeInfo?.imageLinks;
  const url: string | null = links?.thumbnail ?? links?.smallThumbnail ?? null;
  return url ? url.replace("http://", "https://").replace("&edge=curl", "").replace("zoom=1", "zoom=2") : null;
}

export async function findCover(book: { isbn?: string | null; title: string; author?: string }): Promise<string | null> {
  const key = book.isbn || `t:${book.title}|${book.author ?? ""}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  await slot();
  try {
    let url: string | null = null;
    try { url = await openLibrarySearch(book.title, book.author); } catch { /* weiter */ }
    if (!url && book.isbn) { try { url = await googleBooks(book.isbn); } catch { /* weiter */ } }
    // Nur endgültige Antworten merken; bei Google-Pause später noch einmal versuchen
    if (url || !googlePaused || !book.isbn) { cache.set(key, url); persist(); }
    return url;
  } finally {
    release();
  }
}

/** Prüft, ob Open Library ein Bild zur ISBN hat (ohne es anzuzeigen). */
async function openLibraryIsbn(isbn: string): Promise<string | null> {
  try {
    const r = await fetch(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`, { method: "HEAD" });
    return r.ok ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : null;
  } catch { return null; }
}

/**
 * Cover-Lauf: geht alle Bücher ohne Bild durch, versucht alle Quellen und speichert Treffer.
 * Läuft so lange, bis die Liste durch ist oder abgebrochen wird.
 */
export async function coverRun(
  books: { id: string; isbn13?: string | null; title: string; author?: string }[],
  save: (bookId: string, url: string) => Promise<void>,
  onProgress: (done: number, total: number, found: number) => void,
  shouldStop: () => boolean
) {
  let done = 0, found = 0;
  for (const b of books) {
    if (shouldStop()) break;
    let url: string | null = null;
    if (b.isbn13) url = await openLibraryIsbn(b.isbn13);
    if (!url) url = await findCover({ isbn: b.isbn13, title: b.title, author: b.author });
    if (url) { found++; await save(b.id, url).catch(() => {}); }
    done++;
    onProgress(done, books.length, found);
  }
  return { done, found };
}
