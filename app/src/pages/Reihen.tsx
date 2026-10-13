import { useMemo, useState } from "react";
import { useEntries } from "../data/hooks";
import type { Entry, Series } from "../data/types";
import { seriesNo } from "../lib/stats";
import { Link } from "../components/Link";
import { Empty, StatusPill, authorNames } from "../components/ui";

type Group = { series: Series; vols: Entry[]; read: number; owned: number; reading: number; total: number; next?: Entry; authors: string };
type Filter = "alle" | "dabei" | "fertig" | "offen" | "unvollstaendig";

export default function Reihen() {
  const { entries, isLoading } = useEntries();
  const [filter, setFilter] = useState<Filter>("alle");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => {
    const by = new Map<string, Group>();
    for (const e of entries) {
      if (!e.series) continue;
      let g = by.get(e.series.id);
      if (!g) { g = { series: e.series, vols: [], read: 0, owned: 0, reading: 0, total: 0, authors: authorNames(e) }; by.set(e.series.id, g); }
      g.vols.push(e);
    }
    const out: Group[] = [];
    for (const g of by.values()) {
      g.vols.sort((a, b) => seriesNo(a.book.series_number) - seriesNo(b.book.series_number) || a.book.title.localeCompare(b.book.title, "de"));
      g.read = g.vols.filter((e) => e.mine.status === "gelesen").length;
      g.reading = g.vols.filter((e) => e.mine.status === "lese").length;
      g.owned = g.vols.filter((e) => e.mine.owned !== false && e.mine.status !== "wunschliste").length;
      g.total = Math.max(g.series.total_count ?? 0, g.vols.length);
      g.next = g.vols.find((e) => e.mine.status === "tbr" || e.mine.status === "ungelesen");
      out.push(g);
    }
    return out.sort((a, b) => a.series.name.localeCompare(b.series.name, "de"));
  }, [entries]);

  const list = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return groups.filter((g) => {
      if (nq && !`${g.series.name} ${g.authors}`.toLowerCase().includes(nq)) return false;
      const done = g.read >= g.total && g.total > 0;
      switch (filter) {
        case "dabei": return !done && (g.read > 0 || g.reading > 0);
        case "fertig": return done;
        case "offen": return g.read === 0 && g.reading === 0;
        case "unvollstaendig": return g.owned < g.total;
        default: return true;
      }
    });
  }, [groups, filter, q]);

  if (isLoading) return <p className="muted">Lade…</p>;
  const done = groups.filter((g) => g.total > 0 && g.read >= g.total).length;
  const dabei = groups.filter((g) => !(g.total > 0 && g.read >= g.total) && (g.read > 0 || g.reading > 0)).length;

  return (
    <>
      <div className="mast">
        <div>
          <h1>Meine <em>Reihen</em></h1>
          <p className="lede"><strong>{groups.length}</strong> Reihen, <strong>{done}</strong> davon durchgelesen, <strong>{dabei}</strong> gerade dabei.</p>
        </div>
      </div>
      <div className="toolbar">
        <div className="tabs" role="tablist">
          {([["alle", "Alle"], ["dabei", "Dabei"], ["fertig", "Durch"], ["offen", "Noch nicht begonnen"], ["unvollstaendig", "Lücken im Regal"]] as [Filter, string][]).map(([f, l]) => (
            <button key={f} className="tab" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>{l}</button>
          ))}
        </div>
        <div className="tools"><input className="input search" type="search" placeholder="Reihe oder Autor:in" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      {list.length === 0 ? <div className="grid"><Empty title="Keine Reihe gefunden" /></div> : (
        <div className="grid">
          {list.map((g) => {
            const isOpen = open === g.series.id;
            const complete = g.total > 0 && g.read >= g.total;
            return (
              <div key={g.series.id} className="panel series-card">
                <div className="series-head">
                  <div>
                    <h3>{g.series.name}</h3>
                    <p className="meta">{g.authors}{g.series.kind ? ` · ${g.series.kind}` : ""}{g.series.is_complete === false ? " · läuft noch" : ""}</p>
                  </div>
                  <span className={"pill " + (complete ? "st-gelesen" : g.reading ? "st-lese" : g.read ? "st-tbr" : "st-ungelesen")}>
                    {complete ? "Durch" : g.reading ? "Lese ich" : g.read ? `${g.read} von ${g.total}` : "Offen"}
                  </span>
                </div>
                <div className="dots" aria-label={`${g.read} von ${g.total} gelesen`}>
                  {Array.from({ length: Math.min(g.total, 60) }, (_, i) => {
                    const v = g.vols.find((e) => seriesNo(e.book.series_number) === i + 1);
                    const cls = !v ? "" : v.mine.status === "gelesen" ? "gelesen" : v.mine.status === "lese" ? "lese" : "owned";
                    return <span key={i} className={"dot " + cls} title={v ? v.book.title : `Band ${i + 1} fehlt`} />;
                  })}
                </div>
                <p className="meta">{g.owned} von {g.total} im Besitz{g.next ? <> · als Nächstes: <strong>{g.next.book.title}</strong></> : null}</p>
                <div className="actions">
                  <button className="btn small" onClick={() => setOpen(isOpen ? null : g.series.id)}>{isOpen ? "Zuklappen" : g.vols.length === 1 ? "1 Band zeigen" : `${g.vols.length} Bände zeigen`}</button>
                </div>
                {isOpen && (
                  <div>
                    {g.vols.map((e) => (
                      <div key={e.mine.id} className="vol-row">
                        <span className="n">{e.book.series_number ?? "–"}</span>
                        <Link to={`/buch/${e.mine.id}`}>{e.book.title}</Link>
                        <StatusPill status={e.mine.status} />
                      </div>
                    ))}
                    {g.total > g.vols.length && <div className="vol-row missing"><span className="n">…</span><span>{g.total - g.vols.length} Bände noch nicht eingetragen</span><span /></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
