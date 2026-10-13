import { Link } from "../components/Link";
import { useEntries, useUser } from "../data/hooks";
import { BookCard, Empty, Shelf } from "../components/ui";

export default function Start() {
  const { entries, lib, isLoading } = useEntries();
  const { data: user } = useUser();
  if (isLoading || !lib) return <p className="muted">Lade dein Regal…</p>;

  const year = new Date().getFullYear();
  const readThisYear = lib.readings.filter((r) => !r.abandoned && r.finished_on?.startsWith(String(year)));
  const goal = lib.goals.find((g) => g.year === year)?.books_goal ?? null;
  const by = (s: string) => entries.filter((e) => e.mine.status === s);
  const reading = by("lese");
  const recent = [...entries].sort((a, b) => (b.mine.created_at ?? "").localeCompare(a.mine.created_at ?? "")).slice(0, 6);
  const finished = entries
    .filter((e) => e.readings.some((r) => r.finished_on?.startsWith(String(year))))
    .sort((a, b) => {
      const fa = a.readings.map((r) => r.finished_on ?? "").sort().pop() ?? "";
      const fb = b.readings.map((r) => r.finished_on ?? "").sort().pop() ?? "";
      return fa.localeCompare(fb);
    });

  return (
    <>
      <div className="mast">
        <div>
          <h1>Hallo <em>{user?.display_name ?? "du"}</em></h1>
          <p className="lede">
            <strong>{entries.length}</strong> Bücher im Regal, <strong>{by("gelesen").length}</strong> gelesen, <strong>{by("tbr").length}</strong> auf dem SuB.
          </p>
        </div>
        <div className="actions">
          <Link to="/neu" className="btn primary">+ Buch eintragen</Link>
          <Link to="/bibliothek" className="btn">Bibliothek</Link>
        </div>
      </div>

      <Shelf entries={finished} note={finished.length ? `Dein Lesejahr ${year}: ${finished.length} Bücher auf dem Regalbrett.` : `Das Regalbrett ${year} ist noch leer.`} />

      <div className="stats">
        <Link className="stat" to="/statistik">
          <span className="stat-label">Lesejahr {year}</span>
          <span className="stat-value">{readThisYear.length}{goal ? <small> / {goal}</small> : null}</span>
          {goal ? <div className="goalbar"><div style={{ width: `${Math.min(100, (readThisYear.length / goal) * 100)}%` }} /></div> : null}
        </Link>
        <Link className="stat" to="/bibliothek?status=lese"><span className="stat-label">Lese ich</span><span className="stat-value">{reading.length}</span></Link>
        <Link className="stat" to="/bibliothek?status=gelesen"><span className="stat-label">Gelesen</span><span className="stat-value">{by("gelesen").length}</span></Link>
        <Link className="stat" to="/sub"><span className="stat-label">SuB</span><span className="stat-value">{by("tbr").length}</span></Link>
        <Link className="stat" to="/bibliothek?status=ungelesen"><span className="stat-label">Ungelesen</span><span className="stat-value">{by("ungelesen").length}</span></Link>
      </div>

      <section className="section">
        <div className="section-head"><h2>Gerade dabei</h2></div>
        <div className="grid">
          {reading.length ? reading.map((e) => <BookCard key={e.mine.id} e={e} />) : (
            <Empty title="Gerade kein Buch in der Hand" text="Such dir eins vom SuB aus und setz es auf „Lese ich“.">
              <Link className="btn" to="/bibliothek?status=tbr">Zum SuB</Link>
            </Empty>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Zuletzt eingetragen</h2></div>
        <div className="grid">{recent.map((e) => <BookCard key={e.mine.id} e={e} />)}</div>
      </section>
    </>
  );
}
