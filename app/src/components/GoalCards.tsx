import type { Entry, Goal } from "../data/types";
import { readEvents, seriesNo } from "../lib/stats";
import { subReadSince } from "./Kaufstopp";
import { Icon, type IconName } from "./Icon";
import { Link } from "./Link";

const fmt = (n: number, d = 1) => n.toLocaleString("de-DE", { maximumFractionDigits: d });
const MONTH = 30.44;

const isRead = (e: Entry) => e.mine.status === "gelesen" || e.readings.some((r) => !r.abandoned && (r.finished_on || r.finished_text));

/** Ring mit Fortschritt; in der Mitte Prozent (mit Ziel) oder ein Symbol (ohne Ziel). */
function GoalRing({ pct, icon }: { pct: number | null; icon: IconName }) {
  return (
    <div className="gring" style={{ ["--p" as any]: pct ?? 0 }}>
      <div className="gring-in">
        {pct != null ? <span className="gring-num">{pct}<small>%</small></span> : <Icon name={icon} size={30} />}
      </div>
    </div>
  );
}

function Chip({ icon, label, value }: { icon: IconName; label: string; value: string | number }) {
  return <span className="gchip"><Icon name={icon} size={16} />{label} <strong>{value}</strong></span>;
}

function EditButton({ has, onClick }: { has: boolean; onClick: () => void }) {
  return (
    <button type="button" className="btn small gedit" onClick={onClick}>
      <Icon name={has ? "pencil" : "target"} size={16} />{has ? "Ziel ändern" : "Ziel festlegen"}
    </button>
  );
}

/** Alle Kennzahlen für die drei Jahresziele. */
export function goalStats(entries: Entry[], year: number) {
  const ev = readEvents(entries).filter((x) => x.year === year);
  const start = new Date(year, 0, 1).getTime();
  const daysInYear = Math.round((new Date(year + 1, 0, 1).getTime() - start) / 86400000);
  const dayOfYear = Math.min(daysInYear, Math.floor((Date.now() - start) / 86400000) + 1);

  const subRead = subReadSince(entries, `${year}-01-01`).filter((x) => x.date.startsWith(String(year))).length;

  // Reihen: angefangen, beendet, dieses Jahr beendet
  const bySeries = new Map<string, Entry[]>();
  for (const e of entries) if (e.series && e.mine.status !== "wunschliste") bySeries.set(e.series.id, [...(bySeries.get(e.series.id) ?? []), e]);
  const series = [...bySeries.values()].map((vols) => {
    const s = vols[0].series!;
    const total = Math.max(s.total_count ?? 0, vols.length);
    const read = vols.filter(isRead);
    const last = [...read].sort((a, b) => seriesNo(b.book.series_number) - seriesNo(a.book.series_number))[0];
    const complete = total > 0 && read.length >= total;
    const finishedThisYear = complete && !!last?.readings.some((r) => (r.finished_on ?? r.finished_text ?? "").startsWith(String(year)));
    const owned = vols.filter((v) => !isRead(v) && ["tbr", "ungelesen", "lese"].includes(v.mine.status)).length;
    return { id: s.id, name: s.name, total, read: read.length, complete, finishedThisYear, owned, missing: total - vols.length };
  });
  const open = series.filter((s) => s.read > 0 && !s.complete);
  const doneThisYear = series.filter((s) => s.finishedThisYear);
  const almost = series
    .filter((s) => s.read > 0 && !s.complete)
    .sort((a, b) => (a.total - a.read) - (b.total - b.read) || b.read / b.total - a.read / a.total)
    .slice(0, 6);

  return {
    read: ev.length,
    pages: ev.reduce((s, x) => s + (x.e.book.pages ?? 0), 0),
    daysInYear, dayOfYear, daysLeft: daysInYear - dayOfYear,
    subRead,
    tbr: entries.filter((e) => e.mine.status === "tbr").length,
    tbrPages: entries.filter((e) => e.mine.status === "tbr").reduce((n, e) => n + (e.book.pages ?? 0), 0),
    unread: entries.filter((e) => e.mine.status === "ungelesen").length,
    startedSeries: open.length,
    completedSeries: series.filter((s) => s.read > 0 && s.complete).length,
    openVolumes: open.reduce((n, s) => n + (s.total - s.read), 0),
    ownedVolumes: open.reduce((n, s) => n + s.owned, 0),
    buyVolumes: open.reduce((n, s) => n + s.missing, 0),
    doneThisYear, almost
  };
}

