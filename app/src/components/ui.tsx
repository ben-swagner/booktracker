import { Link } from "./Link";
import type { Entry, ReadingStatus } from "../data/types";
import { STATUS, coverColors, fmtDate } from "../lib/labels";

export function Cover({ title, author, url, large }: { title: string; author?: string; url?: string | null; large?: boolean }) {
  const c = coverColors(title);
  return (
    <div className={"cover" + (large ? " lg" : "")} style={{ background: c.bg, color: c.fg }} aria-hidden="true">
      {url ? (
        <img src={url} alt="" loading="lazy" />
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
      <Cover title={b.title} author={authorNames(e)} url={b.cover_url} />
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

export function Shelf({ entries, note }: { entries: Entry[]; note?: string }) {
  return (
    <div className="panel shelf-box">
      <div className="shelf-scroll">
        <div className="shelf">
          {entries.map((e) => {
            const c = coverColors(e.book.title);
            const pages = e.book.pages ?? 250;
            const w = Math.max(14, Math.min(40, Math.round(pages / 22)));
            const h = 70 + ((e.book.title.length * 7) % 40);
            return (
              <Link key={e.mine.id} to={`/buch/${e.mine.id}`} className="spine" title={e.book.title}
                style={{ width: w, height: h, background: c.bg, color: c.fg }}>
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
