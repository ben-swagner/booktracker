import { useMemo, useState } from "react";
import type { Entry } from "../data/types";
import { BURN } from "../lib/labels";
import { countBy } from "../lib/stats";

/** Inhaltsfilter (Genre, Spice, Burn, Tropes, Triggerwarnungen), gespeichert in der Adresse. */
export type ContentFilter = { genre: string; spice: string[]; burn: string[]; tropes: string[]; ohne: string[] };

const SEP = "|";
const listParam = (p: URLSearchParams, k: string) => (p.get(k) ?? "").split(SEP).filter(Boolean);

export function readFilter(p: URLSearchParams): ContentFilter {
  return { genre: p.get("genre") ?? "", spice: listParam(p, "spice"), burn: listParam(p, "burn"), tropes: listParam(p, "trope"), ohne: listParam(p, "ohne") };
}

export function writeFilter(p: URLSearchParams, f: ContentFilter) {
  const put = (k: string, v: string) => (v ? p.set(k, v) : p.delete(k));
  put("genre", f.genre);
  put("spice", f.spice.join(SEP));
  put("burn", f.burn.join(SEP));
  put("trope", f.tropes.join(SEP));
  put("ohne", f.ohne.join(SEP));
}

export const activeCount = (f: ContentFilter) => (f.genre ? 1 : 0) + f.spice.length + f.burn.length + f.tropes.length + f.ohne.length;

/** Passt ein Buch zu den Filtern? Tropes müssen alle vorkommen, ausgeschlossene Warnungen keine. */
export function matches(e: Entry, f: ContentFilter) {
  if (f.genre && e.book.genre !== f.genre) return false;
  if (f.spice.length) {
    const s = e.mine.spice == null ? "?" : String(e.mine.spice);
    if (!f.spice.includes(s)) return false;
  }
  if (f.burn.length && !f.burn.includes(e.mine.burn ?? "?")) return false;
  if (f.tropes.length && !f.tropes.every((t) => e.book.tropes?.includes(t))) return false;
  if (f.ohne.length && e.book.trigger_warnings?.some((t) => f.ohne.includes(t))) return false;
  return true;
}

const SPICE_OPTS: [string, string][] = [["0", "🥛"], ["1", "🌶️"], ["2", "🌶️🌶️"], ["3", "🌶️🌶️🌶️"], ["4", "🌶️🌶️🌶️🌶️"], ["5", "🌶️🌶️🌶️🌶️🌶️"], ["?", "ohne Angabe"]];

/** Das aufklappbare Filterfeld. `pool` sind die Bücher, aus denen Auswahl und Zahlen kommen. */
export function ContentFilterPanel({ pool, value, onChange }: { pool: Entry[]; value: ContentFilter; onChange: (f: ContentFilter) => void }) {
  const [tq, setTq] = useState("");
  const [allTropes, setAllTropes] = useState(false);
  const genres = useMemo(() => [...countBy(pool, (e) => e.book.genre).entries()].sort((a, b) => b[1] - a[1]), [pool]);
  const tropes = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of pool) for (const t of e.book.tropes ?? []) c.set(t, (c.get(t) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"));
  }, [pool]);
  const warnings = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of pool) for (const t of e.book.trigger_warnings ?? []) c.set(t, (c.get(t) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => a[0].localeCompare(b[0], "de"));
  }, [pool]);
  const spiceCount = useMemo(() => countBy(pool, (e) => (e.mine.spice == null ? "?" : String(e.mine.spice))), [pool]);
  const burnCount = useMemo(() => countBy(pool, (e) => e.mine.burn ?? "?"), [pool]);

  const toggle = (k: "spice" | "burn" | "tropes" | "ohne", v: string) =>
    onChange({ ...value, [k]: value[k].includes(v) ? value[k].filter((x) => x !== v) : [...value[k], v] });

  const shownTropes = tropes.filter(([t]) => !tq || t.toLowerCase().includes(tq.toLowerCase()) || value.tropes.includes(t));
  const visibleTropes = allTropes || tq ? shownTropes : shownTropes.slice(0, 24);

  return (
    <div className="panel filter-panel">
      <div className="filter-row">
        <span className="filter-label">Genre</span>
        <select className="input" value={value.genre} onChange={(e) => onChange({ ...value, genre: e.target.value })} aria-label="Genre">
          <option value="">Alle Genres</option>
          {genres.map(([g, n]) => <option key={g} value={g}>{g} ({n})</option>)}
        </select>
      </div>
      <div className="filter-row">
        <span className="filter-label">Spice</span>
        <div className="toggle-chips">
          {SPICE_OPTS.map(([v, l]) => (
            <button key={v} type="button" className="tchip" aria-pressed={value.spice.includes(v)} onClick={() => toggle("spice", v)}>
              {l}<span className="n">{spiceCount.get(v) ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="filter-row">
        <span className="filter-label">Burn</span>
        <div className="toggle-chips">
          {(Object.keys(BURN) as (keyof typeof BURN)[]).map((k) => (
            <button key={k} type="button" className="tchip" aria-pressed={value.burn.includes(k)} onClick={() => toggle("burn", k)}>
              {BURN[k]}<span className="n">{burnCount.get(k) ?? 0}</span>
            </button>
          ))}
          <button type="button" className="tchip" aria-pressed={value.burn.includes("?")} onClick={() => toggle("burn", "?")}>ohne Angabe<span className="n">{burnCount.get("?") ?? 0}</span></button>
        </div>
      </div>
      <div className="filter-row top">
        <span className="filter-label">Tropes</span>
        <div className="filter-col">
          <input className="input small-input" type="search" placeholder="Trope suchen…" value={tq} onChange={(e) => setTq(e.target.value)} />
          <div className="toggle-chips">
            {visibleTropes.map(([t, n]) => (
              <button key={t} type="button" className="tchip" aria-pressed={value.tropes.includes(t)} onClick={() => toggle("tropes", t)}>{t}<span className="n">{n}</span></button>
            ))}
            {!tq && shownTropes.length > 24 && (
              <button type="button" className="btn small ghost" onClick={() => setAllTropes(!allTropes)}>{allTropes ? "Weniger zeigen" : `Alle ${shownTropes.length} zeigen`}</button>
            )}
          </div>
          {value.tropes.length > 1 && <p className="meta" style={{ margin: 0 }}>Es werden nur Bücher gezeigt, die alle gewählten Tropes haben.</p>}
        </div>
      </div>
      {warnings.length > 0 && (
        <div className="filter-row top">
          <span className="filter-label">Ohne</span>
          <div className="filter-col">
            <div className="toggle-chips">
              {warnings.map(([t, n]) => (
                <button key={t} type="button" className="tchip warn" aria-pressed={value.ohne.includes(t)} onClick={() => toggle("ohne", t)}>{t}<span className="n">{n}</span></button>
              ))}
            </div>
            <p className="meta" style={{ margin: 0 }}>Gewählte Triggerwarnungen werden ausgeblendet.</p>
          </div>
        </div>
      )}
      {activeCount(value) > 0 && (
        <div className="actions">
          <button type="button" className="btn small" onClick={() => onChange({ genre: "", spice: [], burn: [], tropes: [], ohne: [] })}>Alle Filter zurücksetzen</button>
        </div>
      )}
    </div>
  );
}