type S = ReturnType<typeof goalStats>;

export function YearGoalCard({ s, goal, year, onEdit }: { s: S; goal?: Goal; year: number; onEdit: () => void }) {
  const target = goal?.books_goal ?? null;
  const pct = target ? Math.min(100, Math.round((s.read / target) * 100)) : null;
  const plan = target ? Math.round((target * s.dayOfYear) / s.daysInYear) : null;
  const diff = plan != null ? s.read - plan : 0;
  const perMonth = s.read / (s.dayOfYear / MONTH);
  const needed = target && s.daysLeft > 0 ? Math.max(0, target - s.read) / (s.daysLeft / MONTH) : null;
  const forecast = Math.round((s.read / s.dayOfYear) * s.daysInYear);
  const done = !!target && s.read >= target;
  return (
    <div className={"panel gcard gcard-year" + (done ? " done" : "")}>
      <GoalRing pct={pct} icon="book" />
      <div className="gcard-body">
        <div className="gcard-head">
          <span className="gcard-kicker">Jahresziel {year}</span>
          <EditButton has={!!target} onClick={onEdit} />
        </div>
        <p className="gcard-value">{s.read}<span>{target ? ` / ${target}` : ""} Bücher</span></p>
        <p className="gcard-status">
          {!target ? "Leg fest, wie viele Bücher du dieses Jahr lesen möchtest."
            : done ? `Ziel erreicht, ${s.read - target} Bücher darüber hinaus.`
            : diff >= 0 ? `Du liegst ${diff === 0 ? "genau im Plan" : `${diff} ${diff === 1 ? "Buch" : "Bücher"} vor dem Plan`}.`
            : `Dir fehlen ${-diff} ${diff === -1 ? "Buch" : "Bücher"} zum Plan.`}
          {" "}<span className="muted">Bei deinem Tempo werden es etwa {forecast} Bücher.</span>
        </p>
        <div className="gchips">
          {target && !done ? <Chip icon="book" label="Noch" value={`${target - s.read} Bücher`} /> : <Chip icon="book" label="Seiten" value={fmt(s.pages, 0)} />}
          <Chip icon="trend" label="Dein Tempo" value={`${fmt(perMonth)} pro Monat`} />
          {needed != null && !done && <Chip icon="target" label="Nötig" value={`${fmt(needed)} pro Monat`} />}
          <Chip icon="calendar" label="Noch" value={`${s.daysLeft} Tage im Jahr`} />
        </div>
      </div>
    </div>
  );
}

/**
 * Dauerhaftes Ziel: SuB verkleinern. Gespeichert in der Ziel-Zeile mit Jahr 0:
 * sub_goal = gewünschte SuB-Größe, books_goal = SuB-Größe beim Festlegen (Startpunkt).
 */
