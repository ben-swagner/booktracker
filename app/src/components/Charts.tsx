import { useState } from "react";
import { Icon, type IconName } from "./Icon";
import { useWidth } from "./ui";

/**
 * Kleine, schlichte Diagramme für die Statistik. Alle zeigen beim Darüberfahren (oder Antippen)
 * den genauen Wert; Farben kommen aus den geprüften Diagrammfarben (--c1 … --c8).
 */

export const fmtN = (n: number, d = 0) => n.toLocaleString("de-DE", { maximumFractionDigits: d, minimumFractionDigits: 0 });

/** Säulen, z. B. Bücher pro Monat. ghost = Vergleichswert (Vorjahr) als blasse Säule dahinter. */
export function Columns({ data, color = "var(--ink)", height = 160, unit = "", ghostLabel }: {
  data: { label: string; value: number; ghost?: number; title?: string }[]; color?: string; height?: number; unit?: string; ghostLabel?: string;
}) {
  const [hi, setHi] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.ghost ?? 0)));
  return (
    <div className="ch-cols" style={{ ["--h" as any]: `${height}px` }} onMouseLeave={() => setHi(null)}>
      <div className="ch-cols-plot">
        {data.map((d, i) => (
          <div key={d.label} className={"ch-col" + (hi === i ? " hi" : "")} onMouseEnter={() => setHi(i)} onClick={() => setHi(i)}
            title={d.title ?? `${d.label}: ${fmtN(d.value)}${unit}${d.ghost != null && ghostLabel ? ` (${ghostLabel}: ${fmtN(d.ghost)})` : ""}`}>
            {d.ghost != null && <div className="ch-ghost" style={{ height: `${(d.ghost / max) * 100}%` }} />}
            <div className="ch-bar" style={{ height: `${(d.value / max) * 100}%`, background: color }} />
            {hi === i && <span className="ch-tip">{fmtN(d.value)}{unit}</span>}
          </div>
        ))}
      </div>
      <div className="ch-cols-labels">{data.map((d) => <span key={d.label}>{d.label}</span>)}</div>
    </div>
  );
}

/** Waagrechte Balken mit Beschriftung, z. B. Genres. */
export function BarList({ items, color = "var(--ink)", unit = "", max: maxIn, onClick }: {
  items: { label: React.ReactNode; key?: string; value: number; color?: string; sub?: string; cmp?: number }[]; color?: string; unit?: string; max?: number; onClick?: (i: number) => void;
}) {
  const max = maxIn ?? Math.max(1, ...items.map((d) => Math.max(d.value, d.cmp ?? 0)));
  const hasCmp = items.some((d) => d.cmp != null);
  return (
    <div className="ch-bars">
      {items.map((d, i) => (
        <div key={d.key ?? String(d.label)} className={"ch-barrow" + (onClick ? " click" : "")} onClick={onClick ? () => onClick(i) : undefined} title={`${typeof d.label === "string" ? d.label : ""}: ${fmtN(d.value, 1)}${unit}`}>
          <span className="ch-barlabel">{d.label}</span>
          {hasCmp ? (
            <div className="ch-track2">
              <div className="ch-track"><div style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: d.color ?? color }} /></div>
              <div className="ch-track cmp"><div style={{ width: `${Math.max(d.cmp ? 2 : 0, ((d.cmp ?? 0) / max) * 100)}%`, background: d.color ?? color }} /></div>
            </div>
          ) : <div className="ch-track"><div style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: d.color ?? color }} /></div>}
          <span className="ch-barval">{fmtN(d.value, 1)}{unit}{hasCmp ? <small className="ch-cmpval"> · {fmtN(d.cmp ?? 0, 1)}</small> : d.sub ? <small> {d.sub}</small> : null}</span>
        </div>
      ))}
    </div>
  );
}

