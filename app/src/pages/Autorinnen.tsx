import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useEntries } from "../data/hooks";
import { Empty, Stars } from "../components/ui";
import { AuthorCard, AuthorPhoto, GENDER, GENDER_COLOR, authorRows, useOpenAuthor, type AuthorRow } from "../components/Authors";
import { Icon } from "../components/Icon";

type Row = AuthorRow;
type Sort = "anzahl" | "name" | "gelesen" | "bewertung";
type Look = "liste" | "raster";

export default function Autorinnen() {
  const { entries, isLoading } = useEntries();
  const { slug } = useParams();
  const openAuthor = useOpenAuthor();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("anzahl");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("");
  const [limit, setLimit] = useState(60);
  // Darstellung: Liste oder Raster. Die Wahl merkt sich das Gerät.
  const [look, setLookState] = useState<Look>(() => { try { return localStorage.getItem("bt-autor-look") === "raster" ? "raster" : "liste"; } catch { return "liste"; } });
  const setLook = (v: Look) => { setLookState(v); try { localStorage.setItem("bt-autor-look", v); } catch { /* egal */ } };

  const rows = useMemo(() => authorRows(entries), [entries]);
  const countries = useMemo(() => [...new Set(rows.map((r) => r.author.country).filter(Boolean))].sort() as string[], [rows]);

  const list = useMemo(() => {
    const nq = q.trim().toLowerCase();
    const out = rows.filter((r) => (!nq || r.author.name.toLowerCase().includes(nq)) && (!gender || r.author.gender === gender) && (!country || r.author.country === country));
    const cmp: Record<Sort, (a: Row, b: Row) => number> = {
      anzahl: (a, b) => b.books.length - a.books.length || a.author.name.localeCompare(b.author.name, "de"),
      name: (a, b) => (a.author.sort_name ?? a.author.name.split(" ").pop() ?? "").localeCompare(b.author.sort_name ?? b.author.name.split(" ").pop() ?? "", "de"),
      gelesen: (a, b) => b.read - a.read || b.books.length - a.books.length,
      bewertung: (a, b) => (b.avg ?? -1) - (a.avg ?? -1)
    };
    return out.sort(cmp[sort]);
  }, [rows, q, sort, gender, country]);

  if (isLoading) return <p className="muted">Lade…</p>;

  // Alte Adressen /autorinnen/<name> öffnen jetzt das Fenster auf der Übersicht
  if (slug) return <Navigate to={`/autorinnen?autor=${encodeURIComponent(slug)}`} replace />;

  return (
    <>
      <div className="mast">
        <div>
          <h1>Autor:<em>innen</em></h1>
          <p className="lede"><strong>{rows.length}</strong> Autor:innen in deinem Regal.</p>
        </div>
      </div>
      <div className="toolbar">
        <div className="tools tools-authors" style={{ justifyContent: "flex-start" }}>
          <input className="input search" type="search" placeholder="Name" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="view-switch" role="group" aria-label="Darstellung">
            <button type="button" aria-pressed={look === "liste"} onClick={() => setLook("liste")} title="Liste"><Icon name="list" size={20} /></button>
            <button type="button" aria-pressed={look === "raster"} onClick={() => setLook("raster")} title="Raster mit Bildern"><Icon name="grid" size={20} /></button>
          </div>
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sortierung">
            <option value="anzahl">Meiste Bücher</option><option value="gelesen">Meiste gelesen</option><option value="bewertung">Beste Bewertung</option><option value="name">Nachname A-Z</option>
          </select>
          <select className="input" value={gender} onChange={(e) => setGender(e.target.value)} aria-label="Geschlecht">
            <option value="">Alle</option><option value="weiblich">Weiblich</option><option value="maennlich">Männlich</option><option value="divers">Divers</option><option value="mehrere">Duos und Teams</option>
          </select>
          <select className="input" value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Land">
            <option value="">Alle Länder</option>{countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <p className="meta legend">{Object.entries(GENDER_COLOR).map(([k, c]) => {
        const n = rows.filter((r) => (r.author.gender ?? "unbekannt") === k).length;
        return n ? <span key={k} className="legend-item"><i style={{ background: c.band }} />{c.label} ({n})</span> : null;
      })}</p>
      {list.length === 0 ? <div className="panel"><Empty title="Niemand gefunden" /></div> : look === "raster" ? (
        <div className="agrid">
          {list.slice(0, limit).map((r) => <AuthorCard key={r.author.id} r={r} onOpen={() => openAuthor(r.author.slug)} />)}
        </div>
      ) : (
        <div className="panel">
          {list.slice(0, limit).map((r) => (
            <button type="button" key={r.author.id} onClick={() => openAuthor(r.author.slug)} className="author-row">
              <AuthorPhoto author={r.author} size={40} />
              <div>
                <strong>{r.author.name}</strong>
                <p className="meta">{[r.author.country, GENDER[r.author.gender ?? ""] || null].filter(Boolean).join(" · ")}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono">{r.books.length} {r.books.length === 1 ? "Buch" : "Bücher"} · {r.read} gelesen</div>
                {r.avg != null && <div className="meta"><Stars value={r.avg} /> {r.avg.toFixed(1)}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
      {list.length > limit && <div className="actions" style={{ justifyContent: "center" }}><button className="btn" onClick={() => setLimit((n) => n + 60)}>Weitere anzeigen ({list.length - limit} übrig)</button></div>}
    </>
  );
}
