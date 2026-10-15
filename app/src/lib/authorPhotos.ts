/**
 * Fotos von Autor:innen suchen, wenn noch keins gespeichert ist:
 *  1. Wikipedia (erst deutsch, dann englisch), nur wenn der Artikel wirklich eine schreibende Person beschreibt
 *  2. Open Library (Autor:innen-Fotos), nur bei genau passendem Namen
 * Ergebnisse (auch „nichts gefunden“) merkt sich das Gerät, damit nicht ständig neu gesucht wird.
 * Eine kleine Warteschlange lässt höchstens zwei Suchen gleichzeitig laufen.
 */
const KEY = "bt-authorphoto";
const cache = new Map<string, string | null>();
try {
  for (const [k, v] of Object.entries(JSON.parse(localStorage.getItem(KEY) ?? "{}"))) cache.set(k, v as string | null);
} catch { /* egal */ }

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries([...cache].slice(-3000)))); } catch { /* egal */ }
}

let active = 0;
const waiting: (() => void)[] = [];
function slot(): Promise<void> {
  if (active < 2) { active++; return Promise.resolve(); }
  return new Promise((res) => waiting.push(() => { active++; res(); }));
}
function release() { active--; setTimeout(() => waiting.shift()?.(), 250); }

// Woran man erkennt, dass ein Wikipedia-Artikel zu einer schreibenden oder zeichnenden Person gehört
const WRITER = /(autor|schriftsteller|writer|author|novelist|poet|dichter|mangaka|manga|comic|illustrat|zeichner|journalist|drehbuch|screenwriter|essayist|lyrik)/i;

async function wikipedia(name: string, lang: "de" | "en"): Promise<string | null> {
  const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, "_"))}?redirect=true`);
  if (!r.ok) return null;
  const d = await r.json();
  if (d.type === "disambiguation" || !d.thumbnail?.source) return null;
  if (!WRITER.test(`${d.description ?? ""} ${d.extract ?? ""}`.slice(0, 400))) return null;
  // etwas größeres Vorschaubild anfordern
  return String(d.thumbnail.source).replace(/\/(\d+)px-/, "/400px-");
}

function probe(url: string): Promise<boolean> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img.naturalWidth > 1);
    img.onerror = () => res(false);
    img.src = url;
  });
}

const simple = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");

async function openLibrary(name: string): Promise<string | null> {
  const r = await fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}&limit=3`);
  if (!r.ok) return null;
  const d = await r.json();
  const hit = (d.docs ?? []).find((x: any) => simple(x.name ?? "") === simple(name));
  if (!hit?.key) return null;
  const url = `https://covers.openlibrary.org/a/olid/${hit.key}-M.jpg?default=false`;
  return (await probe(url)) ? url : null;
}

export function cachedAuthorPhoto(name: string): string | null | undefined {
  return cache.get(name);
}

export async function findAuthorPhoto(name: string): Promise<string | null> {
  if (cache.has(name)) return cache.get(name)!;
  // Duos und Gruppen („A & B“, „A, B“) haben kein gemeinsames Foto
  if (/[&,/]| und | and /.test(name)) { cache.set(name, null); persist(); return null; }
  await slot();
  try {
    let url: string | null = null;
    for (const step of [() => wikipedia(name, "de"), () => wikipedia(name, "en"), () => openLibrary(name)]) {
      try { url = await step(); } catch { url = null; }
      if (url) break;
    }
    cache.set(name, url);
    persist();
    return url;
  } finally {
    release();
  }
}

/** Fotos aus der alten Tabelle (mit der App ausgeliefert unter /authors/sheet/). */
export type SheetPhoto = { n: string; f: string };
let sheetPhotos: Promise<SheetPhoto[]> | null = null;
export function loadSheetPhotos(): Promise<SheetPhoto[]> {
  if (!sheetPhotos) sheetPhotos = fetch("/authors/sheet/index.json").then((r) => (r.ok ? r.json() : [])).catch(() => []);
  return sheetPhotos;
}
const nameKey = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
export function sheetPhotoFor(list: SheetPhoto[], name: string): string | null {
  const k = nameKey(name);
  const hit = list.find((x) => nameKey(x.n) === k);
  return hit ? `/authors/sheet/${hit.f}` : null;
}
export const isSheetPhoto = (url?: string | null) => !!url && url.startsWith("/authors/sheet/");
