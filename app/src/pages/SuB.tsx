import { useMemo, useState } from "react";
import { useEntries, useSaveReading, useSaveUserBook } from "../data/hooks";
import type { Entry } from "../data/types";
import { today } from "../lib/labels";
import { countBy, shuffle } from "../lib/stats";
import { BookCard, Cover, Empty, authorNames } from "../components/ui";
import { Link } from "../components/Link";
import { toast } from "../App";

type Len = "alle" | "kurz" | "mittel" | "lang";
const LEN: Record<Len, [number, number]> = { alle: [0, 99999], kurz: [0, 250], mittel: [251, 450], lang: [451, 99999] };

/** SuB = Stapel ungelesener Bücher. Hier sucht der Zufall das nächste Buch aus. */
export default function SuB() {
  const { entries, isLoading } = useEntries();
  const saveUB = useSaveUserBook();
  const saveReading = useSaveReading();
  const [pool, setPool] = useState<"tbr" | "beide">("tbr");
  const [genre, setGenre] = useState("");
  const [kind, setKind] = useState("");
  const [len, setLen] = useState<Len>("alle");
  const [series, setSeries] = useState<"alle" | "einzel" | "reihe">("alle");
  const [pick, setPick] = useState<Entry | null>(null);
  const [spinning, setSpinning] = useState<Entry | null>(null);

  const candidates = useMemo(() => {
    const [lo, hi] = LEN[len];
    return entries.filter((e) => {
      if (pool === "tbr" ? e.mine.status !== "tbr" : !(e.mine.status === "tbr" || e.mine.status === "ungelesen")) return false;
      if (genre && e.book.genre !== genre) return false;
      if (kind && e.book.kind !== kind) return false;
      const p = e.book.pages ?? 300;
      if (p < lo || p > hi) return false;
      if (series === "einzel" && e.series) return false;
      if (series === "reihe" && !e.series) return false;
      return true;
    });
  }, [entries, pool, genre, kind, len, series]);

  const genres = useMemo(() => [...countBy(entries.filter((e) => e.mine.status === "tbr" || e.mine.status === "ungelesen"), (e) => e.book.genre).entries()].sort((a, b) => b[1] - a[1]), [entries]);
  const kinds = useMemo(() => [...countBy(entries.filter((e) => e.mine.status === "tbr" || e.mine.status === "ungelesen"), (e) => e.book.kind).entries()].sort((a, b) => b[1] - a[1]), [entries]);
  const tbr = entries.filter((e) => e.mine.status === "tbr");
  const tbrPages = tbr.reduce((s, e) => s + (e.book.pages ?? 0), 0);

  function run() {
    if (!candidates.length) return;
    setPick(null);
    const order = shuffle(candidates).slice(0, 14);
    let i = 0;
    const tick = () => {
      setSpinning(order[i % order.length]);
      i++;
      if (i < 16) setTimeout(tick, 70 + i * 12);
      else {
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        setSpinning(null);
        setPick(chosen);
      }
    };
    tick();
  }

  async function startReading(e: Entry) {
    await saveUB.mutateAsync({ id: e.mine.id, book_id: e.book.id, status: "lese" });
    await saveReading.mutateAsync({ user_book_id: e.mine.id, read_number: e.readings.length + 1, started_on: today() });
    toast(`Viel Spaß mit „${e.book.title}“!`);
  }

  if (isLoading) return <p className="muted">Lade…</p>;

  const shown = spinning ?? pick;

  return (
    <>
      <div className="mast">
        <div>
          <h1>Dein <em>SuB</em></h1>
          <p className="lede"><strong>{tbr.length}</strong> Bücher warten auf dich, zusammen <strong>{tbrPages.toLocaleString("de-DE")}</strong> Seiten.</p>
        </div>
        <div className="actions"><Link className="btn" to="/bibliothek?status=tbr">Alle anzeigen</Link></div>
      </div>

      <div className="panel section">
        <div className="section-head">
          <h2>Was lese ich als Nächstes?</h2>
          <span className="muted">{candidates.length} Bücher passen</span>
        </div>
        <div className="form-grid">
          <div className="field"><label htmlFor="pool">Aus</label>
            <select id="pool" className="input" value={pool} onChange={(e) => setPool(e.target.value as any)}>
              <option value="tbr">Nur SuB</option>
              <option value="beide">SuB und Ungelesen</option>
            </select></div>
          <div className="field"><label htmlFor="genre">Genre</label>
            <select id="genre" className="input" value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">Egal</option>
              {genres.map(([g, n]) => <option key={g} value={g}>{g} ({n})</option>)}
            </select></div>
          <div className="field"><label htmlFor="kind">Art</label>
            <select id="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Egal</option>
              {kinds.map(([g, n]) => <option key={g} value={g}>{g} ({n})</option>)}
            </select></div>
          <div className="field"><label htmlFor="len">Länge</label>
            <select id="len" className="input" value={len} onChange={(e) => setLen(e.target.value as Len)}>
              <option value="alle">Egal</option>
              <option value="kurz">Kurz (bis 250 Seiten)</option>
              <option value="mittel">Mittel (250 bis 450)</option>
              <option value="lang">Lang (über 450)</option>
            </select></div>
          <div className="field"><label htmlFor="ser">Reihe</label>
            <select id="ser" className="input" value={series} onChange={(e) => setSeries(e.target.value as any)}>
              <option value="alle">Egal</option>
              <option value="einzel">Nur Einzelbände</option>
              <option value="reihe">Nur Reihen</option>
            </select></div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={run} disabled={!candidates.length || !!spinning}>{pick ? "Noch einmal würfeln" : "Würfeln"}</button>
        </div>

        {shown && (
          <div className={"pick" + (spinning ? " spinning" : "")}>
            <Cover title={shown.book.title} author={authorNames(shown)} url={shown.book.cover_url} isbn={shown.book.isbn13} bookId={shown.book.id} large />
            <div className="section">
              <p className="muted" style={{ margin: 0 }}>{spinning ? "Der Zufall sucht…" : "Der Zufall sagt:"}</p>
              <h2 style={{ fontSize: 26 }}>{shown.book.title}</h2>
              <p className="book-author" style={{ fontSize: 16 }}>{authorNames(shown)}</p>
              <p className="meta">{[shown.book.kind, shown.book.genre, shown.book.subgenres?.[0], shown.book.pages ? `${shown.book.pages} Seiten` : null, shown.series ? `${shown.series.name} #${shown.book.series_number ?? "?"}` : null].filter(Boolean).join(" · ")}</p>
              {!spinning && shown.book.blurb && <p style={{ margin: 0 }}>{shown.book.blurb.length > 320 ? shown.book.blurb.slice(0, 320) + "…" : shown.book.blurb}</p>}
              {!spinning && (
                <div className="actions">
                  <button className="btn primary" onClick={() => startReading(shown)}>Lese ich jetzt</button>
                  <Link className="btn" to={`/buch/${shown.mine.id}`}>Details</Link>
                  <button className="btn ghost" onClick={run}>Lieber ein anderes</button>
                </div>
              )}
            </div>
          </div>
        )}
        {!candidates.length && <Empty title="Nichts passt zu den Filtern" text="Lockere einen Filter, dann hat der Zufall wieder Auswahl." />}
      </div>

      <section className="section">
        <div className="section-head"><h2>Zuletzt auf den SuB gelegt</h2></div>
        <div className="grid">
          {[...tbr].sort((a, b) => (b.mine.updated_at ?? "").localeCompare(a.mine.updated_at ?? "")).slice(0, 6).map((e) => <BookCard key={e.mine.id} e={e} />)}
        </div>
      </section>
    </>
  );
}