/** Ring-Diagramm mit Legende. Kleine Anteile werden zu „Andere“ zusammengefasst. */
export function Donut({ items, center, sub, max = 7, compare }: { items: { label: string; value: number; color: string }[]; center?: React.ReactNode; sub?: string; max?: number; compare?: { label: string; value: number }[] }) {
  const [hi, setHi] = useState<number | null>(null);
  let list = items.filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  if (list.length > max) {
    const rest = list.slice(max - 1).reduce((n, x) => n + x.value, 0);
    list = [...list.slice(0, max - 1), { label: "Andere", value: rest, color: "var(--c0)" }];
  }
  const total = list.reduce((n, x) => n + x.value, 0) || 1;
  const R = 42, C = 2 * Math.PI * R, GAP = list.length > 1 ? 1.2 : 0;
  // Vergleich: gleiche Gruppen wie oben, Rest als „Andere“
  const cmpTotal = compare ? compare.reduce((n, x) => n + x.value, 0) || 1 : 1;
  const cmpOf = (label: string) => !compare ? 0 : label === "Andere" ? compare.filter((c) => !list.some((x) => x.label === c.label)).reduce((n, c) => n + c.value, 0) : compare.find((c) => c.label === label)?.value ?? 0;
  const R2 = 31, C2 = 2 * Math.PI * R2;
  let acc2 = 0;
  let acc = 0;
  return (
    <div className="ch-donut">
      <svg viewBox="0 0 100 100" className="ch-donut-svg" role="img" aria-label={list.map((x) => `${x.label} ${Math.round((x.value / total) * 100)} %`).join(", ")}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
        {compare && list.map((x) => {
          const len = (cmpOf(x.label) / cmpTotal) * C2;
          const el = len > 0 ? <circle key={"c" + x.label} cx="50" cy="50" r={R2} fill="none" stroke={x.color} strokeOpacity=".45" strokeWidth="5" strokeDasharray={`${Math.max(0.3, len - 0.8)} ${C2}`} strokeDashoffset={-acc2} transform="rotate(-90 50 50)"><title>{`Vergleich ${x.label}: ${fmtN(cmpOf(x.label))}`}</title></circle> : null;
          acc2 += len;
          return el;
        })}
        {list.map((x, i) => {
          const len = (x.value / total) * C;
          const el = (
            <circle key={x.label} cx="50" cy="50" r={R} fill="none" stroke={x.color} strokeWidth={hi === i ? 15 : 12}
              strokeDasharray={`${Math.max(0.5, len - GAP)} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 50 50)"
              onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} style={{ transition: "stroke-width .15s" }}>
              <title>{`${x.label}: ${fmtN(x.value)} (${Math.round((x.value / total) * 100)} %)`}</title>
            </circle>
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="ch-donut-center">
        {hi != null ? <><strong>{Math.round((list[hi].value / total) * 100)} %</strong><span>{list[hi].label}</span></> : <>{center}{sub && <span>{sub}</span>}</>}
      </div>
      <ul className="ch-legend">
        {list.map((x, i) => (
          <li key={x.label} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} className={hi === i ? "hi" : ""}>
            <i style={{ background: x.color }} /><span>{x.label}</span><b>{Math.round((x.value / total) * 100)} %{compare ? <small className="ch-cmpval"> · {Math.round((cmpOf(x.label) / cmpTotal) * 100)} %</small> : null}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ein waagrechter, gestapelter Balken mit Legende (z. B. Print / Digital / Hörbuch). */
export function StackBar({ items }: { items: { label: string; value: number; color: string; cmp?: number }[] }) {
  const list = items.filter((x) => x.value > 0 || (x.cmp ?? 0) > 0);
  const total = list.reduce((n, x) => n + x.value, 0) || 1;
  const hasCmp = list.some((x) => x.cmp != null);
  const cmpTotal = list.reduce((n, x) => n + (x.cmp ?? 0), 0) || 1;
  return (
    <div className="ch-stack">
      <div className="ch-stack-bar">
        {list.map((x) => <div key={x.label} style={{ flex: x.value, background: x.color }} title={`${x.label}: ${fmtN(x.value)} (${Math.round((x.value / total) * 100)} %)`} />)}
      </div>
      {hasCmp && <div className="ch-stack-bar cmp">{list.map((x) => <div key={x.label} style={{ flex: x.cmp ?? 0, background: x.color }} title={`Vergleich ${x.label}: ${fmtN(x.cmp ?? 0)}`} />)}</div>}
      <ul className="ch-legend row">
        {list.map((x) => <li key={x.label}><i style={{ background: x.color }} /><span>{x.label}</span><b>{Math.round((x.value / total) * 100)} %{hasCmp ? <small className="ch-cmpval"> · {Math.round(((x.cmp ?? 0) / cmpTotal) * 100)} %</small> : null}</b></li>)}
      </ul>
    </div>
  );
}

/** Linien, z. B. Ziel-Verlauf. Eine Achse, eine Einheit. */
export function Lines({ labels, series, height = 180, unit = "" }: {
  labels: string[]; series: { name: string; values: (number | null)[]; color: string; dashed?: boolean }[]; height?: number; unit?: string;
}) {
  const [hi, setHi] = useState<number | null>(null);
  const [ref, w] = useWidth<HTMLDivElement>();
  const W = Math.max(280, w || 600), H = height, P = { l: 34, r: 12, t: 12, b: 8 };
  const max = Math.max(1, ...series.flatMap((s) => s.values.filter((v): v is number => v != null)));
  const niceMax = Math.ceil(max / 10) * 10 || 10;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / Math.max(1, labels.length - 1);
  const y = (v: number) => H - P.b - (v / niceMax) * (H - P.t - P.b);
  const ticks = [0, niceMax / 2, niceMax];
  return (
    <div className="ch-lines" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} onMouseLeave={() => setHi(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" className="ch-axis">{fmtN(t)}</text>
          </g>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(" ");
          return <polyline key={s.name} points={pts} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? "6 5" : undefined} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
        })}
        {hi != null && <line x1={x(hi)} x2={x(hi)} y1={P.t} y2={H - P.b} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        {hi != null && series.map((s) => s.values[hi] != null && <circle key={s.name} cx={x(hi)} cy={y(s.values[hi]!)} r="4.5" fill={s.color} stroke="var(--surface)" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
        {labels.map((_, i) => <rect key={"h" + i} x={x(i) - (W - P.l - P.r) / labels.length / 2} y={0} width={(W - P.l - P.r) / labels.length} height={H} fill="transparent" onMouseEnter={() => setHi(i)} onClick={() => setHi(i)} />)}
      </svg>
      <div className="ch-lines-labels" style={{ paddingLeft: `${(P.l / W) * 100}%`, paddingRight: `${(P.r / W) * 100}%` }}>{labels.map((l, i) => <span key={l + i}>{l}</span>)}</div>
      <div className="ch-lines-foot">
        <ul className="ch-legend row">{series.map((s) => <li key={s.name}><i className={s.dashed ? "dash" : ""} style={{ background: s.color }} /><span>{s.name}</span></li>)}</ul>
        {hi != null && <span className="ch-lines-tip"><strong>{labels[hi]}</strong>{series.map((s) => s.values[hi] != null ? ` · ${s.name}: ${fmtN(s.values[hi]!, 1)}${unit}` : "").join("")}</span>}
      </div>
    </div>
  );
}

/** Lese-Kalender: Jahre × Monate, je dunkler, desto mehr Bücher. */
export function Heatmap({ rows, cols, values, unit = "Bücher" }: { rows: string[]; cols: string[]; values: number[][]; unit?: string }) {
  const max = Math.max(1, ...values.flat());
  return (
    <div className="ch-heat">
      <div className="ch-heat-grid" style={{ gridTemplateColumns: `44px repeat(${cols.length}, minmax(0, 1fr))` }}>
        <span />
        {cols.map((c) => <span key={c} className="ch-heat-col">{c}</span>)}
        {rows.map((r, ri) => (
          <div key={r} style={{ display: "contents" }}>
            <span className="ch-heat-row">{r}</span>
            {cols.map((c, ci) => {
              const v = values[ri][ci];
              return <span key={c} className="ch-heat-cell" title={`${c} ${r}: ${v} ${unit}`} style={{ background: v ? `color-mix(in srgb, var(--ink) ${18 + (v / max) * 82}%, var(--surface))` : undefined }}>{v || ""}</span>;
            })}
          </div>
        ))}
      </div>
      <div className="ch-heat-scale"><span>weniger</span>{[0.2, 0.45, 0.7, 1].map((k) => <i key={k} style={{ background: `color-mix(in srgb, var(--ink) ${18 + k * 82}%, var(--surface))` }} />)}<span>mehr</span></div>
    </div>
  );
}

/** Karte mit großem Wert, z. B. „Seiten: 29.083“. */
/** Kleines Schild, für welchen Zeitraum eine Zahl gilt (z. B. „2026“ oder „Alle Jahre“). */
export function Scope({ value }: { value?: React.ReactNode }) {
  if (!value) return null;
  if (typeof value !== "string") return <>{value}</>;
  return <span className={"scope" + (/^\d{4}$/.test(value) ? " year" : "")} title={/^\d{4}$/.test(value) ? `Gilt nur für ${value}` : value === "Alle Jahre" ? "Gilt für alle Jahre zusammen" : "Gilt für alle deine Bücher"}>{value}</span>;
}

/** Auswahl des Zeitraums für eine einzelne Karte: ein Jahr oder alle Jahre. */
export function ScopeSelect({ value, years, onChange, compare, cmpYears, onCompare }: {
  value: string; years: number[]; onChange: (v: string) => void;
  compare?: string | null; cmpYears?: number[]; onCompare?: (v: string | null) => void;
}) {
  const main = (
    <span className={"scope scope-select" + (value === "alle" ? "" : " year")}>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Zeitraum für diese Karte" title="Zeitraum für diese Karte wählen">
        {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
        <option value="alle">Alle Jahre</option>
      </select>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </span>
  );
  if (!onCompare) return main;
  const opts = (cmpYears ?? years).filter((y) => String(y) !== value);
  return (
    <span className="scope-group">
      {main}
      {compare ? (
        <span className="scope scope-select scope-cmp">
          <span className="scope-vs">vs</span>
          <select value={compare} onChange={(e) => onCompare(e.target.value)} aria-label="Vergleichsjahr" title="Vergleichsjahr wählen">
            {!opts.some((y) => String(y) === compare) && <option value={compare}>{compare}</option>}
            {opts.map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
          <button type="button" className="scope-x" onClick={() => onCompare(null)} aria-label="Vergleich beenden" title="Vergleich beenden">×</button>
        </span>
      ) : opts.length > 0 && value !== "alle" ? (
        <button type="button" className="scope scope-add" onClick={() => onCompare(String(opts.find((y) => y < Number(value)) ?? opts[0]))} title="Mit einem anderen Jahr vergleichen" aria-label="Mit einem anderen Jahr vergleichen">+ Vergleich</button>
      ) : null}
    </span>
  );
}

/** Unterschied zum Vergleichsjahr, z. B. „+5 gegenüber 2025“. */
export function Delta({ a, b, label, digits = 0, unit = "", lowerIsBetter }: { a: number | null; b: number | null; label: string; digits?: number; unit?: string; lowerIsBetter?: boolean }) {
  if (a == null || b == null) return <span className="kpi-delta">{label}: –</span>;
  const d = a - b;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return <span className={"kpi-delta" + (d === 0 ? "" : good ? " up" : " down")}>{d > 0 ? "+" : d < 0 ? "−" : "±"}{fmtN(Math.abs(d), digits)}{unit} gegenüber {label}</span>;
}

export function Kpi({ icon, label, value, sub, tone = "blue", children, scope, delta }: { icon: IconName; label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "blue" | "green" | "pink" | "yellow" | "lilac"; children?: React.ReactNode; scope?: React.ReactNode; delta?: React.ReactNode }) {
  return (
    <div className={"kpi kpi-" + tone}>
      <span className="kpi-top"><span className="kpi-icon"><Icon name={icon} size={18} /></span><Scope value={scope} /></span>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {delta ?? (sub && <span className="kpi-sub">{sub}</span>)}
      {children}
    </div>
  );
}

/** Bild-Vergleich: großes Symbol, ein Satz. */
export function Fact({ icon, tone, big, children }: { icon: IconName; tone: string; big: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="fact" style={{ ["--ft" as any]: `var(--${tone})`, ["--fs" as any]: `var(--${tone}-soft)` }}>
      <span className="fact-icon"><Icon name={icon} size={30} /></span>
      <div className="fact-body">
        <strong className="fact-big">{big}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

/** Karte für einen Bereich der Statistik. */
export function Card({ title, icon, hint, children, wide, scope }: { title: string; icon?: IconName; hint?: React.ReactNode; children: React.ReactNode; wide?: boolean; scope?: React.ReactNode }) {
  return (
    <section className={"panel scard" + (wide ? " wide" : "")}>
      <header className="scard-head">
        <h3>{icon && <Icon name={icon} size={18} />}{title}</h3>
        <Scope value={scope} />
      </header>
      {children}
      {hint && <p className="scard-hint">{hint}</p>}
    </section>
  );
}
