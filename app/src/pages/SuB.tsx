import { useEffect, useMemo, useRef, useState } from "react";
import { useEntries, useSaveReading, useSaveUserBook } from "../data/hooks";
import type { Entry } from "../data/types";
import { today } from "../lib/labels";
import { countBy, seriesNo, shuffle } from "../lib/stats";
import { BookCard, Cover, Empty, authorNames } from "../components/ui";
import { Link } from "../components/Link";
import { toast } from "../App";
import { SubTower } from "../components/SubTower";

type Len = "alle" | "kurz" | "mittel" | "lang";
const LEN: Record<Len, [number, number]> = { alle: [0, 99999], kurz: [0, 250], mittel: [251, 450], lang: [451, 99999] };

/** Gilt ein Buch als gelesen (Status oder ein beendeter Durchgang)? */
const isRead = (e: Entry) => e.mine.status === "gelesen" || e.readings.some((r) => !r.abandoned && (r.finished_on || r.finished_text));

/**
 * Reihen in Reihenfolge: Ein Band kommt nur in Frage, wenn alle früheren ganzen Bände der Reihe,
 * die im Regal stehen, schon gelesen sind. Zwischenbände (z. B. 1.5) halten niemanden auf.
 */
function blockedBy(e: Entry, entries: Entry[]): Entry | null {
  if (!e.series) return null;
  const n = seriesNo(e.book.series_number);
  if (n === 999) return null;
  const earlier = entries
    .filter((x) => x.series?.id === e.series!.id && x.mine.id !== e.mine.id && x.mine.status !== "wunschliste")
    .filter((x) => { const k = seriesNo(x.book.series_number); return Number.isInteger(k) && k < n && !isRead(x); })
    .sort((a, b) => seriesNo(a.book.series_number) - seriesNo(b.book.series_number));
  return earlier[0] ?? null;
}

const DICE = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" /><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" /><circle cx="12" cy="12" r="1.1" fill="currentColor" /><circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" /><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" /></svg>;
const SPARK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z" /></svg>;