export function SubGoalCard({ s, goal, onEdit }: { s: S; goal?: Goal; onEdit: () => void }) {
  const target = goal?.sub_goal ?? null;
  const start = goal?.books_goal ?? null;
  const has = target != null;
  const done = has && s.tbr <= target!;
  const way = has && start != null ? start - target! : 0;
  const pct = has ? (done ? 100 : way > 0 ? Math.max(0, Math.min(100, Math.round(((start! - s.tbr) / way) * 100))) : 0) : null;
  const change = start != null ? start - s.tbr : 0;
  return (
    <div className={"panel gcard gcard-wide gcard-sub" + (done ? " done" : "")}>
      <GoalRing pct={pct} icon="books" />
      <div className="gcard-body">
        <div className="gcard-head">
          <span className="gcard-kicker">SuB abbauen</span>
          <EditButton has={has} onClick={onEdit} />
        </div>
        <p className="gcard-value">{s.tbr}<span> Bücher im SuB{has ? `, Ziel ${target === 0 ? "leer" : `höchstens ${target}`}` : ""}</span></p>
        <p className="gcard-status">
          {!has ? "Leg fest, auf wie viele Bücher dein Stapel schrumpfen soll."
            : done ? "Ziel erreicht. Dein Stapel dankt es dir."
            : <>{change > 0 ? `Seit du das Ziel gesetzt hast, ist dein SuB um ${change} ${change === 1 ? "Buch" : "Bücher"} kleiner geworden. `
                : change < 0 ? `Seit du das Ziel gesetzt hast, ist dein SuB um ${-change} ${change === -1 ? "Buch" : "Bücher"} gewachsen. ` : ""}
              Noch {s.tbr - target!} bis zum Ziel.</>}
        </p>
        <div className="gchips">
          <Chip icon="check" label={`${new Date().getFullYear()} vom SuB gelesen`} value={s.subRead} />
          <Chip icon="stack" label="Seiten im SuB" value={fmt(s.tbrPages, 0)} />
          <Chip icon="moon" label="Ungelesen" value={s.unread} />
          <Link className="gchip gchip-link" to="/sub"><Icon name="dice" size={16} />Zufallsbuch ziehen</Link>
        </div>
      </div>
    </div>
  );
}

/** Dauerhaftes Ziel: alle angefangenen Reihen zu Ende lesen. Braucht keine Zahl, das Ziel sind alle. */
export function SeriesGoalCard({ s }: { s: S }) {
  const all = s.completedSeries + s.startedSeries;
  const pct = all ? Math.round((s.completedSeries / all) * 100) : null;
  const done = all > 0 && s.startedSeries === 0;
  return (
    <div className={"panel gcard gcard-series" + (done ? " done" : "")}>
      <div className="gcard-top">
        <GoalRing pct={pct} icon="layers" />
        <div className="gcard-body">
          <div className="gcard-head">
            <span className="gcard-kicker">Angefangene Reihen beenden</span>
            <Link className="btn small ghost" to="/reihen">Alle Reihen <Icon name="arrow" size={16} /></Link>
          </div>
          <p className="gcard-value">{s.completedSeries}<span> / {all} Reihen abgeschlossen</span></p>
          <p className="gcard-status">
            {done ? "Alle angefangenen Reihen sind fertig gelesen."
              : `${s.startedSeries} ${s.startedSeries === 1 ? "Reihe ist" : "Reihen sind"} noch offen, dafür fehlen dir ${s.openVolumes} ${s.openVolumes === 1 ? "Band" : "Bände"}.`}
          </p>
          {!done && (
            <div className="gchips">
              <Chip icon="books" label="Davon im Regal" value={s.ownedVolumes} />
              <Chip icon="gift" label="Noch zu kaufen" value={s.buyVolumes} />
            </div>
          )}
        </div>
      </div>
      {s.almost.length > 0 && (
        <div className="galmost">
          <span className="gcard-kicker">Fast geschafft</span>
          <div className="galmost-grid">
            {s.almost.map((r) => (
              <div key={r.id} className="galmost-row">
                <span className="galmost-name">{r.name}</span>
                <div className="galmost-bar"><div style={{ width: `${Math.round((r.read / r.total) * 100)}%` }} /></div>
                <span className="galmost-n">{r.read} von {r.total}</span>
                <span className="galmost-left">noch {r.total - r.read}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {s.doneThisYear.length > 0 && <p className="meta" style={{ margin: 0 }}><Icon name="check" size={14} /> {new Date().getFullYear()} beendet: {s.doneThisYear.map((r) => r.name).join(", ")}</p>}
    </div>
  );
}
