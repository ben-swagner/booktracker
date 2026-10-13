import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useEntries } from "../data/hooks";
import type { Author, Entry } from "../data/types";
import { Link } from "../components/Link";
import { BookCard, Empty, Stars } from "../components/ui";

type Row = { author: Author; books: Entry[]; read: number; avg: number | null };
type Sort = "anzahl" | "name" | "gelesen" | "bewertung";
const GENDER: Record<string, string> = { weiblich: "weiblich", maennlich: "männlich", divers: "divers", mehrere: "mehrere", unbekannt: "" };

export default function Autorinnen() {
  const { entries, isLoading } = useEntries();
  const { slug } = useParams();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("anzahl");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("");

  const rows = useMemo(() => {
    const by = new Map<string, Row>();
    for (const e of entries) for (const a of e.authors) {
      let r = by.get(a.id);
      if (!r) { r = { author: a, books: [], read: 0, avg: null }; by.set(a.id, r); }
      r.books.push(e);
    }
    for (const r of by.values()) {
      r.read = r.books.filter((e) => e.mine.status === "gelesen").length;
      const rated = r.books.filter((e) => e.mine.rating != null);
      r.avg = rated.length ? rated.reduce((s, e) => s + (e.mine.rating ?? 0), 0) / rated.length : null;
      r.books.sort((a, b) => (a.series?.name ?? "zzz").localeCompare(b.series?.name ?? "zzz", "de") || (Number(a.book.series_number) || 0) - (Number(b.book.series_number) || 0) || a.book.title.localeCompare(b.book.title, "de"));
    }
    return [...by.values()];
  }, [entries]);

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

  if (slug) {
    const r = rows.find((x) => x.author.slug === slug);
    if (!r) return <Empty title="Autor:in nicht gefunden" />;
    return (
      <>
        <div className="actions"><Link className="btn ghost" to="/autorinnen">← Alle Autor:innen</Link></div>
        <div className="mast">
          <div>
            <h1>{r.author.name}</h1>
            <p className="lede">{[r.author.country, GENDER[r.author.gender ?? ""] || null].filter(Boolean).join(" · ")}{r.author.country || r.author.gender !== "unbekannt" ? " · " : ""}<strong>{r.books.length}</strong> Bücher, <strong>{r.read}</strong> gelesen{r.avg != null ? <> · Ø <Stars value={r.avg} /> {r.avg.toFixed(1)}</> : null}</p>
          </div>
        </div>
        <div className="grid">{r.books.map((e) => <BookCard key={e.mine.id} e={e} />)}</div>
      </>
    );
  }

  return (
    <>
      <div className="mast">
        <div>
          <h1>Autor:<em>innen</em></h1>
          <p className="lede"><strong>{rows.length}</strong> Autor:innen in deinem Regal.</p>
        </div>
      </div>
      <div className="toolbar">
        <div className="tools" style={{ justifyContent: "flex-start" }}>
          <input className="input search" type="search" placeholder="Name" value={q} onChange={(e) => setQ(e.target.value)} />
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
      <div className="panel">
        {list.length === 0 ? <Empty title="Niemand gefunden" /> : list.slice(0, 300).map((r) => (
          <Link key={r.author.id} to={`/autorinnen/${r.author.slug}`} className="author-row">
            <div>
              <strong>{r.author.name}</strong>
              <p className="meta">{[r.author.country, GENDER[r.author.gender ?? ""] || null].filter(Boolean).join(" · ")}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="mono">{r.books.length} {r.books.length === 1 ? "Buch" : "Bücher"} · {r.read} gelesen</div>
              {r.avg != null && <div className="meta"><Stars value={r.avg} /> {r.avg.toFixed(1)}</div>}
            </div>
          </Link>
        ))}
        {list.length > 300 && <p className="meta" style={{ paddingTop: 10 }}>Die Liste zeigt die ersten 300, nutze die Suche für den Rest.</p>}
      </div>
    </>
  );
}
