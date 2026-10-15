import { readEvents } from "../lib/stats";
import { Link } from "../components/Link";
import { useEntries, useUser } from "../data/hooks";
import { BookCard, Empty, Shelf } from "../components/ui";
import { ReadingNowCard } from "../components/ReadingNow";
import { BookAura } from "../components/Aura";

export default function Start() {
  const { entries, lib, isLoading } = useEntries();
  const { data: user } = useUser();
  if (isLoading || !lib) return <p className="muted">Lade dein Regal…</p>;

  const year = new Date().getFullYear();
  const readThisYear = lib.readings.filter((r) => !r.abandoned && r.finished_on?.startsWith(String(year)));
  const goal = lib.goals.find((g) => g.year === year)?.books_goal ?? null;
  const by = (s: string) => entries.filter((e) => e.mine.status === s);
  const reading = by("lese");
  const recent = [...entries].sort((a, b) => (b.mine.created_at ?? "").localeCompare(a.mine.created_at ?? "")).slice(0, 3);
  // Jeder beendete Durchgang dieses Jahres steht einmal auf dem Brett, ein Reread also ein zweites Mal
  const finished = readEvents(entries)
    .filter((x) => x.year === year)
    .sort((a, b) => (a.r.finished_on ?? a.r.finished_text ?? "").localeCompare(b.r.finished_on ?? b.r.finished_text ?? ""))
    .map((x) => x.e);

  return (
    <>
      <BookAura book={(reading[0] ?? recent[0])?.book} />
      <div className="mast">
        <div>
          <h1>Hallo <em>{user?.display_name ?? "du"}.</em></h1>
          <p className="lede">
            <strong>{entries.length}</strong> Bücher im Regal, <strong>{by("gelesen").length}</strong> gelesen, <strong>{by("tbr").length}</strong> auf dem SuB.
          </p>
        </div>
        <div className="actions">
          <Link to="/bibliothek" className="btn">Bibliothek</Link>
        </div>
      </div>

      <section className="section">
        <div className="section-head"><h2>Am Lesen</h2>{reading.length > 0 && <span className="muted">{reading.length === 1 ? "1 Buch" : `${reading.length} Bücher`}</span>}</div>
        {reading.length ? (
          <div className="now-grid">{reading.map((e) => <ReadingNowCard key={e.mine.id} e={e} />)}</div>
        ) : (
          <div className="grid">
            <Empty title="Gerade kein Buch in der Hand" text="Such dir eins vom SuB aus und setz es auf „Am Lesen“.">
              <Link className="btn" to="/sub">Zum SuB</Link>
            </Empty>
          </div>
        )}
      </section>

      <Shelf entries={finished} note={finished.length ? <>Dein Lesejahr {year}: {finished.length} Bücher auf dem Regalbrett. <Link to={`/regal?v=jahre&jahr=${year}`}>Im Regal ansehen →</Link></> : `Das Regalbrett ${year} ist noch leer.`} />

      <div className="stats">
        <Link className="stat" to={`/regal?v=jahre&jahr=${year}`}>
          <span className="stat-label">Lesejahr {year}</span>
          <span className="stat-value">{readThisYear.length}{goal ? <small> / {goal}</small> : null}</span>
          {goal ? <div className="goalbar"><div style={{ width: `${Math.min(100, (readThisYear.length / goal) * 100)}%` }} /></div> : null}
        </Link>
        <Link className="stat" to="/bibliothek?status=lese"><span className="stat-label">Am Lesen</span><span className="stat-value">{reading.length}</span></Link>
        <Link className="stat" to="/bibliothek?status=gelesen"><span className="stat-label">Gelesen</span><span className="stat-value">{by("gelesen").length}</span></Link>
        <Link className="stat" to="/sub"><span className="stat-label">SuB</span><span className="stat-value">{by("tbr").length}</span></Link>
        <Link className="stat" to="/bibliothek?status=ungelesen"><span className="stat-label">Ungelesen</span><span className="stat-value">{by("ungelesen").length}</span></Link>
      </div>


      <section className="section">
        <div className="section-head"><h2>Zuletzt eingetragen</h2></div>
        <div className="grid">{recent.map((e) => <BookCard key={e.mine.id} e={e} />)}</div>
      </section>
    </>
  );
}
