import { useMemo, useState } from "react";
import { useEntries, useSaveFavorites } from "../data/hooks";
import type { Entry, Favorite } from "../data/types";
import { Link } from "../components/Link";
import { Cover, Empty, authorNames } from "../components/ui";
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
    return entries.filter((e) => (kind === "graphic" ? graphic(e) : !graphic(e)) && e.book.title.toLowerCase().includes(nq)).slice(0, 8).map((e) => ({ id: e.book.id, label: e.book.title, sub: authorNames(e) }));
  }, [q, kind, entries, authors, series]);

  function startEdit() { setDraft(current.map((f) => ({ book_id: f.book_id, author_id: f.author_id, series_id: f.series_id }))); setEditing(true); }
  function add(id: string) {
    const item: Partial<Favorite> = kind === "author" ? { author_id: id } : kind === "series" ? { series_id: id } : { book_id: id };
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
            <input id="topq" className="input" placeholder={kind === "author" ? "Name tippen…" : kind === "series" ? "Reihe tippen…" : "Titel tippen…"} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {hits.length > 0 && <div className="chips">{hits.map((h) => <button type="button" key={h.id} className="chip" onClick={() => add(h.id)}>{h.label}{h.sub ? ` · ${h.sub}` : ""}</button>)}</div>}
        </div>
      )}

      {list.length === 0 ? (
        <div className="grid"><Empty title="Noch keine Tops" text="Klick auf Bearbeiten und such dir deine Favoriten zusammen." /></div>
      ) : (
        <div className="panel">
          {list.map((f, i) => {
            const e = f.book_id ? byBook.get(f.book_id) : undefined;
            return (
              <div key={(f as Favorite).id ?? `${i}-${label(f)}`} className="top-row">
                <span className="top-rank mono">{i + 1}</span>
                {e ? <Cover title={e.book.title} author={authorNames(e)} url={e.book.cover_url} isbn={e.book.isbn13} bookId={e.book.id} genre={e.book.genre} /> : <span className="top-dot" />}
                <div style={{ minWidth: 0 }}>
                  {e ? <Link to={`/buch/${e.mine.id}`} className="book-title" style={{ display: "block" }}>{e.book.title}</Link>
                    : f.author_id ? <Link to={`/autorinnen?autor=${authors.get(f.author_id!)?.slug ?? ""}`} className="book-title" style={{ display: "block" }}>{label(f)}</Link>
                    : <strong className="book-title">{label(f)}</strong>}
                  {e && <p className="book-author">{authorNames(e)}{e.series ? ` · ${e.series.name}` : ""}</p>}
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
    </>
  );
}
