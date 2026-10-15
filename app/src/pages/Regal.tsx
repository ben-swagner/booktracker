import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useEntries } from "../data/hooks";
import type { Entry, ReadingStatus } from "../data/types";
import { GENRE_LEGEND, STATUS, STATUS_ORDER, familySwatch, genreColors } from "../lib/labels";
import { countBy, lastFinished, readEvents } from "../lib/stats";
import { CoverShelfRows, Empty, ShelfRows, authorNames } from "../components/ui";
import { Icon } from "../components/Icon";

type Sort = "titel" | "autor" | "bewertung" | "seiten" | "neu" | "beendet" | "reihe";
type Color = "genre" | "status" | "bewertung";

const STATUS_COLOR: Record<ReadingStatus, string> = {
  lese: "var(--lese-bg)", gelesen: "var(--gelesen-bg)", tbr: "var(--tbr-bg)", ungelesen: "var(--ungelesen-bg)", abgebrochen: "var(--abg-bg)", wunschliste: "var(--wunsch-bg)"
};
const STATUS_INK: Record<ReadingStatus, string> = {
  lese: "var(--lese)", gelesen: "var(--gelesen)", tbr: "var(--tbr)", ungelesen: "var(--ungelesen)", abgebrochen: "var(--abg)", wunschliste: "var(--wunsch)"
};

