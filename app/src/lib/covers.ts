/**
 * Zweite Cover-Quelle: Google Books. Wird nur gefragt, wenn Open Library kein Bild hat.
 * Eine kleine Warteschlange sorgt dafür, dass höchstens zwei Anfragen gleichzeitig laufen.
 */
const cache = new Map<string, string | null>();
try {
  for (const [k, v] of Object.entries(JSON.parse(sessionStorage.getItem("bt-gbcover") ?? "{}"))) cache.set(k, v as string | null);
} catch { /* egal */ }

function persist() {
  try {
    const obj: Record<string, string | null> = {};
    let n = 0;
    for (const [k, v] of cache) { obj[k] = v; if (++n > 3000) break; }
    sessionStorage.setItem("bt-gbcover", JSON.stringify(obj));
  } catch { /* egal */ }
}

let active = 0;
let paused = false; // nach einem 429 (zu viele Anfragen) für diese Sitzung aufhören
const waiting: (() => void)[] = [];
const MAX = 2;

function slot(): Promise<void> {
  if (active < MAX) { active++; return Promise.resolve(); }
  return new Promise((res) => waiting.push(() => { active++; res(); }));
}
function release() {
  active--;
  setTimeout(() => waiting.shift()?.(), 250);
}

export async function googleCover(isbn: string): Promise<string | null> {
  if (cache.has(isbn)) return cache.get(isbn) ?? null;
  if (paused) return null;
  await slot();
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&fields=items(volumeInfo/imageLinks)&maxResults=1`);
    if (r.status === 429) { paused = true; return null; }
    if (!r.ok) { cache.set(isbn, null); persist(); return null; }
    const d = await r.json();
    const links = d.items?.[0]?.volumeInfo?.imageLinks;
    let url: string | null = links?.thumbnail ?? links?.smallThumbnail ?? null;
    if (url) url = url.replace("http://", "https://").replace("&edge=curl", "").replace("zoom=1", "zoom=2");
    cache.set(isbn, url); persist();
    return url;
  } catch {
    return null;
  } finally {
    release();
  }
}
