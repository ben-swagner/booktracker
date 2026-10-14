import { useMemo } from "react";
import type { Entry } from "../data/types";
import { coverColors } from "../lib/labels";
import { bindingOf, type Binding } from "./ui";

/**
 * Schätzung der Buchdicke: Papier etwa 0,06 mm pro Seite (normales Buchpapier),
 * dazu der Einband (Hardcover-Deckel etwa 5 mm, Softcover knapp 1 mm).
 */
const MM_PER_PAGE = 0.06;
const COVER_MM: Record<Binding, number> = { hardcover: 5, paperback: 0.9, taschenbuch: 0.8, manga: 0.8, ebook: 0 };
const WIDTH_PX: Record<Binding, number> = { hardcover: 74, paperback: 66, taschenbuch: 58, manga: 52, ebook: 0 };

/** Vergleichsgrößen in Metern (ungefähre, gängige Werte). */
const REFS: { name: string; m: number }[] = [
  { name: "eine Kaffeetasse", m: 0.1 },
  { name: "ein Küchentisch", m: 0.75 },
  { name: "eine erwachsene Person", m: 1.7 },
  { name: "eine Zimmertür", m: 2.0 },
  { name: "ein Basketballkorb", m: 3.05 },
  { name: "ein Doppeldeckerbus", m: 4.4 },
  { name: "eine Giraffe", m: 5.5 },
  { name: "ein Einfamilienhaus", m: 9 },
  { name: "das Brandenburger Tor", m: 26 },
  { name: "die Freiheitsstatue", m: 93 },
  { name: "der Kölner Dom", m: 157 },
  { name: "der Eiffelturm", m: 330 }
].sort((a, b) => a.m - b.m);

const fmtM = (m: number) =>
  m < 1 ? `${Math.round(m * 100)} cm` : `${m.toLocaleString("de-DE", { maximumFractionDigits: m < 10 ? 2 : 1 })} m`;

/** Kleiner, fester Zufall pro Buch, damit der Stapel bei jedem Laden gleich schief steht. */
function wobble(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000 - 0.5;
}

