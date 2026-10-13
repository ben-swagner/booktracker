import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useEntries } from "../data/hooks";
import type { Entry, ReadingStatus } from "../data/types";
import { STATUS, STATUS_ORDER, coverColors } from "../lib/labels";
import { countBy, lastFinished, readEvents } from "../lib/stats";
import { Link } from "../components/Link";
import { Empty, authorNames } from "../components/ui";

type Sort = "titel" | "autor" | "bewertung" | "seiten" | "neu" | "beendet" | "reihe";
type Color = "einband" | "status" | "bewertung";

const STATUS_COLOR: Record<ReadingStatus, string> = {
  lese: "var(--lese-bg)", gelesen: "var(--gelesen-bg)", tbr: "var(--tbr-bg)", ungelesen: "var(--ungelesen-bg)", abgebrochen: "var(--abg-bg)", wunschliste: "var(--wunsch-bg)"
};
const STATUS_INK: Record<ReadingStatus, string> = {
  lese: "var(--lese)", gelesen: "var(--gelesen)", tbr: "var(--tbr)", ungelesen: "var(--ungelesen)", abgebrochen: "var(--abg)", wunschliste: "var(--wunsch)"
};

function Spine({ e, color }: { e: Entry; color: Color }) {
  const pages = e.book.pages ?? 250;
  const w = Math.max(14, Math.min(44, Math.round(pages / 20)));
  const h = 78 + ((e.book.title.length * 7) % 44);
  let bg: string, fg: string;
  if (color === "status") { bg = STATUS_COLOR[e.mine.status]; fg = STATUS_INK[e.mine.status]; }
  else if (color === "bewertung") {
    const r = e.mine.rating;
    bg = r == null ? "var(--surface-2)" : r >= 4.5 ? "var(--green-light)" : r >= 3.5 ? "var(--blue-light)" : r >= 2.5 ? "var(--yellow-light)" : "var(--pink-light)";
    fg = "var(--ink)";
  } else { const c = coverColors(e.book.title); bg = c.bg; fg = c.fg; }
  return (
    <Link to={`/buch/${e.mine.id}`} className="spine" title={`${e.book.title} · ${authorNames(e)}`} style={{ width: w, height: h, background: bg, color: fg }}>
      <span>{e.book.title}</span>
    </Link>
  );
}

function ShelfRows({ entries, color }: { entries: Entry[]; color: Color }) {
  // Regalbretter mit je etwa 1.100px Breite, damit es auf dem Handy scrollt und am Computer umbricht
  const rows: Entry[][] = [];
  let cur: Entry[] = [], width = 0;
  for (const e of entries) {
    const w = Math.max(14, Math.min(44, Math.round((e.book.pages ?? 250) / 20))) + 4;
    if (width + w > 1080 && cur.length) { rows.push(cur); cur = []; width = 0; }
    cur.push(e); width += w;
  }
  if (cur.length) rows.push(cur);
  return (
    <div className="shelf-rows">
      {rows.map((row, i) => (
        <div key={i} className="shelf-row">
          <div className="shelf-scroll"><div className="shelf">{row.map((e) => <Spine key={e.mine.id} e={e} color={color} />)}</div></div>
          <div className="plank" />
        </div>
      ))}
    </div>
  );
}

