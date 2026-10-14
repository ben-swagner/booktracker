import { useEffect, useRef, useState } from "react";
import { Link } from "./Link";
import { data } from "../data";
import { findCover } from "../lib/covers";
import type { Entry, ReadingStatus } from "../data/types";
import { STATUS, coverColors, fmtDate } from "../lib/labels";

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
export function Cover({ title, author, url, isbn, bookId, large }: { title: string; author?: string; url?: string | null; isbn?: string | null; bookId?: string; large?: boolean }) {
  const c = coverColors(title);
  const olTry = !url && isbn && !noCover.has(isbn) ? isbn : null;
  const [src, setSrc] = useState<string | null>(url ?? (olTry ? olCoverUrl(olTry, large ? "L" : "M") : null));
  const [stage, setStage] = useState<"url" | "ol" | "google" | "none">(url ? "url" : olTry ? "ol" : "google");

  useEffect(() => {
    setSrc(url ?? (olTry ? olCoverUrl(olTry, large ? "L" : "M") : null));
    setStage(url ? "url" : olTry ? "ol" : "google");
  }, [url, olTry, large]);

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
    <div className={"cover" + (large ? " lg" : "")} style={{ background: c.bg, color: c.fg }} aria-hidden="true">
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
  return (
    <Link className="card" to={`/buch/${m.id}`}>
      <Cover title={b.title} author={authorNames(e)} url={b.cover_url} isbn={b.isbn13} bookId={b.id} />
      <div className="card-body">
        <div className="card-top">
          <StatusPill status={m.status} />
          {e.series && (
            <span className="tag">
              {e.series.name}
              {b.series_number ? ` #${b.series_number}` : ""}
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

/** Maße eines Buchrückens: Breite nach Seitenzahl, Höhe nach Art und Dicke, kleiner Wackler pro Titel. */
export function spineSize(e: Entry, compact = false) {
  const pages = e.book.pages ?? 250;
  const w = Math.max(compact ? 12 : 14, Math.min(compact ? 36 : 44, Math.round(pages / (compact ? 24 : 20))));
  const base = /Manga|Manhwa|Comic|Kurzgeschichte|Kinderbuch/.test(e.book.kind ?? "") ? (compact ? 70 : 82) : (compact ? 84 : 98);
  const h = base + Math.min(22, Math.round(pages / 40)) + ((e.book.title.length * 7) % 9);
  return { w, h };
}

const GAP = 4;
const SHELF_PADDING = 24;

/**
 * Bretter, die sich an die verfügbare Breite anpassen: so viele Rücken pro Brett, wie hineinpassen,
 * dann das nächste Brett darunter. Kein seitliches Scrollen.
 */
export function ShelfRows({ entries, compact, colorFor, maxRows }: { entries: Entry[]; compact?: boolean; colorFor?: (e: Entry) => { bg: string; fg: string }; maxRows?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
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
            {row.map((e) => {
              const { w, h } = spineSize(e, compact);
              const c = colorFor ? colorFor(e) : coverColors(e.book.title);
              return (
                <Link key={e.mine.id} to={`/buch/${e.mine.id}`} className="spine" title={`${e.book.title} · ${authorNames(e)}`} style={{ width: w, height: h, background: c.bg, color: c.fg }}>
                  <span>{e.book.title}</span>
                </Link>
              );
            })}
          </div>
          <div className="plank" />
        </div>
      ))}
      {hidden > 0 && <p className="shelf-note">… und {hidden} weitere. <Link to="/regal?v=jahre">Alle Bretter ansehen</Link></p>}
    </div>
  );
}

/** Startseite: ein einziges langes Brett, das man seitlich rollt. */
export function Shelf({ entries, note }: { entries: Entry[]; note?: string }) {
  return (
    <div className="panel shelf-box">
      <div className="shelf-scroll">
        <div className="shelf">
          {entries.map((e) => {
            const c = coverColors(e.book.title);
            const { w, h } = spineSize(e, true);
            return (
              <Link key={e.mine.id} to={`/buch/${e.mine.id}`} className="spine" title={e.book.title} style={{ width: w, height: h, background: c.bg, color: c.fg }}>
                <span>{e.book.title}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="plank" />
      {note && <p className="shelf-note">{note}</p>}
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