/** SuB = Stapel ungelesener Bücher. Hier sucht der Zufall das nächste Buch aus. */
export default function SuB() {
  const { entries, isLoading } = useEntries();
  const saveUB = useSaveUserBook();
  const saveReading = useSaveReading();
  const [withUnread, setWithUnread] = useState(false);
  const [inOrder, setInOrder] = useState(true);
  const [genre, setGenre] = useState("");
  const [kind, setKind] = useState("");
  const [len, setLen] = useState<Len>("alle");
  const [series, setSeries] = useState<"alle" | "einzel" | "reihe">("alle");
  const [pick, setPick] = useState<Entry | null>(null);
  const [deck, setDeck] = useState<Entry[]>([]);
  const [spinning, setSpinning] = useState(false);

  const { candidates, held } = useMemo(() => {
    const [lo, hi] = LEN[len];
    let held = 0;
    const candidates = entries.filter((e) => {
      if (!(e.mine.status === "tbr" || (withUnread && e.mine.status === "ungelesen"))) return false;
      if (genre && e.book.genre !== genre) return false;
      if (kind && e.book.kind !== kind) return false;
      const p = e.book.pages ?? 300;
      if (p < lo || p > hi) return false;
      if (series === "einzel" && e.series) return false;
      if (series === "reihe" && !e.series) return false;
      if (inOrder && blockedBy(e, entries)) { held++; return false; }
      return true;
    });
    return { candidates, held };
  }, [entries, withUnread, inOrder, genre, kind, len, series]);

  const pool = entries.filter((e) => e.mine.status === "tbr" || e.mine.status === "ungelesen");
  const genres = useMemo(() => [...countBy(pool, (e) => e.book.genre).entries()].sort((a, b) => b[1] - a[1]), [entries]); // eslint-disable-line react-hooks/exhaustive-deps
  const kinds = useMemo(() => [...countBy(pool, (e) => e.book.kind).entries()].sort((a, b) => b[1] - a[1]), [entries]); // eslint-disable-line react-hooks/exhaustive-deps
  const tbr = entries.filter((e) => e.mine.status === "tbr");
  const tbrPages = tbr.reduce((s, e) => s + (e.book.pages ?? 0), 0);

  function run() {
    if (!candidates.length || spinning) return;
    setPick(null);
    setSpinning(true);
    const order = shuffle(candidates);
    let i = 0;
    const tick = () => {
      setDeck([order[i % order.length], order[(i + 1) % order.length], order[(i + 2) % order.length]]);
      i++;
      if (i < 16) setTimeout(tick, 70 + i * 12);
      else {
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        const others = shuffle(candidates.filter((x) => x !== chosen));
        setDeck([others[0] ?? chosen, chosen, others[1] ?? chosen]);
        setPick(chosen);
        setSpinning(false);
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

  const card = (e: Entry | undefined, i: number) => (
    <div key={i} className={"deck-card" + (i === 1 ? " mid" : "") + (e ? " filled" : "")}>
      {e && <Cover title={e.book.title} author={authorNames(e)} url={e.book.cover_url} isbn={e.book.isbn13} bookId={e.book.id} genre={e.book.genre} large />}
    </div>
  );
  const seriesInfo = (e: Entry) => {
    if (!e.series) return null;
    const n = e.book.series_number;
    const read = entries.filter((x) => x.series?.id === e.series!.id && isRead(x)).length;
    return `${e.series.name}${n ? `, Band ${n}` : ""}${e.series.total_count ? ` von ${e.series.total_count}` : ""}${read ? ` · ${read} davon gelesen` : ""}`;
  };

  return (
    <>
      <div className="mast">
        <div>
          <h1>Dein <em>SuB</em></h1>
          <p className="lede"><strong>{tbr.length}</strong> Bücher warten auf dich, zusammen <strong>{tbrPages.toLocaleString("de-DE")}</strong> Seiten.</p>
        </div>
      </div>

      <section className="picker">
        <div className="picker-main">
          <div className="picker-head">
            <span className="picker-icon">{DICE}</span>
            <h2>Was lese ich als Nächstes?</h2>
          </div>
          <p className="picker-sub">Lass den Zufall entscheiden. Mit den Filtern grenzt du die Auswahl vorher ein.</p>
          <div className="picker-filters">
            <select className="input" value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Genre">
              <option value="">Jedes Genre</option>
              {genres.map(([g, n]) => <option key={g} value={g}>{g} ({n})</option>)}
            </select>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Art">
              <option value="">Jede Art</option>
              {kinds.map(([g, n]) => <option key={g} value={g}>{g} ({n})</option>)}
            </select>
            <select className="input" value={len} onChange={(e) => setLen(e.target.value as Len)} aria-label="Länge">
              <option value="alle">Jede Länge</option>
              <option value="kurz">Kurz (bis 250 S.)</option>
              <option value="mittel">Mittel (250 bis 450 S.)</option>
              <option value="lang">Lang (über 450 S.)</option>
            </select>
            <select className="input" value={series} onChange={(e) => setSeries(e.target.value as any)} aria-label="Reihe">
              <option value="alle">Jede Reihe</option>
              <option value="einzel">Nur Einzelbände</option>
              <option value="reihe">Nur Reihen</option>
            </select>
          </div>
          <div className="picker-checks">
            <label className="check"><input type="checkbox" checked={withUnread} onChange={(e) => setWithUnread(e.target.checked)} /> Ungelesene einbeziehen</label>
            <label className="check" title="Aus einer Reihe kommt nur der nächste Band, den du noch nicht gelesen hast."><input type="checkbox" checked={inOrder} onChange={(e) => setInOrder(e.target.checked)} /> Reihen in Reihenfolge</label>
          </div>
          <div className="picker-go">
            <button className="btn primary picker-btn" onClick={run} disabled={!candidates.length || spinning}>{SPARK} {pick ? "Nochmal würfeln" : "Überrasch mich"}</button>
            <span className="muted">
              {candidates.length ? `${candidates.length} Bücher im Lostopf` : "Nichts passt zu den Filtern"}
              {inOrder && held ? ` · ${held} spätere Reihenbände warten` : ""}
            </span>
          </div>
        </div>
        <div className={"deck" + (spinning ? " spinning" : "") + (pick ? " picked" : "")} aria-hidden="true">
          {[0, 1, 2].map((i) => card(deck[i], i))}
        </div>
      </section>

      {pick && !spinning && (
        <section className="panel pick-result">
          <p className="pick-kicker">Der Zufall sagt:</p>
          <h2>{pick.book.title}</h2>
          <p className="book-author" style={{ fontSize: 16, margin: 0 }}>{authorNames(pick)}</p>
          <div className="chips">
            {[pick.book.genre, pick.book.subgenres?.[0], pick.book.kind, pick.book.pages ? `${pick.book.pages} Seiten` : null].filter(Boolean).map((x) => <span key={x!} className="chip">{x}</span>)}
          </div>
          {seriesInfo(pick) && <p className="meta" style={{ margin: 0 }}>{seriesInfo(pick)}</p>}
          {pick.book.blurb && <p className="prose" style={{ margin: 0 }}>{pick.book.blurb.length > 360 ? pick.book.blurb.slice(0, 360) + "…" : pick.book.blurb}</p>}
          <div className="actions">
            <button className="btn primary" onClick={() => startReading(pick)}>Jetzt lesen</button>
            <Link className="btn" to={`/buch/${pick.mine.id}`}>Details</Link>
            <button className="btn ghost" onClick={run}>Lieber ein anderes</button>
          </div>
        </section>
      )}
      {!candidates.length && <div className="grid"><Empty title="Nichts passt zu den Filtern" text="Lockere einen Filter, dann hat der Zufall wieder Auswahl." /></div>}

      <SubTower books={tbr} />

      <AllTbr tbr={tbr} />
    </>
  );
}

type TbrSort = "neu" | "titel" | "autor" | "kurz" | "lang" | "reihe";
const STEP = 48;

/** Alle Bücher auf dem SuB: Suche, Sortierung, und beim Runterscrollen werden weitere nachgeladen. */
function AllTbr({ tbr }: { tbr: Entry[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<TbrSort>("neu");
  const [limit, setLimit] = useState(STEP);
  const end = useRef<HTMLDivElement>(null);

  const list = useMemo(() => {
    const nq = q.trim().toLowerCase();
    const out = tbr.filter((e) => !nq || `${e.book.title} ${authorNames(e)} ${e.series?.name ?? ""} ${e.book.genre ?? ""}`.toLowerCase().includes(nq));
    const cmp: Record<TbrSort, (a: Entry, b: Entry) => number> = {
      neu: (a, b) => (b.mine.created_at ?? "").localeCompare(a.mine.created_at ?? ""),
      titel: (a, b) => a.book.title.localeCompare(b.book.title, "de"),
      autor: (a, b) => authorNames(a).localeCompare(authorNames(b), "de") || a.book.title.localeCompare(b.book.title, "de"),
      kurz: (a, b) => (a.book.pages ?? 9999) - (b.book.pages ?? 9999),
      lang: (a, b) => (b.book.pages ?? 0) - (a.book.pages ?? 0),
      reihe: (a, b) => (a.series?.name ?? "zzz").localeCompare(b.series?.name ?? "zzz", "de") || seriesNo(a.book.series_number) - seriesNo(b.book.series_number)
    };
    return [...out].sort(cmp[sort]);
  }, [tbr, q, sort]);

  useEffect(() => setLimit(STEP), [q, sort]);
  // Weitere Bücher laden, sobald das Ende der Liste ins Bild kommt
  useEffect(() => {
    const el = end.current;
    if (!el || limit >= list.length) return;
    const io = new IntersectionObserver((xs) => { if (xs.some((x) => x.isIntersecting)) setLimit((l) => l + STEP); }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, list.length]);

  return (
    <section className="section">
      <div className="section-head">
        <h2>Alle Bücher auf deinem SuB</h2>
        <span className="muted">{q ? `${list.length} von ${tbr.length}` : `${tbr.length} Bücher`}</span>
      </div>
      <div className="tools">
        <input className="input search" type="search" placeholder="Titel, Autor:in, Reihe, Genre…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as TbrSort)} aria-label="Sortierung">
          <option value="neu">Zuletzt dazugelegt</option>
          <option value="titel">Titel A-Z</option>
          <option value="autor">Autor:in A-Z</option>
          <option value="reihe">Nach Reihe</option>
          <option value="kurz">Kürzeste zuerst</option>
          <option value="lang">Längste zuerst</option>
        </select>
      </div>
      {list.length ? (
        <div className="grid">{list.slice(0, limit).map((e) => <BookCard key={e.mine.id} e={e} />)}</div>
      ) : (
        <div className="grid"><Empty title={tbr.length ? "Nichts gefunden" : "Dein SuB ist leer"} text={tbr.length ? "Probier einen anderen Suchbegriff." : "Lege Bücher mit dem Status SuB an, dann erscheinen sie hier."} /></div>
      )}
      <div ref={end} />
    </section>
  );
}