export function SubTower({ books }: { books: Entry[] }) {
  const t = useMemo(() => {
    const print = books.filter((e) => bindingOf(e) !== "ebook");
    const items = print.map((e) => {
      const b = bindingOf(e);
      const mm = (e.book.pages ?? 300) * MM_PER_PAGE + COVER_MM[b];
      return { e, b, m: mm / 1000 };
    });
    const height = items.reduce((s, x) => s + x.m, 0);
    return { items, height, ebooks: books.length - print.length, guessed: print.filter((e) => !e.book.pages).length };
  }, [books]);

  if (!t.items.length) return null;

  const below = [...REFS].reverse().find((r) => r.m <= t.height);
  const above = REFS.find((r) => r.m > t.height);
  const person = 1.7;
  const floors = t.height / 2.8;

  // Zeichnung: Boden bei y=400, alles so skaliert, dass Stapel, Person und Vergleich hineinpassen
  const W = 420, GROUND = 400, TOP = 26;
  const showRef = above && above.m <= t.height * 1.6 ? above : below;
  const maxM = Math.max(t.height, person, showRef?.m ?? 0) * 1.06;
  const scale = (GROUND - TOP) / maxM;
  const step = maxM > 60 ? 20 : maxM > 25 ? 10 : maxM > 8 ? 2 : maxM > 3 ? 1 : 0.5;
  const ticks: number[] = [];
  for (let v = 0; v <= maxM; v += step) ticks.push(Math.round(v * 100) / 100);

  const cx = 170;
  let y = GROUND;
  const n = t.items.length;
  const rects = t.items.map(({ e, b, m }, i) => {
    const h = Math.max(m * scale, 0.6);
    y -= h;
    const lean = (i / n) * 14; // je höher, desto mehr kippt der Stapel
    const dx = wobble(e.mine.id) * 10 + Math.sin(i / 6) * lean;
    const rot = wobble(e.book.id) * (h > 4 ? 5 : 0);
    const w = WIDTH_PX[b];
    const c = coverColors(e.book.title);
    return (
      <rect key={e.mine.id} x={cx - w / 2 + dx} y={y} width={w} height={h} rx={Math.min(2, h / 3)} fill={c.bg}
        stroke="rgba(0,0,0,.14)" strokeWidth={h > 2 ? 0.6 : 0.3}
        transform={rot ? `rotate(${rot.toFixed(2)} ${cx + dx} ${y + h / 2})` : undefined}>
        <title>{e.book.title}</title>
      </rect>
    );
  });

  const ph = person * scale;
  const px = 300;

  return (
    <section className="panel tower">
      <div className="tower-text">
        <p className="pick-kicker">Dein SuB als Stapel</p>
        <div className="tower-height">{fmtM(t.height)}</div>
        <p className="lede" style={{ marginTop: 0 }}>
          So hoch wären deine <strong>{t.items.length}</strong> gedruckten SuB-Bücher, wenn du sie aufeinanderlegst.
        </p>
        <ul className="tower-facts">
          {below && <li>Höher als {below.name} ({fmtM(below.m)})</li>}
          {above && <li>Noch {fmtM(above.m - t.height)}, dann ist er so hoch wie {above.name} ({fmtM(above.m)})</li>}
          <li>{(t.height / person).toLocaleString("de-DE", { maximumFractionDigits: 1 })}-mal so hoch wie eine erwachsene Person</li>
          {floors >= 1 && <li>Etwa {floors.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Stockwerke</li>}
        </ul>
        <p className="meta" style={{ margin: 0 }}>
          Geschätzt mit etwa 0,06 mm pro Seite plus Einband (Hardcover dicker als Taschenbuch).
          {t.guessed ? ` Bei ${t.guessed} Büchern ohne Seitenzahl habe ich 300 Seiten angenommen.` : ""}
          {t.ebooks ? ` ${t.ebooks} eBooks stapeln sich nur digital und zählen nicht mit.` : ""}
        </p>
      </div>
      <svg className="tower-svg" viewBox={`0 0 ${W} 420`} role="img" aria-label={`Bücherstapel, etwa ${fmtM(t.height)} hoch`}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={34} x2={W - 8} y1={GROUND - v * scale} y2={GROUND - v * scale} className="tower-grid" />
            <text x={28} y={GROUND - v * scale + 4} className="tower-tick" textAnchor="end">{v.toLocaleString("de-DE")} m</text>
          </g>
        ))}
        {showRef && (
          <g>
            <line x1={60} x2={W - 8} y1={GROUND - showRef.m * scale} y2={GROUND - showRef.m * scale} className="tower-ref" />
            <text x={W - 10} y={GROUND - showRef.m * scale - 6} textAnchor="end" className="tower-ref-label">{showRef.name} · {fmtM(showRef.m)}</text>
          </g>
        )}
        {rects}
        {/* Person zum Größenvergleich */}
        <g className="tower-person" transform={`translate(${px} ${GROUND - ph})`}>
          <circle cx={0} cy={ph * 0.07} r={ph * 0.07} />
          <rect x={-ph * 0.1} y={ph * 0.15} width={ph * 0.2} height={ph * 0.42} rx={ph * 0.06} />
          <rect x={-ph * 0.085} y={ph * 0.52} width={ph * 0.075} height={ph * 0.48} rx={ph * 0.03} />
          <rect x={ph * 0.01} y={ph * 0.52} width={ph * 0.075} height={ph * 0.48} rx={ph * 0.03} />
          <rect x={-ph * 0.165} y={ph * 0.17} width={ph * 0.06} height={ph * 0.34} rx={ph * 0.03} />
          <rect x={ph * 0.105} y={ph * 0.17} width={ph * 0.06} height={ph * 0.34} rx={ph * 0.03} />
        </g>
        <text x={px} y={GROUND - ph - 8} textAnchor="middle" className="tower-tick">1,70 m</text>
        <line x1={20} x2={W - 4} y1={GROUND} y2={GROUND} className="tower-ground" />
        <text x={cx} y={Math.max(16, y - 8)} textAnchor="middle" className="tower-top">{fmtM(t.height)}</text>
      </svg>
    </section>
  );
}
