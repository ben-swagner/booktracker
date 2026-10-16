import { useMemo, useState } from "react";
import { useEntries, useSaveFavorites } from "../data/hooks";
import type { Entry, Favorite } from "../data/types";
import { Link } from "../components/Link";
import { Cover, Empty, Stars, authorNames } from "../components/ui";
import { AuthorPhoto } from "../components/Authors";
import { Icon } from "../components/Icon";
import { useOpenBook } from "../components/openBook";
import { toast } from "../App";

type Kind = Favorite["kind"];
const KINDS: { kind: Kind; label: string; hint: string }[] = [
  { kind: "book", label: "Bücher", hint: "Deine liebsten Romane und Sachbücher" },
  { kind: "graphic", label: "Graphics", hint: "Manga, Manhwa, Comics, Graphic Novels" },
  { kind: "author", label: "Autor:innen", hint: "Wen du immer wieder liest" },
  { kind: "series", label: "Reihen", hint: "Reihen, die bleiben" }
];

export default function Tops() {
  const { entries, lib, isLoading } = useEntries();
  const save = useSaveFavorites();
  const [kind, setKind] = useState<Kind>("book");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Favorite>[]>([]);
  const [q, setQ] = useState("");

  const byBook = useMemo(() => new Map(entries.map((e) => [e.book.id, e])), [entries]);
  const authors = useMemo(() => new Map(lib?.authors.map((a) => [a.id, a]) ?? []), [lib]);
  const series = useMemo(() => new Map(lib?.series.map((s) => [s.id, s]) ?? []), [lib]);

  const current = useMemo(() => (lib?.favorites ?? []).filter((f) => f.kind === kind).sort((a, b) => a.rank - b.rank), [lib, kind]);
  const list = editing ? draft : current;

  const label = (f: Partial<Favorite>) => {
    if (f.book_id) return byBook.get(f.book_id)?.book.title ?? "(Buch fehlt)";
    if (f.author_id) return authors.get(f.author_id)?.name ?? "(Autor:in fehlt)";
    if (f.series_id) return series.get(f.series_id)?.name ?? "(Reihe fehlt)";
    return "";
  };

  const hits = useMemo((): { id: string; label: string; sub?: string }[] => {
    const nq = q.trim().toLowerCase();
    if (nq.length < 2) return [];
    if (kind === "author") return [...authors.values()].filter((a) => a.name.toLowerCase().includes(nq)).slice(0, 8).map((a) => ({ id: a.id, label: a.name }));
    if (kind === "series") return [...series.values()].filter((s) => s.name.toLowerCase().includes(nq)).slice(0, 8).map((s) => ({ id: s.id, label: s.name }));
    const graphic = (e: Entry) => /Manga|Manhwa|Comic|Graphic/.test(e.book.kind ?? "");
    const books = entries.filter((e) => (kind === "graphic" ? graphic(e) : !graphic(e)) && e.book.title.toLowerCase().includes(nq)).slice(0, 8).map((e) => ({ id: e.book.id, label: e.book.title, sub: authorNames(e) }));
    if (kind !== "graphic") return books;
    // Bei Graphics geht auch eine ganze Reihe
    const gSeries = new Map<string, number>();
    for (const e of entries) if (e.series && graphic(e) && e.series.name.toLowerCase().includes(nq)) gSeries.set(e.series.id, (gSeries.get(e.series.id) ?? 0) + 1);
    const ser = [...gSeries.entries()].slice(0, 6).map(([id, n]) => ({ id: "s:" + id, label: series.get(id)?.name ?? "", sub: `ganze Reihe · ${n} Bände` }));
    return [...ser, ...books];
  }, [q, kind, entries, authors, series]);

  // Vorschläge aus deinen Daten: Bewertung zuerst, dann wie oft gelesen, dann Menge
  const openBook = useOpenBook();
  const graphic = (e: Entry) => /Manga|Manhwa|Comic|Graphic/.test(e.book.kind ?? "");
  const timesRead = (e: Entry) => e.readings.filter((r) => r.finished_on || r.finished_text).length || (e.mine.status === "gelesen" ? 1 : 0);
  const picks = useMemo((): { id: string; why: string; rating: number | null; e?: Entry; author?: NonNullable<ReturnType<typeof authors.get>>; covers?: Entry[] }[] => {
    const avg = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
    if (kind === "book" || kind === "graphic") {
      return entries.filter((e) => (kind === "graphic" ? graphic(e) : !graphic(e)) && e.mine.rating != null)
        .sort((a, b) => b.mine.rating! - a.mine.rating! || timesRead(b) - timesRead(a) || (b.mine.verdict === "love" ? 1 : 0) - (a.mine.verdict === "love" ? 1 : 0) || (b.book.pages ?? 0) - (a.book.pages ?? 0))
        .slice(0, 8).map((e) => ({ id: e.book.id, e, rating: e.mine.rating!, why: timesRead(e) > 1 ? `${timesRead(e)}× gelesen` : e.mine.verdict === "love" ? "Love" : "" }));
    }
    if (kind === "author") {
      const by = new Map<string, Entry[]>();
      for (const e of entries) for (const a of e.authors) { const l = by.get(a.id) ?? []; l.push(e); by.set(a.id, l); }
      return [...by.entries()].map(([id, l]) => {
        const rated = l.filter((e) => e.mine.rating != null); const read = l.filter((e) => e.mine.status === "gelesen").length;
        const a = avg(rated.map((e) => e.mine.rating!));
        return { id, l, read, a, score: (a ?? 0) * Math.log2(read + 1) };
      }).filter((x) => x.read >= 2 && x.a != null).sort((x, y) => y.score - x.score).slice(0, 8)
        .map((x) => ({ id: x.id, author: authors.get(x.id), rating: x.a, why: `${x.read} gelesen`, covers: x.l.slice(0, 4) }));
    }
    const by = new Map<string, Entry[]>();
    for (const e of entries) if (e.series) { const l = by.get(e.series.id) ?? []; l.push(e); by.set(e.series.id, l); }
    return [...by.entries()].map(([id, l]) => {
      const rated = l.filter((e) => e.mine.rating != null); const read = l.filter((e) => e.mine.status === "gelesen").length;
      const a = avg(rated.map((e) => e.mine.rating!));
      return { id, l, read, a, score: (a ?? 0) * Math.log2(read + 1) };
    }).filter((x) => x.read >= 2 && x.a != null).sort((x, y) => y.score - x.score).slice(0, 8)
      .map((x) => ({ id: x.id, rating: x.a, why: `${x.read} Bände gelesen`, covers: [...x.l].sort((p, q) => (Number(p.book.series_number) || 0) - (Number(q.book.series_number) || 0)).slice(0, 4) }));
  }, [kind, entries, authors]);
  const isFav = (id: string) => current.some((f) => f.book_id === id || f.author_id === id || f.series_id === id);
  async function addDirect(id: string) {
    const item: Partial<Favorite> = kind === "author" ? { author_id: id } : kind === "series" ? { series_id: id } : { book_id: id };
    await save.mutateAsync({ kind, items: [...current.map((f) => ({ book_id: f.book_id, author_id: f.author_id, series_id: f.series_id })), item] });
    toast("Zu deinen Favoriten hinzugefügt.");
  }

  function startEdit() { setDraft(current.map((f) => ({ book_id: f.book_id, author_id: f.author_id, series_id: f.series_id }))); setEditing(true); }
  function add(id: string) {
    const item: Partial<Favorite> = id.startsWith("s:") ? { series_id: id.slice(2) } : kind === "author" ? { author_id: id } : kind === "series" ? { series_id: id } : { book_id: id };
    if (draft.some((d) => d.book_id === item.book_id && d.author_id === item.author_id && d.series_id === item.series_id)) return;
    setDraft([...draft, item]); setQ("");
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= draft.length) return;
    const d = [...draft]; [d[i], d[j]] = [d[j], d[i]]; setDraft(d);
  }
  async function commit() {
    await save.mutateAsync({ kind, items: draft });
    setEditing(false); toast("Tops gespeichert.");
  }

  if (isLoading || !lib) return <p className="muted">Lade…</p>;

  return (
    <>
      <div className="mast">
        <div>
          <h1>Meine <em>Tops</em></h1>
          <p className="lede">{KINDS.find((k) => k.kind === kind)?.hint}</p>
        </div>
        <div className="actions">
          {editing ? (<><button className="btn" onClick={() => setEditing(false)}>Abbrechen</button><button className="btn primary" onClick={commit}>Speichern</button></>) : (<button className="btn primary" onClick={startEdit}>Bearbeiten</button>)}
        </div>
      </div>
      <div className="tabs" role="tablist" style={{ alignSelf: "flex-start" }}>
        {KINDS.map((k) => <button key={k.kind} className="tab" role="tab" aria-selected={kind === k.kind} onClick={() => { setKind(k.kind); setEditing(false); }}>{k.label}</button>)}
      </div>

      {editing && (
        <div className="panel section">
          <div className="field">
            <label htmlFor="topq">Hinzufügen</label>
            <input id="topq" className="input" placeholder={kind === "author" ? "Name tippen…" : kind === "series" ? "Reihe tippen…" : kind === "graphic" ? "Titel oder Reihe tippen…" : "Titel tippen…"} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {hits.length > 0 && <div className="chips">{hits.map((h) => <button type="button" key={h.id} className="chip" onClick={() => add(h.id)}>{h.label}{h.sub ? ` · ${h.sub}` : ""}</button>)}</div>}
        </div>
      )}

      <h2 className="tops-h"><Icon name="heart" size={20} /> Meine Favoriten <span className="muted">selbst ausgewählt</span></h2>
      {list.length === 0 ? (
        <div className="grid"><Empty title="Noch keine Favoriten" text="Tipp auf „Bearbeiten“ oder übernimm unten einen Vorschlag mit +." /></div>
      ) : (
        <div className="panel">
          {list.map((f, i) => {
            const e = f.book_id ? byBook.get(f.book_id) : undefined;
            return (
              <div key={(f as Favorite).id ?? `${i}-${label(f)}`} className="top-row">
                <span className="top-rank mono">{i + 1}</span>
                {e ? <Cover title={e.book.title} author={authorNames(e)} url={e.book.cover_url} isbn={e.book.isbn13} bookId={e.book.id} genre={e.book.genre} />
                  : f.author_id && authors.get(f.author_id) ? <AuthorPhoto author={authors.get(f.author_id)!} size={64} />
                  : f.series_id ? <SeriesStack entries={entries.filter((x) => x.series?.id === f.series_id)} /> : <span className="top-dot" />}
                <div style={{ minWidth: 0 }}>
                  {e ? <Link to={`/buch/${e.mine.id}`} className="book-title" style={{ display: "block" }}>{e.book.title}</Link>
                    : f.author_id ? <Link to={`/autorinnen?autor=${authors.get(f.author_id!)?.slug ?? ""}`} className="book-title" style={{ display: "block" }}>{label(f)}</Link>
                    : <strong className="book-title">{label(f)}</strong>}
                  {e && <p className="book-author">{authorNames(e)}{e.series ? ` · ${e.series.name}` : ""}</p>}
                  {f.series_id && <p className="book-author">{kind === "graphic" ? "Ganze Reihe · " : ""}{entries.filter((x) => x.series?.id === f.series_id).length} Bände</p>}
                </div>
                {editing ? (
                  <div className="actions" style={{ flexWrap: "nowrap" }}>
                    <button className="btn small" onClick={() => move(i, -1)} aria-label="nach oben">↑</button>
                    <button className="btn small" onClick={() => move(i, 1)} aria-label="nach unten">↓</button>
                    <button className="btn ghost small" onClick={() => setDraft(draft.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ) : <span />}
              </div>
            );
          })}
        </div>
      )}

      {picks.length > 0 && (
        <>
          <h2 className="tops-h"><Icon name="sparkle" size={20} /> Laut deinen Bewertungen <span className="muted">{kind === "book" || kind === "graphic" ? "beste Sterne, dann wie oft gelesen" : "Durchschnitt der Sterne und wie viel du gelesen hast"}</span></h2>
          <div className="tops-picks">
            {picks.map((p, i) => (
              <div key={p.id} className="tops-pick">
                <span className="top-rank mono">{i + 1}</span>
                <button type="button" className="tops-pick-main" onClick={() => p.e && openBook(p.e.mine.id)} disabled={!p.e}>
                  {p.e ? <Cover title={p.e.book.title} url={p.e.book.cover_url} isbn={p.e.book.isbn13} bookId={p.e.book.id} genre={p.e.book.genre} />
                    : p.author ? <AuthorPhoto author={p.author} size={64} />
                    : <SeriesStack entries={p.covers ?? []} />}
                  <span className="tops-pick-text">
                    <strong>{p.e ? p.e.book.title : p.author ? p.author.name : series.get(p.id)?.name}</strong>
                    <span className="meta">{p.rating != null && <><Stars value={p.rating} /> {p.rating.toFixed(1).replace(".", ",")}</>}{p.why ? ` · ${p.why}` : ""}</span>
                  </span>
                </button>
                {isFav(p.id) ? <span className="tops-in" title="Schon in deinen Favoriten"><Icon name="check" size={16} /></span>
                  : <button type="button" className="btn small" onClick={() => addDirect(p.id)} title="Zu meinen Favoriten">+ Favorit</button>}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** Kleine Cover-Auffächerung für eine Reihe. */
function SeriesStack({ entries }: { entries: Entry[] }) {
  const l = [...entries].sort((a, b) => (Number(a.book.series_number) || 0) - (Number(b.book.series_number) || 0)).slice(0, 3);
  if (!l.length) return <span className="top-dot" />;
  return <span className="series-stack">{l.map((e) => <Cover key={e.mine.id} title={e.book.title} url={e.book.cover_url} isbn={e.book.isbn13} bookId={e.book.id} genre={e.book.genre} />)}</span>;
}
