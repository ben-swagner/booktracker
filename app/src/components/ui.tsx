import { useEffect, useRef, useState } from "react";
import { Link } from "./Link";
import { isDesktop, useOpenBook } from "./openBook";
import { data } from "../data";
import { NO_COVER, findCover } from "../lib/covers";
import type { Entry, ReadingStatus } from "../data/types";
import { STATUS, fmtDate, genreCloud, genreColors, lentOf } from "../lib/labels";

/** Merkt sich pro Sitzung, welche ISBNs bei Open Library kein Bild haben, damit nichts doppelt versucht wird. */
const noCover = new Set<string>();
try {
  for (const k of JSON.parse(sessionStorage.getItem("bt-nocover") ?? "[]")) noCover.add(k);
} catch { /* egal */ }
function rememberNoCover(isbn: string) {
  noCover.add(isbn);
  try { sessionStorage.setItem("bt-nocover", JSON.stringify([...noCover].slice(-2000))); } catch { /* egal */ }
}

export function olCoverUrl(isbn: string, size: "S" | "M" | "L" = "M") {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg?default=false`;
}

/**
 * Buchcover: echtes Bild, wenn eine Adresse bekannt ist; sonst Versuch über die ISBN bei Open Library;
 * sonst ein farbiger Stoffeinband mit Titel. Ein gefundenes Bild wird am Buch gespeichert.
 */
export function Cover({ title, author, url: rawUrl, isbn, bookId, large, genre }: { title: string; author?: string; url?: string | null; isbn?: string | null; bookId?: string; large?: boolean; genre?: string | null }) {
  const c = genreCloud(genre, title);
  const wantsNone = rawUrl === NO_COVER; // ausdrücklich kein Bild: dann auch nicht suchen
  const url = wantsNone ? null : rawUrl;
  const olTry = !url && !wantsNone && isbn && !noCover.has(isbn) ? isbn : null;
  const [src, setSrc] = useState<string | null>(url ?? (olTry ? olCoverUrl(olTry, large ? "L" : "M") : null));
  const [stage, setStage] = useState<"url" | "ol" | "google" | "none">(url ? "url" : olTry ? "ol" : wantsNone ? "none" : "google");

  useEffect(() => {
    setSrc(url ?? (olTry ? olCoverUrl(olTry, large ? "L" : "M") : null));
    setStage(url ? "url" : olTry ? "ol" : wantsNone ? "none" : "google");
  }, [url, olTry, large, wantsNone]);

  // Weitere Stufen (Open-Library-Suche, Google Books), sobald das ISBN-Bild ausscheidet
  useEffect(() => {
    if (stage !== "google" || url) return;
    let alive = true;
    findCover({ isbn, title, author }).then((g) => {
      if (!alive) return;
      if (g) { setSrc(g); if (bookId) data.saveCover(bookId, g).catch(() => {}); }
      else setStage("none");
    });
    return () => { alive = false; };
  }, [stage, isbn, url, bookId, title, author]);

  const olFailed = () => {
    if (olTry) rememberNoCover(olTry);
    setSrc(null);
    setStage("google");
  };

  return (
    <div className={"cover" + (large ? " lg" : "") + (src ? "" : " cloud")} style={{ background: c.bg, color: c.fg, ["--cover-fg2" as string]: c.fg2 }} aria-hidden="true">
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={(e) => {
            const img = e.currentTarget;
            // Open Library liefert bei fehlendem Bild ein 1x1-Pixel: das zählt nicht
            if (img.naturalWidth <= 1) { if (stage === "ol") olFailed(); else setSrc(null); return; }
            if (stage === "ol" && olTry && bookId) data.saveCover(bookId, olCoverUrl(olTry, "L")).catch(() => {});
          }}
          onError={() => { if (stage === "ol") olFailed(); else setSrc(null); }}
        />
      ) : (
        <>
          <div className="cover-title">{title}</div>
          <div className="cover-author">{author}</div>
        </>
      )}
    </div>
  );
}

export function Stars({ value }: { value?: number | null }) {
  if (value == null) return null;
  return (
    <span className="stars" aria-label={`${value} von 5 Sternen`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span className="st" key={i}>
            <span className="st-bg">★</span>
            <span className="st-fill" style={{ width: `${fill * 100}%` }}>★</span>
          </span>
        );
      })}
    </span>
  );
}

/** Nummer eines Reihenbands als kleines rundes Abzeichen (statt „#3“). */
export function SeriesNo({ n, total }: { n?: string | number | null; total?: number | null }) {
  if (n == null || n === "") return null;
  return <span className="sno" title={`Band ${n}${total ? ` von ${total}` : ""}`} aria-label={`Band ${n}${total ? ` von ${total}` : ""}`}>{n}</span>;
}

export function StatusPill({ status }: { status: ReadingStatus }) {
  return <span className={"pill st-" + status}>{STATUS[status]}</span>;
}

export function authorNames(e: Entry) {
  return e.authors.map((a) => a.name).join(", ");
}

export function lastReading(e: Entry) {
  return [...e.readings].reverse()[0];
}

export function BookCard({ e }: { e: Entry }) {
  const b = e.book;
  const m = e.mine;
  const last = lastReading(e);
  const progress = m.status === "lese" && b.pages && m.current_page ? Math.min(100, Math.round((m.current_page / b.pages) * 100)) : null;
  const openBook = useOpenBook();
  return (
    <Link className="card" to={`/buch/${m.id}`} onClick={(ev) => {
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || !isDesktop()) return;
      ev.preventDefault();
      openBook(m.id);
    }}>
      <Cover title={b.title} author={authorNames(e)} url={b.cover_url} isbn={b.isbn13} bookId={b.id} genre={b.genre} />
      <div className="card-body">
        <div className="card-top">
          <StatusPill status={m.status} />
          {lentOf(m.condition) && <span className="tag lent-tag" title={`Verliehen${lentOf(m.condition)!.to ? ` an ${lentOf(m.condition)!.to}` : ""}`}>Verliehen</span>}
          {e.series && (
            <span className="tag">
              {e.series.name}
              <SeriesNo n={b.series_number} />
            </span>
          )}
        </div>
        <div className="book-title">{b.title}</div>
        <p className="book-author">{authorNames(e)}</p>
        <p className="meta">
          {[b.kind, b.genre, b.pages ? `${b.pages} S.` : null].filter(Boolean).join(" · ")}
        </p>
        {m.rating != null && (
          <p className="meta">
            <Stars value={m.rating} /> {m.rating}
          </p>
        )}
        {progress != null && (
          <>
            <div className="progress"><div style={{ width: `${progress}%` }} /></div>
            <p className="meta">Seite {m.current_page} von {b.pages} ({progress} %)</p>
          </>
        )}
        {m.status === "gelesen" && last && (last.finished_on || last.finished_text) && (
          <p className="meta">Beendet {fmtDate(last.finished_on, last.finished_text)}{e.readings.length > 1 ? ` · ${e.readings.length}× gelesen` : ""}</p>
        )}
      </div>
    </Link>
  );
}

/** Breite eines Elements beobachten (für Bretter, die sich an den Bildschirm anpassen). */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => setW(Math.floor(es[0].contentRect.width)));
    ro.observe(el);
    setW(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Welche Bauart ein Buch im Regal hat. Bei mehreren Formaten zählt das gedruckte. */
export type Binding = "hardcover" | "paperback" | "taschenbuch" | "manga" | "ebook";

export function bindingOf(e: Entry): Binding {
  const f = (e.mine.format ?? []).map((x) => x.toLowerCase());
  if (/Manga|Manhwa|Comic|Kinderbuch/.test(e.book.kind ?? "") && !f.includes("hardcover")) return "manga";
  if (f.includes("hardcover")) return "hardcover";
  if (f.includes("paperback") || f.some((x) => x.includes("klappen"))) return "paperback";
  if (f.includes("taschenbuch")) return "taschenbuch";
  if (f.includes("ebook") || (e.mine.medium?.length && !e.mine.medium.includes("Print"))) return "ebook";
  return "taschenbuch";
}

export const BINDING_LABEL: Record<Binding, string> = {
  hardcover: "Hardcover", paperback: "Paperback", taschenbuch: "Taschenbuch", manga: "Manga/Comic", ebook: "eBook"
};

/** Echte Höhen in cm (ungefähr): Manga 17,5 · Taschenbuch 18,7 · Paperback 21 · Hardcover 22. */
const HEIGHT_CM: Record<Binding, number> = { manga: 17.5, taschenbuch: 18.7, ebook: 20, paperback: 21, hardcover: 22.2 };

/** Maße eines Buchrückens: Breite nach Seitenzahl, Höhe nach Bauart (Hardcover, Taschenbuch …). */
export function spineSize(e: Entry, compact = false) {
  const pages = e.book.pages ?? 250;
  const bind = bindingOf(e);
  const extra = bind === "hardcover" ? 3 : 0; // Buchdeckel machen den Rücken etwas breiter
  const w = Math.max(compact ? 12 : 14, Math.min(compact ? 38 : 46, Math.round(pages / (compact ? 24 : 20)) + extra));
  const h = Math.round(HEIGHT_CM[bind] * (compact ? 4.6 : 5.2)) + ((e.book.title.length * 7) % 3);
  return { w, h, bind };
}

/** Kurzer Titel für den Rücken: ohne Untertitel nach „:“ oder „ - “. */
function spineTitle(t: string) {
  return t.split(/:| [-–] | \(/)[0].trim();
}

/** Passt der Titel vollständig auf den Rücken? Sonst bleibt der Rücken ohne Schrift. */
function titleFits(title: string, w: number, h: number) {
  const lines = w >= 34 ? 2 : w >= 17 ? 1 : 0;
  if (!lines) return false;
  const perLine = Math.floor((h - 14) / 6.1);
  if (title.length <= perLine) return true;
  if (lines < 2) return false;
  // auf zwei Zeilen an Wortgrenzen umbrechen
  let line = 0, used = 0;
  for (const word of title.split(" ")) {
    const len = used ? used + 1 + word.length : word.length;
    if (len <= perLine) used = len;
    else { line++; used = word.length; if (word.length > perLine || line >= lines) return false; }
  }
  return true;
}

/** Kurztitel, die auf einem Brett mehrfach vorkämen (z. B. Bände einer Reihe): dort den vollen Titel nehmen. */
function sharedShortTitles(entries: Entry[]) {
  const seen = new Map<string, Set<string>>();
  for (const e of entries) {
    const k = spineTitle(e.book.title);
    if (!seen.has(k)) seen.set(k, new Set());
    seen.get(k)!.add(e.book.title);
  }
  return new Set([...seen].filter(([, titles]) => titles.size > 1).map(([k]) => k));
}

function Spine({ e, compact, color, onHover, shared }: { e: Entry; compact?: boolean; color: { bg: string; fg: string }; onHover: (e: Entry | null) => void; shared?: Set<string> }) {
  const { w, h, bind } = spineSize(e, compact);
  const openBook = useOpenBook();
  const short = spineTitle(e.book.title);
  const t = shared?.has(short) ? e.book.title : short;
  const show = titleFits(t, w, h);
  return (
    <Link
      to={`/buch/${e.mine.id}`}
      className={`spine b-${bind}`}
      title={`${e.book.title} · ${authorNames(e)}`}
      style={{ width: w, height: h, background: color.bg, color: color.fg }}
      onClick={(ev) => { if (ev.metaKey || ev.ctrlKey || ev.shiftKey || !isDesktop()) return; ev.preventDefault(); openBook(e.mine.id); }}
    >
      <span className="spine-hover" onMouseEnter={() => onHover(e)} onMouseLeave={() => onHover(null)} />
      {show ? <span className={"spine-title" + (w >= 34 && t.length > Math.floor((h - 14) / 6.1) ? " two" : "")}>{t}</span> : <span className="spine-bands" />}
    </Link>
  );
}

/** Zeile unter dem Brett: zeigt Titel und Infos zum Buch, über dem die Maus gerade ist. */
function ShelfInfo({ e, fallback }: { e: Entry | null; fallback?: React.ReactNode }) {
  if (!e) return <p className="shelf-note">{fallback}</p>;
  const last = lastReading(e);
  return (
    <p className="shelf-note shelf-info">
      <strong>{e.book.title}</strong>
      {" · "}{authorNames(e)}
      {e.book.pages ? ` · ${e.book.pages} S.` : ""}
      {` · ${BINDING_LABEL[bindingOf(e)]}`}
      {last && (last.finished_on || last.finished_text) ? ` · beendet ${fmtDate(last.finished_on, last.finished_text)}` : ""}
    </p>
  );
}

const GAP = 4;
const SHELF_PADDING = 24;

/**
 * Bretter, die sich an die verfügbare Breite anpassen: so viele Rücken pro Brett, wie hineinpassen,
 * dann das nächste Brett darunter. Kein seitliches Scrollen.
 */
export function ShelfRows({ entries, compact, colorFor, maxRows }: { entries: Entry[]; compact?: boolean; colorFor?: (e: Entry) => { bg: string; fg: string }; maxRows?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Entry | null>(null);
  const shared = sharedShortTitles(entries);
  const avail = Math.max(200, (width || 320) - SHELF_PADDING);
  const rows: Entry[][] = [];
  let cur: Entry[] = [], used = 0;
  for (const e of entries) {
    const { w } = spineSize(e, compact);
    if (used + w + GAP > avail && cur.length) { rows.push(cur); cur = []; used = 0; }
    cur.push(e); used += w + GAP;
  }
  if (cur.length) rows.push(cur);
  const shown = maxRows ? rows.slice(0, maxRows) : rows;
  const hidden = rows.slice(shown.length).reduce((n, r) => n + r.length, 0);
  return (
    <div ref={ref} className="shelf-rows">
      {shown.map((row, i) => (
        <div key={i} className="shelf-row">
          <div className="shelf shelf-wrap">
            {row.map((e, j) => <Spine key={`${e.mine.id}-${j}`} e={e} compact={compact} color={colorFor ? colorFor(e) : genreColors(e.book.genre, e.book.title)} onHover={setHover} shared={shared} />)}
          </div>
          <div className="plank" />
        </div>
      ))}
      <ShelfInfo e={hover} fallback={hidden > 0 ? <>… und {hidden} weitere. <Link to="/regal?v=jahre">Alle Bretter ansehen</Link></> : <span className="desk-only">Fahr mit der Maus über ein Buch, um den Titel zu sehen.</span>} />
    </div>
  );
}

/** Größe eines Covers im Cover-Regal: gleiche Grundhöhe, Hardcover etwas größer, Manga etwas kleiner. */
function coverSize(e: Entry, base: number) {
  const bind = bindingOf(e);
  const k = bind === "hardcover" ? 1 : bind === "manga" ? 0.84 : 0.93;
  const h = Math.round(base * k);
  return { w: Math.round(h * 0.66), h, bind };
}
const COVER_GAP = 14;

/** Regal mit Covern: Bücher stehen mit der Vorderseite nach vorn auf den Brettern. */
export function CoverShelfRows({ entries }: { entries: Entry[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Entry | null>(null);
  const openBook = useOpenBook();
  const small = (width || 320) < 560;
  const base = small ? 104 : 160;
  const gap = small ? 10 : COVER_GAP;
  const avail = Math.max(200, (width || 320) - (small ? 20 : 32));
  const rows: Entry[][] = [];
  let cur: Entry[] = [], used = 0;
  for (const e of entries) {
    const { w } = coverSize(e, base);
    if (used + w + gap > avail && cur.length) { rows.push(cur); cur = []; used = 0; }
    cur.push(e); used += w + gap;
  }
  if (cur.length) rows.push(cur);
  return (
    <div ref={ref} className="shelf-rows cover-shelf">
      {rows.map((row, i) => (
        <div key={i} className="shelf-row">
          <div className="cshelf">
            {row.map((e, j) => {
              const { w, h, bind } = coverSize(e, base);
              return (
                <Link
                  key={`${e.mine.id}-${j}`}
                  to={`/buch/${e.mine.id}`}
                  className={`cbook b-${bind}`}
                  title={`${e.book.title} · ${authorNames(e)}`}
                  style={{ width: w, height: h }}
                  onClick={(ev) => { if (ev.metaKey || ev.ctrlKey || ev.shiftKey || !isDesktop()) return; ev.preventDefault(); openBook(e.mine.id); }}
                >
                  <span className="cbook-in" onMouseEnter={() => setHover(e)} onMouseLeave={() => setHover(null)}>
                    <Cover title={e.book.title} author={authorNames(e)} url={e.book.cover_url} isbn={e.book.isbn13} bookId={e.book.id} genre={e.book.genre} />
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="plank" />
        </div>
      ))}
      <ShelfInfo e={hover} fallback={<span className="desk-only">Fahr mit der Maus über ein Cover, um Titel und Infos zu sehen.</span>} />
    </div>
  );
}

/** Startseite: ein einziges langes Brett, das man seitlich rollt. */
export function Shelf({ entries, note }: { entries: Entry[]; note?: React.ReactNode }) {
  const [hover, setHover] = useState<Entry | null>(null);
  const shared = sharedShortTitles(entries);
  return (
    <div className="panel shelf-box">
      <div className="shelf-scroll">
        <div className="shelf">
          {entries.map((e, j) => <Spine key={`${e.mine.id}-${j}`} e={e} compact color={genreColors(e.book.genre, e.book.title)} onHover={setHover} shared={shared} />)}
        </div>
      </div>
      <div className="plank" />
      <ShelfInfo e={hover} fallback={note} />
    </div>
  );
}

export function Empty({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children && <div className="actions" style={{ justifyContent: "center", marginTop: 14 }}>{children}</div>}
    </div>
  );
}

/**
 * Sterne zum Antippen, auch halbe: linke Hälfte eines Sterns = halber Stern, rechte = ganzer.
 * Ein Tipp auf den aktuellen Wert setzt die Bewertung zurück.
 */
export function StarPicker({ value, onChange, size = 30 }: { value: number | null; onChange: (v: number | null) => void; size?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  const pick = (v: number) => onChange(value === v ? null : v);
  return (
    <div className="star-picker" onMouseLeave={() => setHover(null)} style={{ ["--sp" as string]: `${size}px` }}>
      <div className="sp-stars" role="radiogroup" aria-label="Sterne">
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = Math.max(0, Math.min(1, shown - i));
          return (
            <span key={i} className="sp-star">
              <span className="sp-bg" aria-hidden="true">★</span>
              <span className="sp-fill" aria-hidden="true" style={{ width: `${fill * 100}%` }}>★</span>
              <button type="button" className="sp-half l" role="radio" aria-checked={value === i + 0.5} aria-label={`${(i + 0.5).toString().replace(".", ",")} Sterne`} onMouseEnter={() => setHover(i + 0.5)} onClick={() => pick(i + 0.5)} />
              <button type="button" className="sp-half r" role="radio" aria-checked={value === i + 1} aria-label={`${i + 1} ${i ? "Sterne" : "Stern"}`} onMouseEnter={() => setHover(i + 1)} onClick={() => pick(i + 1)} />
            </span>
          );
        })}
      </div>
      <span className="sp-value mono">{shown ? `${shown.toString().replace(".", ",")} von 5` : "noch keine"}</span>
      {value != null && <button type="button" className="sp-clear" onClick={() => onChange(null)} aria-label="Bewertung entfernen">×</button>}
    </div>
  );
}

/** Wie ein Durchgang gelesen wird: gedruckt, als eBook oder als Hörbuch. Ein Tipp auf die aktive Wahl hebt sie auf. */
export const READ_MODES: [string, string, string][] = [["print", "Gedruckt", "book"], ["ebook", "eBook", "tablet"], ["audio", "Hörbuch", "headphones"]];
/** Welche Lesearten ein Buch hergibt, je nachdem welche Ausgaben man besitzt (Medium und Format). Unbekannt: alle. */
export function ownedModes(m: { medium?: string[] | null; format?: string[] | null }): { modes: string[]; printLabel?: string } {
  const med = (m.medium ?? []).map((x) => x.toLowerCase()), fmt = (m.format ?? []).map((x) => x.toLowerCase());
  const printFmts = (m.format ?? []).filter((x) => /hardcover|taschenbuch|paperback|klappen|broschur/i.test(x));
  const modes = new Set<string>();
  if (med.includes("print") || printFmts.length) modes.add("print");
  if (med.includes("digital") || fmt.includes("ebook")) modes.add("ebook");
  if (med.some((x) => x.startsWith("audio") || x.includes("hör")) || fmt.some((x) => x.includes("hör") || x.startsWith("audio"))) modes.add("audio");
  return { modes: modes.size ? READ_MODES.map(([k]) => k).filter((k) => modes.has(k)) : READ_MODES.map(([k]) => k), printLabel: printFmts.length === 1 ? printFmts[0] : undefined };
}

export function ModePicker({ value, onChange, small, allowed, printLabel }: { value?: string | null; onChange: (v: string | null) => void; small?: boolean; allowed?: string[]; printLabel?: string }) {
  // eine schon gewählte Leseart bleibt sichtbar, auch wenn die Ausgabe nicht mehr eingetragen ist
  const show = READ_MODES.filter(([k]) => !allowed || allowed.includes(k) || k === value);
  return (
    <div className={"mode-picker" + (small ? " small" : "")} role="radiogroup" aria-label="Wie liest du es?">
      {show.map(([k, l0]) => { const l = k === "print" && printLabel ? printLabel : l0; return (
        <button key={k} type="button" role="radio" aria-checked={value === k} className={"mode-opt mode-" + k + (value === k ? " on" : "")} onClick={() => onChange(value === k ? null : k)}>{l}</button>
      ); })}
    </div>
  );
}