function colorFor(color: Color) {
  return (e: Entry) => {
    if (color === "status") return { bg: STATUS_COLOR[e.mine.status], fg: STATUS_INK[e.mine.status] };
    if (color === "bewertung") {
      const r = e.mine.rating;
      return { bg: r == null ? "var(--surface-2)" : r >= 4.5 ? "var(--green-light)" : r >= 3.5 ? "var(--blue-light)" : r >= 2.5 ? "var(--yellow-light)" : "var(--pink-light)", fg: "var(--ink)" };
    }
    return genreColors(e.book.genre, e.book.title);
  };
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
  const jahr = params.get("jahr") ?? "";
  const [color, setColor] = useState<Color>("genre");
  // Darstellung: Buchrücken oder Cover. Die Wahl merkt sich das Gerät.
  const [look, setLookState] = useState<"ruecken" | "cover">(() => { try { return localStorage.getItem("bt-regal-look") === "cover" ? "cover" : "ruecken"; } catch { return "ruecken"; } });
  const setLook = (v: "ruecken" | "cover") => { setLookState(v); try { localStorage.setItem("bt-regal-look", v); } catch { /* egal */ } };
  const rows = (items: Entry[], colors?: (e: Entry) => { bg: string; fg: string }) =>
    look === "cover" ? <CoverShelfRows entries={items} /> : <ShelfRows entries={items} colorFor={colors} />;
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v && v !== "alle") p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };

  const genres = useMemo(() => [...countBy(entries, (e) => e.book.genre).entries()].sort((a, b) => b[1] - a[1]), [entries]);
  const kinds = useMemo(() => [...countBy(entries, (e) => e.book.kind).entries()].sort((a, b) => b[1] - a[1]), [entries]);

  // Dieselben Filter gelten für das ganze Regal und für die Lesejahre
  const keep = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return (e: Entry) =>
      (status === "alle" || e.mine.status === status) && (!genre || e.book.genre === genre) && (!kind || e.book.kind === kind) &&
      (!nq || `${e.book.title} ${authorNames(e)} ${e.series?.name ?? ""}`.toLowerCase().includes(nq));
  }, [status, genre, kind, q]);
  const sortSet = params.has("sort");

  const cmp = useMemo(() => {
    const c: Record<Sort, (a: Entry, b: Entry) => number> = {
      titel: (a, b) => a.book.title.localeCompare(b.book.title, "de"),
      autor: (a, b) => authorNames(a).localeCompare(authorNames(b), "de") || a.book.title.localeCompare(b.book.title, "de"),
      bewertung: (a, b) => (b.mine.rating ?? -1) - (a.mine.rating ?? -1),
      seiten: (a, b) => (b.book.pages ?? 0) - (a.book.pages ?? 0),
      neu: (a, b) => (b.mine.created_at ?? "").localeCompare(a.mine.created_at ?? ""),
      beendet: (a, b) => lastFinished(b).localeCompare(lastFinished(a)),
      reihe: (a, b) => (a.series?.name ?? "zzz").localeCompare(b.series?.name ?? "zzz", "de") || (Number(a.book.series_number) || 0) - (Number(b.book.series_number) || 0)
    };
    return c[sort];
  }, [sort]);

  const list = useMemo(() => entries.filter(keep).sort(cmp), [entries, keep, cmp]);

  const years = useMemo(() => {
    const ev = readEvents(entries);
    const by = new Map<number, { e: Entry; date: string }[]>();
    for (const x of ev) {
      const list = by.get(x.year) ?? [];
      list.push({ e: x.e, date: x.r.finished_on ?? x.r.finished_text ?? "" });
      by.set(x.year, list);
    }
    return [...by.entries()].sort((a, b) => b[0] - a[0]).map(([y, l]) => {
      const items = l.filter((x) => keep(x.e)).sort((a, b) => a.date.localeCompare(b.date)).map((x) => x.e);
      // ohne eigene Sortierung bleibt die Reihenfolge, in der die Bücher beendet wurden
      return { year: y, items: sortSet ? [...items].sort(cmp) : items };
    });
  }, [entries, keep, cmp, sortSet]);

  const [openF, setOpenF] = useState(false);
  const [allGenres, setAllGenres] = useState(false);
  const nActive = (view === "jahre" ? 1 : 0) + (genre ? 1 : 0) + (kind ? 1 : 0);
  const setRegal = (v: string) => { const p = new URLSearchParams(params); p.delete("jahr"); if (v === "gesamt") p.delete("v"); else { p.set("v", "jahre"); if (v !== "jahre") p.set("jahr", v); } setParams(p, { replace: true }); };
  const resetAll = () => { const p = new URLSearchParams(params); ["v", "jahr", "genre", "art"].forEach((k) => p.delete(k)); setParams(p, { replace: true }); };
  const shown = view === "gesamt" ? list.length : (jahr ? years.filter((y) => String(y.year) === jahr) : years).reduce((n, y) => n + y.items.length, 0);

  if (isLoading) return <p className="muted">Lade…</p>;
  const pages = list.reduce((s, e) => s + (e.book.pages ?? 0), 0);

  return (
    <>
      <div className="mast">
        <div>
          <h1>Mein <em>Regal</em></h1>
          <p className="lede">{view === "gesamt" ? <><strong>{list.length}</strong> Bücher, <strong>{pages.toLocaleString("de-DE")}</strong> Seiten</> : jahr ? <>Dein Lesejahr {jahr}, Brett für Brett.</> : <>Deine Lesejahre, Brett für Brett.</>}</p>
        </div>
        <div className="regal-switches">
        <div className="view-switch" role="group" aria-label="Darstellung">
          <button type="button" aria-pressed={look === "ruecken"} onClick={() => setLook("ruecken")} title="Buchrücken"><Icon name="books" size={20} /></button>
          <button type="button" aria-pressed={look === "cover"} onClick={() => setLook("cover")} title="Cover"><Icon name="cover" size={20} /></button>
        </div>
        </div>
      </div>

      <div className="rf">
        <div className="rf-row">
          <div className="tabs" role="tablist">
            <button className="tab" role="tab" aria-selected={status === "alle"} onClick={() => set("status", "alle")}>Alle</button>
            {STATUS_ORDER.map((s) => <button key={s} className="tab" role="tab" data-status={s} aria-selected={status === s} onClick={() => set("status", s)}>{STATUS[s]}</button>)}
          </div>
          <label className="rf-search"><Icon name="search" size={18} /><input type="search" placeholder="Titel, Autor:in, Reihe" aria-label="Suchen" value={q} onChange={(e) => set("q", e.target.value)} /></label>
          <select className="input rf-sort" value={view === "jahre" && !sortSet ? "" : sort} onChange={(e) => set("sort", e.target.value)} aria-label="Sortierung">
            {view === "jahre" && <option value="">Wie beendet</option>}<option value="titel">Titel A-Z</option><option value="autor">Autor:in A-Z</option><option value="reihe">Nach Reihe</option><option value="bewertung">Beste Bewertung</option><option value="seiten">Dickste zuerst</option><option value="neu">Zuletzt eingetragen</option><option value="beendet">Zuletzt beendet</option>
          </select>
          <div className="rf-pop-wrap">
            <button type="button" className="btn primary rf-btn" aria-expanded={openF} onClick={() => setOpenF(!openF)}><Icon name="filter" size={16} /> Filter{nActive > 0 && <span className="rf-count">{nActive}</span>}</button>
            {openF && (
              <>
                <div className="rf-veil" onClick={() => setOpenF(false)} />
                <div className="rf-pop" role="dialog" aria-label="Filter">
                  <div className="rf-group"><span className="rf-label">Regal</span>
                    <div className="rf-chips">
                      <button type="button" className={"rf-chip" + (view === "gesamt" ? " on" : "")} onClick={() => setRegal("gesamt")}>Ganzes Regal</button>
                      <button type="button" className={"rf-chip" + (view === "jahre" && !jahr ? " on" : "")} onClick={() => setRegal("jahre")}>Nach Lesejahr</button>
                      {years.map((y) => <button key={y.year} type="button" className={"rf-chip" + (jahr === String(y.year) ? " on" : "")} onClick={() => setRegal(String(y.year))}>{y.year}</button>)}
                    </div>
                  </div>
                  <div className="rf-group"><span className="rf-label">Genre</span>
                    <div className="rf-chips">
                      {(allGenres ? genres : genres.slice(0, 8)).map(([g, n]) => <button key={g} type="button" className={"rf-chip" + (genre === g ? " on" : "")} style={genre === g ? undefined : { background: genreColors(g, g).bg, color: genreColors(g, g).fg }} onClick={() => set("genre", genre === g ? "" : g)}>{g} <small>{n}</small></button>)}
                      {genres.length > 8 && <button type="button" className="rf-chip more" onClick={() => setAllGenres(!allGenres)}>{allGenres ? "weniger" : `alle ${genres.length} …`}</button>}
                    </div>
                  </div>
                  <div className="rf-split">
                    <div className="rf-group"><span className="rf-label">Art</span>
                      <div className="rf-chips">
                        {kinds.map(([g, n]) => <button key={g} type="button" className={"rf-chip" + (kind === g ? " on" : "")} onClick={() => set("art", kind === g ? "" : g)}>{g} <small>{n}</small></button>)}
                      </div>
                    </div>
                    {look === "ruecken" && (
                      <div className="rf-group"><span className="rf-label">Farbe der Rücken</span>
                        <div className="rf-chips">
                          {([["genre", "Genre"], ["status", "Status"], ["bewertung", "Bewertung"]] as [Color, string][]).map(([c, l]) => <button key={c} type="button" className={"rf-chip" + (color === c ? " on" : "")} onClick={() => setColor(c)}>{l}</button>)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="rf-foot">
                    <button type="button" className="rf-reset" onClick={resetAll} disabled={!nActive}>Alles zurücksetzen</button>
                    <button type="button" className="btn primary" onClick={() => setOpenF(false)}>{shown} Bücher zeigen</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        {nActive > 0 && (
          <div className="rf-active">
            {view === "jahre" && <span className="rf-tag">{jahr ? `Lesejahr ${jahr}` : "Nach Lesejahr"}<button type="button" aria-label="Lesejahr entfernen" onClick={() => setRegal("gesamt")}>×</button></span>}
            {genre && <span className="rf-tag">{genre}<button type="button" aria-label="Genre entfernen" onClick={() => set("genre", "")}>×</button></span>}
            {kind && <span className="rf-tag">{kind}<button type="button" aria-label="Art entfernen" onClick={() => set("art", "")}>×</button></span>}
          </div>
        )}
      </div>
      {view === "gesamt" ? (
        <>
          {list.length ? <div className="panel shelf-box">{rows(list, colorFor(color))}</div> : <div className="grid"><Empty title="Leeres Brett" text="Zu diesen Filtern steht nichts im Regal." /></div>}
          {look === "ruecken" && color === "genre" && <p className="meta legend">{GENRE_LEGEND.map(([label, g]) => <span key={label} className="legend-item"><i style={{ background: familySwatch(g) }} />{label}</span>)}</p>}
          {look === "ruecken" && color === "status" && <p className="meta">Farben: {STATUS_ORDER.map((s) => <span key={s} className={"pill st-" + s} style={{ marginRight: 6 }}>{STATUS[s]}</span>)}</p>}
        </>
      ) : (
        years.length ? <>
        {(jahr ? years.filter((y) => String(y.year) === jahr) : years).map((y) => {
          const pg = y.items.reduce((s, e) => s + (e.book.pages ?? 0), 0);
          return (
            <section key={y.year} className="panel shelf-box">
              <div className="section-head">
                <h2>{y.year}</h2>
                <span className="muted">{y.items.length} Bücher · {pg.toLocaleString("de-DE")} Seiten</span>
              </div>
              {y.items.length ? rows(y.items, colorFor(color)) : <p className="muted" style={{ margin: 0 }}>Keine Bücher zu diesen Filtern.</p>}
            </section>
          );
        })}
        {jahr && !years.some((y) => String(y.year) === jahr) && <div className="grid"><Empty title={`${jahr} ist noch leer`} text="Sobald du in diesem Jahr ein Buch beendest, steht es hier." /></div>}
        </> : <div className="grid"><Empty title="Noch kein Lesejahr" text="Sobald ein Buch ein Beendet-Datum hat, bekommt es hier sein Brett." /></div>
      )}
    </>
  );
}