export default function Regal() {
  const { entries, isLoading } = useEntries();
  const [params, setParams] = useSearchParams();
  const view = (params.get("v") ?? "gesamt") as "gesamt" | "jahre";
  const status = (params.get("status") ?? "alle") as ReadingStatus | "alle";
  const genre = params.get("genre") ?? "";
  const kind = params.get("art") ?? "";
  const q = params.get("q") ?? "";
  const sort = (params.get("sort") ?? "titel") as Sort;
  const [color, setColor] = useState<Color>("einband");
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v && v !== "alle") p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };

  const genres = useMemo(() => [...countBy(entries, (e) => e.book.genre).entries()].sort((a, b) => b[1] - a[1]), [entries]);
  const kinds = useMemo(() => [...countBy(entries, (e) => e.book.kind).entries()].sort((a, b) => b[1] - a[1]), [entries]);

  const list = useMemo(() => {
    const nq = q.trim().toLowerCase();
    let out = entries.filter((e) =>
      (status === "alle" || e.mine.status === status) && (!genre || e.book.genre === genre) && (!kind || e.book.kind === kind) &&
      (!nq || `${e.book.title} ${authorNames(e)} ${e.series?.name ?? ""}`.toLowerCase().includes(nq)));
    const cmp: Record<Sort, (a: Entry, b: Entry) => number> = {
      titel: (a, b) => a.book.title.localeCompare(b.book.title, "de"),
      autor: (a, b) => authorNames(a).localeCompare(authorNames(b), "de") || a.book.title.localeCompare(b.book.title, "de"),
      bewertung: (a, b) => (b.mine.rating ?? -1) - (a.mine.rating ?? -1),
      seiten: (a, b) => (b.book.pages ?? 0) - (a.book.pages ?? 0),
      neu: (a, b) => (b.mine.created_at ?? "").localeCompare(a.mine.created_at ?? ""),
      beendet: (a, b) => lastFinished(b).localeCompare(lastFinished(a)),
      reihe: (a, b) => (a.series?.name ?? "zzz").localeCompare(b.series?.name ?? "zzz", "de") || (Number(a.book.series_number) || 0) - (Number(b.book.series_number) || 0)
    };
    return [...out].sort(cmp[sort]);
  }, [entries, status, genre, kind, q, sort]);

  const years = useMemo(() => {
    const ev = readEvents(entries);
    const by = new Map<number, { e: Entry; date: string }[]>();
    for (const x of ev) {
      const list = by.get(x.year) ?? [];
      list.push({ e: x.e, date: x.r.finished_on ?? x.r.finished_text ?? "" });
      by.set(x.year, list);
    }
    return [...by.entries()].sort((a, b) => b[0] - a[0]).map(([y, l]) => ({ year: y, items: l.sort((a, b) => a.date.localeCompare(b.date)).map((x) => x.e) }));
  }, [entries]);

  if (isLoading) return <p className="muted">Lade…</p>;
  const pages = list.reduce((s, e) => s + (e.book.pages ?? 0), 0);

  return (
    <>
      <div className="mast">
        <div>
          <h1>Mein <em>Regal</em></h1>
          <p className="lede">{view === "gesamt" ? <><strong>{list.length}</strong> Bücher, <strong>{pages.toLocaleString("de-DE")}</strong> Seiten</> : <>Deine Lesejahre, Brett für Brett.</>}</p>
        </div>
        <div className="tabs" role="tablist">
          <button className="tab" role="tab" aria-selected={view === "gesamt"} onClick={() => set("v", "gesamt")}>Gesamt</button>
          <button className="tab" role="tab" aria-selected={view === "jahre"} onClick={() => set("v", "jahre")}>Nach Jahr</button>
        </div>
      </div>

      {view === "gesamt" ? (
        <>
          <div className="toolbar">
            <div className="tabs" role="tablist">
              <button className="tab" role="tab" aria-selected={status === "alle"} onClick={() => set("status", "alle")}>Alle</button>
              {STATUS_ORDER.map((s) => <button key={s} className="tab" role="tab" data-status={s} aria-selected={status === s} onClick={() => set("status", s)}>{STATUS[s]}</button>)}
            </div>
            <div className="tools">
              <input className="input search" type="search" placeholder="Titel, Autor:in, Reihe" value={q} onChange={(e) => set("q", e.target.value)} />
              <select className="input" value={genre} onChange={(e) => set("genre", e.target.value)} aria-label="Genre"><option value="">Alle Genres</option>{genres.map(([g, n]) => <option key={g} value={g}>{g} ({n})</option>)}</select>
              <select className="input" value={kind} onChange={(e) => set("art", e.target.value)} aria-label="Art"><option value="">Alle Arten</option>{kinds.map(([g, n]) => <option key={g} value={g}>{g} ({n})</option>)}</select>
              <select className="input" value={sort} onChange={(e) => set("sort", e.target.value)} aria-label="Sortierung">
                <option value="titel">Titel A-Z</option><option value="autor">Autor:in A-Z</option><option value="reihe">Nach Reihe</option><option value="bewertung">Beste Bewertung</option><option value="seiten">Dickste zuerst</option><option value="neu">Zuletzt eingetragen</option><option value="beendet">Zuletzt beendet</option>
              </select>
              <select className="input" value={color} onChange={(e) => setColor(e.target.value as Color)} aria-label="Farbe">
                <option value="einband">Farbe: Einband</option><option value="status">Farbe: Status</option><option value="bewertung">Farbe: Bewertung</option>
              </select>
            </div>
          </div>
          {list.length ? <div className="panel shelf-box"><ShelfRows entries={list} color={color} /></div> : <div className="grid"><Empty title="Leeres Brett" text="Zu diesen Filtern steht nichts im Regal." /></div>}
          {color === "status" && <p className="meta">Farben: {STATUS_ORDER.map((s) => <span key={s} className={"pill st-" + s} style={{ marginRight: 6 }}>{STATUS[s]}</span>)}</p>}
        </>
      ) : (
        years.length ? years.map((y) => {
          const pg = y.items.reduce((s, e) => s + (e.book.pages ?? 0), 0);
          return (
            <section key={y.year} className="panel shelf-box">
              <div className="section-head">
                <h2>{y.year}</h2>
                <span className="muted">{y.items.length} Bücher · {pg.toLocaleString("de-DE")} Seiten</span>
              </div>
              <ShelfRows entries={y.items} color="einband" />
            </section>
          );
        }) : <div className="grid"><Empty title="Noch kein Lesejahr" text="Sobald ein Buch ein Beendet-Datum hat, bekommt es hier sein Brett." /></div>
      )}
    </>
  );
}
