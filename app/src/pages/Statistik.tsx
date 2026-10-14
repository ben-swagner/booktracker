import { useMemo, useState } from "react";
import { useEntries, useSaveGoal } from "../data/hooks";
import type { Entry } from "../data/types";
import { VERDICT } from "../lib/labels";
import { toast } from "../App";
import { Link } from "../components/Link";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function Bars({ data, max }: { data: [string, number][]; max?: number }) {
  const top = max ?? Math.max(1, ...data.map((d) => d[1]));
  return (
    <div className="bars">
      {data.map(([label, n]) => (
        <div className="bar" key={label}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          <div className="track"><div style={{ width: `${(n / top) * 100}%` }} /></div>
          <span className="mono muted">{n}</span>
        </div>
      ))}
    </div>
  );
}

function top(counts: Map<string, number>, n = 8): [string, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export default function Statistik() {
  const { entries, lib, isLoading } = useEntries();
  const saveGoal = useSaveGoal();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState<string>(String(thisYear));
  const [goalDraft, setGoalDraft] = useState<string>("");

  const years = useMemo(() => {
    const ys = new Set<string>();
    for (const e of entries) for (const r of e.readings) {
      const y = (r.finished_on ?? r.finished_text ?? "").slice(0, 4);
      if (/^\d{4}$/.test(y)) ys.add(y);
    }
    return [...ys].sort().reverse();
  }, [entries]);

  const stats = useMemo(() => {
    // Ein "Leseereignis" = ein abgeschlossener Lesevorgang (Erstlesung oder Reread)
    const events: { e: Entry; date: string; month: number | null }[] = [];
    for (const e of entries) for (const r of e.readings) {
      if (r.abandoned) continue;
      const d = r.finished_on ?? (r.finished_text && /^\d{4}$/.test(r.finished_text) ? r.finished_text : null);
      if (!d) continue;
      if (year !== "alle" && !d.startsWith(year)) continue;
      events.push({ e, date: d, month: d.length >= 7 ? Number(d.slice(5, 7)) - 1 : null });
    }
    const books = new Set(events.map((x) => x.e.mine.id));
    const pages = events.reduce((s, x) => s + (x.e.book.pages ?? 0), 0);
    const months = Array.from({ length: 12 }, () => 0);
    for (const x of events) if (x.month != null) months[x.month]++;
    const count = (f: (e: Entry) => (string | null | undefined)[] | string | null | undefined) => {
      const m = new Map<string, number>();
      const seen = new Set<string>();
      for (const x of events) {
        if (seen.has(x.e.mine.id)) continue;
        seen.add(x.e.mine.id);
        const v = f(x.e);
        for (const k of Array.isArray(v) ? v : [v]) if (k) m.set(k, (m.get(k) ?? 0) + 1);
      }
      return m;
    };
    const rated = [...books].map((id) => entries.find((e) => e.mine.id === id)!).filter((e) => e.mine.rating != null);
    const avg = rated.length ? rated.reduce((s, e) => s + (e.mine.rating ?? 0), 0) / rated.length : null;
    const dnf = entries.filter((e) => e.readings.some((r) => r.abandoned && (year === "alle" || (r.finished_on ?? "").startsWith(year)))).length;
    return {
      events, books: books.size, pages, months, avg, dnf,
      genres: top(count((e) => e.book.genre)), subgenres: top(count((e) => e.book.subgenres ?? [])),
      authors: top(count((e) => e.authors.map((a) => a.name))), kinds: top(count((e) => e.book.kind)),
      verdicts: top(count((e) => (e.mine.verdict ? VERDICT[e.mine.verdict] : null)), 6),
      media: top(count((e) => e.mine.medium ?? [])), languages: top(count((e) => e.book.language ?? []))
    };
  }, [entries, year]);

  if (isLoading || !lib) return <p className="muted">Lade…</p>;
  const goal = lib.goals.find((g) => g.year === Number(year))?.books_goal ?? null;
  const owned = entries.length;
  const unread = entries.filter((e) => e.mine.status === "tbr" || e.mine.status === "ungelesen").length;

  return (
    <>
      <div className="mast">
        <div>
          <h1>Statis<em>tik</em></h1>
          <p className="lede">{owned} Bücher im Regal, davon {unread} noch ungelesen.</p>
        </div>
        <div className="tools">
          <select className="input" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Jahr">
            {!years.includes(String(thisYear)) && <option value={String(thisYear)}>{thisYear}</option>}
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
            <option value="alle">Alle Jahre</option>
          </select>
        </div>
      </div>

      <div className="stats">
        <Link className="stat" to={year === "alle" ? "/regal?v=jahre" : `/regal?v=jahre&jahr=${year}`} title="Im Regal ansehen"><span className="stat-label">Gelesen {year === "alle" ? "insgesamt" : year} →</span><span className="stat-value">{stats.events.length}{goal && year !== "alle" ? <small> / {goal}</small> : null}</span>
          {goal && year !== "alle" ? <div className="goalbar"><div style={{ width: `${Math.min(100, (stats.events.length / goal) * 100)}%` }} /></div> : null}</Link>
        <div className="stat"><span className="stat-label">Seiten</span><span className="stat-value">{stats.pages.toLocaleString("de-DE")}</span></div>
        <div className="stat"><span className="stat-label">Ø Sterne</span><span className="stat-value">{stats.avg != null ? stats.avg.toFixed(2) : "–"}</span></div>
        <div className="stat"><span className="stat-label">Abgebrochen</span><span className="stat-value">{stats.dnf}</span></div>
        <div className="stat"><span className="stat-label">Ø pro Monat</span><span className="stat-value">{year === "alle" ? "–" : (stats.events.length / (year === String(thisYear) ? new Date().getMonth() + 1 : 12)).toFixed(1)}</span></div>
      </div>

      {year !== "alle" && (
        <div className="panel section">
          <div className="section-head">
            <h2>Lesejahr {year} <Link to={`/regal?v=jahre&jahr=${year}`} className="btn small ghost">Im Regal ansehen →</Link></h2>
            <form className="actions" onSubmit={async (ev) => { ev.preventDefault(); const n = Number(goalDraft); if (!n) return; await saveGoal.mutateAsync({ user_id: "", year: Number(year), books_goal: n }); setGoalDraft(""); toast("Ziel gespeichert."); }}>
              <input className="input" style={{ width: 110 }} type="number" min={1} placeholder={goal ? `Ziel: ${goal}` : "Jahresziel"} value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)} />
              <button className="btn small" type="submit">Ziel setzen</button>
            </form>
          </div>
          <div className="months">
            {stats.months.map((n, i) => {
              const max = Math.max(1, ...stats.months);
              return <div className="mcol" key={i}><span className="mcount">{n || ""}</span><div className="mbar" style={{ height: `${(n / max) * 100}%` }} /></div>;
            })}
          </div>
          <div className="mlabels">{MONTHS.map((m) => <span key={m}>{m}</span>)}</div>
          {stats.events.some((x) => x.month == null) && <p className="meta">Bei {stats.events.filter((x) => x.month == null).length} Büchern ist nur das Jahr bekannt, sie fehlen in der Monatsansicht.</p>}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <div className="panel section"><h3>Genres</h3><Bars data={stats.genres} /></div>
        <div className="panel section"><h3>Untergenres</h3><Bars data={stats.subgenres} /></div>
        <div className="panel section"><h3>Meistgelesene Autor:innen</h3><Bars data={stats.authors} /></div>
        <div className="panel section"><h3>Kurzbewertung</h3><Bars data={stats.verdicts} /></div>
        <div className="panel section"><h3>Art</h3><Bars data={stats.kinds} /></div>
        <div className="panel section"><h3>Medium</h3><Bars data={stats.media} /></div>
      </div>
    </>
  );
}
