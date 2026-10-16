import { useState } from "react";
import type { Entry } from "../data/types";
import { useSaveReading, useSaveUserBook } from "../data/hooks";
import { fmtDate, today } from "../lib/labels";
import { Cover, ModePicker, SeriesNo, authorNames } from "./ui";
import { useOpenBook } from "./openBook";
import { toast } from "../App";
import { Icon } from "./Icon";

/** Große Karte für ein Buch, das gerade gelesen wird: Cover, Fortschritt und Seite direkt eintragen. */
export function ReadingNowCard({ e }: { e: Entry }) {
  const b = e.book, m = e.mine;
  const openBook = useOpenBook();
  const saveUB = useSaveUserBook();
  const saveReading = useSaveReading();
  const [page, setPage] = useState("");
  const open = e.readings.filter((r) => !r.abandoned && !r.finished_on && !r.finished_text).pop();
  const pct = b.pages && m.current_page ? Math.min(100, Math.round((m.current_page / b.pages) * 100)) : null;
  const since = open?.started_on;
  const days = since ? Math.max(1, Math.round((Date.parse(today()) - Date.parse(since)) / 86400000)) : null;

  async function savePage(ev: React.FormEvent) {
    ev.preventDefault();
    const n = Number(page);
    if (!n) return;
    await saveUB.mutateAsync({ id: m.id, book_id: b.id, current_page: n });
    setPage("");
    toast(`Seite ${n} gemerkt.`);
  }

  /** Buch als beendet eintragen: offener Durchgang bekommt heutiges Datum, Status wird „Gelesen“. */
  async function finish() {
    const d = today();
    const daysRead = open?.started_on ? Math.max(1, Math.round((Date.parse(d) - Date.parse(open.started_on)) / 86400000)) : null;
    await saveReading.mutateAsync({ ...(open ?? { user_book_id: m.id, read_number: e.readings.length + 1 }), user_book_id: m.id, finished_on: d, days: daysRead });
    await saveUB.mutateAsync({ id: m.id, book_id: b.id, status: "gelesen", current_page: null });
    toast(`Geschafft! „${b.title}“ ist als gelesen eingetragen. Zurücknehmen geht auf der Buchseite.`);
  }

  return (
    <article className="now-card" onClick={(ev) => { if (!(ev.target as HTMLElement).closest("form,a,button")) openBook(m.id); }}>
      <Cover title={b.title} author={authorNames(e)} url={b.cover_url} isbn={b.isbn13} bookId={b.id} genre={b.genre} large />
      <div className="now-body">
        <div className="card-top">
          <span className="pill st-lese">Am Lesen</span>
          {e.series && <span className="tag">{e.series.name}<SeriesNo n={b.series_number} /></span>}
        </div>
        <h3 className="now-title">{b.title}</h3>
        <p className="book-author" style={{ margin: 0 }}>{authorNames(e)}</p>
        <p className="meta" style={{ margin: 0 }}>{[b.genre, b.pages ? `${b.pages} Seiten` : null, since ? `seit ${fmtDate(since)}${days ? ` · ${days} ${days === 1 ? "Tag" : "Tage"}` : ""}` : null].filter(Boolean).join(" · ")}</p>
        <div className="now-mode"><span className="meta">Ich lese es als</span>
          <ModePicker small value={open?.mode} onChange={async (v) => {
            await saveReading.mutateAsync({ ...(open ?? { read_number: e.readings.length + 1, started_on: today() }), user_book_id: m.id, mode: v });
            toast(v ? `Gespeichert: ${v === "print" ? "gedruckt" : v === "ebook" ? "als eBook" : "als Hörbuch"}.` : "Leseart entfernt.");
          }} />
        </div>
        <div className="now-progress">
          <div className="progress big"><div style={{ width: `${pct ?? 0}%` }} /></div>
          <span className="mono">{m.current_page ? `Seite ${m.current_page}${b.pages ? ` von ${b.pages}` : ""}${pct != null ? ` · ${pct} %` : ""}` : "Noch keine Seite eingetragen"}</span>
        </div>
        <form className="now-page" onSubmit={savePage}>
          <input className="input" type="number" min={1} max={b.pages ?? undefined} placeholder="Seite" value={page} onChange={(ev) => setPage(ev.target.value)} aria-label="Aktuelle Seite" />
          <button className="btn small" type="submit" disabled={!page}>Seite merken</button>
          <button className="btn small primary now-done" type="button" onClick={finish}><Icon name="check" size={16} /> Beendet</button>
        </form>
      </div>
    </article>
  );
}
