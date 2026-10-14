import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Link } from "../components/Link";
import { useEntries } from "../data/hooks";
import type { Entry, ReadingStatus } from "../data/types";
import { STATUS, STATUS_ORDER, fmtDate } from "../lib/labels";
import { BookCard, Cover, Empty, Stars, StatusPill, authorNames, lastReading } from "../components/ui";

type Sort = "neu" | "beendet" | "titel" | "autor" | "bewertung";
const PAGE = 60;

function norm(s: string) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function Bibliothek() {
  const { entries, isLoading } = useEntries();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const status = (params.get("status") ?? "alle") as ReadingStatus | "alle";
  const q = params.get("q") ?? "";
  const sort = (params.get("sort") ?? "neu") as Sort;
  const view = (localStorage.getItem("bt-view") ?? "karten") as "karten" | "tabelle";
  const [limit, setLimit] = useState(PAGE);

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v && v !== "alle" && v !== "neu") p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
    setLimit(PAGE);
  };
  const setView = (v: "karten" | "tabelle") => {
    localStorage.setItem("bt-view", v);
    set("v", v === "tabelle" ? "t" : "");
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { alle: entries.length };
    for (const e of entries) c[e.mine.status] = (c[e.mine.status] ?? 0) + 1;
    return c;
  }, [entries]);

  const list = useMemo(() => {
    const nq = norm(q.trim());
    let out = entries.filter((e) => status === "alle" || e.mine.status === status);
    if (nq) {
      out = out.filter((e) => {
        const hay = norm([e.book.title, e.book.original_title, authorNames(e), e.series?.name, e.book.genre, e.book.subgenres?.join(" "), e.book.isbn13, e.book.publisher, e.book.tropes?.join(" ")].filter(Boolean).join(" "));
        return hay.includes(nq);
      });
    }
    const finished = (e: Entry) => e.readings.map((r) => r.finished_on ?? r.finished_text ?? "").sort().pop() ?? "";
    const cmp: Record<Sort, (a: Entry, b: Entry) => number> = {
      neu: (a, b) => (b.mine.created_at ?? "").localeCompare(a.mine.created_at ?? "") || a.book.title.localeCompare(b.book.title, "de"),
      beendet: (a, b) => finished(b).localeCompare(finished(a)),
      titel: (a, b) => a.book.title.localeCompare(b.book.title, "de"),
      autor: (a, b) => authorNames(a).localeCompare(authorNames(b), "de") || a.book.title.localeCompare(b.book.title, "de"),
      bewertung: (a, b) => (b.mine.rating ?? -1) - (a.mine.rating ?? -1)
    };
    return [...out].sort(cmp[sort]);
  }, [entries, status, q, sort]);

  if (isLoading) return <p className="muted">Lade…</p>;

  return (
    <>
      <div className="mast">
        <div>
          <h1>Biblio<em>thek</em></h1>
          <p className="lede">{list.length} von {entries.length} Büchern</p>
        </div>
        <div className="actions"><Link to="/neu" className="btn primary">+ Buch eintragen</Link></div>
      </div>

      <div className="toolbar">
        <div className="tabs" role="tablist">
          <button className="tab" role="tab" aria-selected={status === "alle"} onClick={() => set("status", "alle")}>Alle<span className="n">{counts.alle}</span></button>
          {STATUS_ORDER.map((s) => (
            <button key={s} className="tab" role="tab" data-status={s} aria-selected={status === s} onClick={() => set("status", s)}>
              {STATUS[s]}<span className="n">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="tools">
          <input className="input search" type="search" placeholder="Titel, Autor:in, Reihe, ISBN…" value={q} onChange={(e) => set("q", e.target.value)} />
          <select className="input" value={sort} onChange={(e) => set("sort", e.target.value)} aria-label="Sortierung">
            <option value="neu">Zuletzt eingetragen</option>
            <option value="beendet">Zuletzt beendet</option>
            <option value="titel">Titel A-Z</option>
            <option value="autor">Autor:in A-Z</option>
            <option value="bewertung">Beste Bewertung</option>
          </select>
          <div className="view-switch" role="group" aria-label="Ansicht">
            <button type="button" aria-pressed={view === "karten"} title="Als Karten zeigen" aria-label="Karten" onClick={() => setView("karten")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></svg>
            </button>
            <button type="button" aria-pressed={view === "tabelle"} title="Als Liste zeigen" aria-label="Liste" onClick={() => setView("tabelle")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth="3" /></svg>
            </button>
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="grid"><Empty title="Nichts gefunden" text="Probier einen anderen Suchbegriff oder Filter." /></div>
      ) : view === "tabelle" ? (
        <div
          className="panel table-scroll"
          onScroll={(ev) => {
            const el = ev.currentTarget;
            if (limit < list.length && el.scrollTop + el.clientHeight > el.scrollHeight - 400) setLimit(limit + PAGE);
          }}
        >
          <table className="table book-table">
            <thead><tr><th aria-label="Cover"></th><th>Titel</th><th>Autor:in</th><th>Reihe</th><th>Status</th><th>Bewertung</th><th>Beendet</th><th>Seiten</th></tr></thead>
            <tbody>
              {list.slice(0, limit).map((e) => {
                const last = lastReading(e);
                return (
                  <tr key={e.mine.id} className="row-link" onClick={(ev) => { if (!(ev.target as HTMLElement).closest("a")) nav(`/buch/${e.mine.id}`); }}>
                    <td className="cover-cell"><Cover title={e.book.title} author={authorNames(e)} url={e.book.cover_url} isbn={e.book.isbn13} bookId={e.book.id} /></td>
                    <td className="title-cell"><Link to={`/buch/${e.mine.id}`}>{e.book.title}</Link></td>
                    <td>{authorNames(e)}</td>
                    <td>{e.series ? `${e.series.name}${e.book.series_number ? ` #${e.book.series_number}` : ""}` : ""}</td>
                    <td><StatusPill status={e.mine.status} /></td>
                    <td><Stars value={e.mine.rating} /></td>
                    <td className="mono">{last ? fmtDate(last.finished_on, last.finished_text) : ""}</td>
                    <td className="mono">{e.book.pages ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid">{list.slice(0, limit).map((e) => <BookCard key={e.mine.id} e={e} />)}</div>
      )}
      {view === "karten" && list.length > limit && (
        <div className="actions" style={{ justifyContent: "center" }}>
          <button className="btn" onClick={() => setLimit(limit + PAGE)}>Mehr anzeigen ({list.length - limit} weitere)</button>
        </div>
      )}
    </>
  );
}
