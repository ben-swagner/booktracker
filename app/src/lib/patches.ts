import type { Entry, Library } from "../data/types";
import type { IconName } from "../components/Icon";
import { readEvents } from "./stats";
import { goalStats } from "../components/GoalCards";
import { parseKaufstopp } from "../components/Kaufstopp";
import { today } from "./labels";

/**
 * Patches: Abzeichen für erreichte Dinge. Die App rechnet sie jedes Mal aus deinen Daten aus,
 * es wird nichts zusätzlich gespeichert. Viele Patches haben Stufen (Bronze bis Regenbogen).
 */
export type Patch = {
  key: string;           // eindeutig, z. B. "monat-3" oder "jahresziel-2025"
  family: string;        // Gruppe, z. B. "monat"
  title: string;
  desc: string;
  icon: IconName;
  color: string;         // Grundfarbe der Gruppe
  tier: number;          // 1 bis 6, 0 = ohne Stufen
  tiers: number;         // wie viele Stufen die Gruppe hat
  earned: boolean;
  date?: string;         // wann erreicht (JJJJ-MM-TT oder JJJJ-MM), falls bekannt
  value: number;         // aktueller Stand
  target: number;        // was für diese Stufe nötig ist
  unit?: string;
  count?: number;        // wie oft erreicht (z. B. mehrere komplette Lesejahre)
};

export const TIER_NAMES = ["", "Bronze", "Silber", "Gold", "Platin", "Diamant", "Regenbogen"];

type Ladder = { family: string; icon: IconName; color: string; unit?: string; steps: number[]; title: (n: number) => string; desc: (n: number) => string };

const LADDERS: Ladder[] = [
  { family: "monat", icon: "calendar", color: "#E8A04A", unit: "Bücher", steps: [5, 8, 12, 16, 20], title: (n) => `${n} Bücher in einem Monat`, desc: (n) => `In einem einzigen Kalendermonat ${n} Bücher beendet.` },
  { family: "gesamt", icon: "books", color: "#6F5BD0", unit: "Bücher", steps: [50, 100, 250, 500, 1000, 1500], title: (n) => `${n.toLocaleString("de-DE")} Bücher gelesen`, desc: (n) => `Insgesamt ${n.toLocaleString("de-DE")} Bücher gelesen.` },
  { family: "seiten", icon: "pages", color: "#3F8F6B", unit: "Seiten", steps: [10000, 50000, 100000, 250000, 500000], title: (n) => `${n.toLocaleString("de-DE")} Seiten`, desc: (n) => `Zusammen ${n.toLocaleString("de-DE")} Seiten gelesen.` },
  { family: "reihen", icon: "layers", color: "#C2577A", unit: "Reihen", steps: [1, 5, 10, 25, 50, 100], title: (n) => (n === 1 ? "Erste Reihe beendet" : `${n} Reihen beendet`), desc: (n) => (n === 1 ? "Eine Reihe bis zum letzten Band gelesen." : `${n} Reihen bis zum letzten Band gelesen.`) },
  { family: "woche", icon: "flame", color: "#D9583B", unit: "Wochen", steps: [4, 8, 12, 26, 52], title: (n) => `${n} Lesewochen am Stück`, desc: (n) => `${n} Wochen hintereinander jede Woche mindestens ein Buch beendet.` },
  { family: "genres", icon: "globe", color: "#2F7FB8", unit: "Genres", steps: [3, 5, 8, 12], title: (n) => `${n} Genres entdeckt`, desc: (n) => `Bücher aus ${n} verschiedenen Genres gelesen.` },
  { family: "dick", icon: "weight", color: "#8A6A4F", unit: "Seiten", steps: [600, 800, 1000], title: (n) => `Wälzer mit ${n}+ Seiten`, desc: (n) => `Ein Buch mit mindestens ${n} Seiten gelesen.` },
  { family: "reread", icon: "repeat", color: "#4C9A9A", unit: "Rereads", steps: [1, 10, 25, 50], title: (n) => (n === 1 ? "Erstes Reread" : `${n} Rereads`), desc: (n) => (n === 1 ? "Ein Buch ein zweites Mal gelesen." : `${n}-mal ein Buch noch einmal gelesen.`) },
  { family: "autor", icon: "user", color: "#9C5FB5", unit: "Bücher", steps: [5, 10, 20, 30], title: (n) => `${n} Bücher von einer Person`, desc: (n) => `${n} Bücher von derselben Autorin oder demselben Autor gelesen.` },
  { family: "buddy", icon: "people", color: "#D0752E", unit: "Buddy Reads", steps: [1, 5, 10, 25], title: (n) => (n === 1 ? "Erster Buddy Read" : `${n} Buddy Reads`), desc: (n) => (n === 1 ? "Ein Buch gemeinsam mit anderen gelesen." : `${n} Bücher gemeinsam mit anderen gelesen.`) },
  { family: "kaufstopp", icon: "coin", color: "#5B8C3A", unit: "Tage", steps: [7, 30, 60, 100, 365], title: (n) => `${n} Tage ohne Buchkauf`, desc: (n) => `Beim Kaufstopp ${n} Tage am Stück kein Buch gekauft.` }
];

const ym = (d: string) => d.slice(0, 7);
const weekNo = (d: string) => Math.floor((Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000 + 3) / 7); // Wochen ab Montag

/** Alle Patches mit Stand. Für Stufen-Gruppen kommt jede Stufe einzeln zurück. */
export function computePatches(entries: Entry[], lib: Library): Patch[] {
  const ev = readEvents(entries);
  const dated = ev.filter((x) => x.r.finished_on && /^\d{4}-\d{2}-\d{2}/.test(x.r.finished_on)).sort((a, b) => a.r.finished_on!.localeCompare(b.r.finished_on!));
  const readEntries = entries.filter((e) => e.mine.status === "gelesen" || e.readings.some((r) => !r.abandoned && (r.finished_on || r.finished_text)));

  // Für jede Gruppe: Wert und, wo möglich, das Datum, an dem eine Schwelle erreicht wurde
  const values: Record<string, { value: number; dateFor?: (n: number) => string | undefined }> = {};

  // Bücher pro Monat
  const perMonth = new Map<string, number>();
  for (const x of dated) perMonth.set(ym(x.r.finished_on!), (perMonth.get(ym(x.r.finished_on!)) ?? 0) + 1);
  values.monat = { value: Math.max(0, ...perMonth.values()), dateFor: (n) => [...perMonth.entries()].filter(([, c]) => c >= n).map(([m]) => m).sort()[0] };

  // Gelesen insgesamt: beendete Durchgänge, Bücher ohne Datum zählen einmal
  const undatedRead = readEntries.filter((e) => !ev.some((x) => x.e === e)).length;
  values.gesamt = { value: ev.length + undatedRead, dateFor: (n) => (undatedRead === 0 && dated.length === ev.length ? dated[n - 1]?.r.finished_on ?? undefined : undefined) };

  // Seiten
  const pagesTotal = ev.reduce((s, x) => s + (x.e.book.pages ?? 0), 0) + readEntries.filter((e) => !ev.some((x) => x.e === e)).reduce((s, e) => s + (e.book.pages ?? 0), 0);
  values.seiten = { value: pagesTotal };

  values.reihen = { value: goalStats(entries, new Date().getFullYear()).completedSeries };

  // Lesewochen am Stück
  const weeks = [...new Set(dated.map((x) => weekNo(x.r.finished_on!)))].sort((a, b) => a - b);
  let best = 0, run = 0, prev = -9;
  for (const w of weeks) { run = w === prev + 1 ? run + 1 : 1; best = Math.max(best, run); prev = w; }
  values.woche = { value: best };

  values.genres = { value: new Set(readEntries.map((e) => e.book.genre).filter(Boolean)).size };
  values.dick = { value: Math.max(0, ...readEntries.map((e) => e.book.pages ?? 0)) };

  // Rereads: jeder weitere Lesedurchgang eines Buchs (auch ohne Datum), Abbrüche zählen nicht
  values.reread = { value: entries.reduce((s, e) => s + Math.max(0, e.readings.filter((r) => !r.abandoned).length - 1), 0) };

  const byAuthor = new Map<string, number>();
  for (const e of readEntries) for (const a of e.authors) byAuthor.set(a.id, (byAuthor.get(a.id) ?? 0) + 1);
  values.autor = { value: Math.max(0, ...byAuthor.values()) };

  values.buddy = { value: readEntries.filter((e) => e.mine.company === "buddy" || e.mine.company === "group").length };

  const kauf = lib.challenges.filter((c) => c.kind === "kaufstopp").map((c) => parseKaufstopp(c, lib.challenge_entries.filter((x) => x.challenge_id === c.id), entries));
  values.kaufstopp = { value: Math.max(0, ...kauf.map((k) => k.best)) };

  const out: Patch[] = [];
  const hasKaufstopp = kauf.length > 0;
  for (const l of LADDERS) {
    if (l.family === "kaufstopp" && !hasKaufstopp) continue;
    const v = values[l.family];
    l.steps.forEach((n, i) => {
      out.push({ key: `${l.family}-${i + 1}`, family: l.family, title: l.title(n), desc: l.desc(n), icon: l.icon, color: l.color, tier: i + 1, tiers: l.steps.length, earned: v.value >= n, date: v.value >= n ? v.dateFor?.(n) : undefined, value: v.value, target: n, unit: l.unit });
    });
  }

  // Jahresziele: ein Patch pro Jahr, in dem das Ziel erreicht wurde (und das laufende Jahr als offenes Ziel)
  const year = new Date().getFullYear();
  for (const g of lib.goals.filter((g) => g.year > 1900 && g.books_goal)) {
    const read = ev.filter((x) => x.year === g.year).length;
    const reached = read >= g.books_goal!;
    if (!reached && g.year !== year) continue;
    const when = reached ? ev.filter((x) => x.year === g.year && x.r.finished_on).map((x) => x.r.finished_on!).sort()[g.books_goal! - 1] : undefined;
    out.push({ key: `jahresziel-${g.year}`, family: "jahresziel", title: `Jahresziel ${g.year}`, desc: `${g.books_goal} Bücher in ${g.year} gelesen.`, icon: "target", color: "#17151A", tier: 0, tiers: 0, earned: reached, date: when, value: read, target: g.books_goal!, unit: "Bücher" });
  }

  // Ganzes Jahr: in jedem Monat eines Jahres mindestens ein Buch
  const monthsByYear = new Map<number, Set<number>>();
  for (const x of dated) { const y = +x.r.finished_on!.slice(0, 4); if (!monthsByYear.has(y)) monthsByYear.set(y, new Set()); monthsByYear.get(y)!.add(+x.r.finished_on!.slice(5, 7)); }
  const fullYears = [...monthsByYear.entries()].filter(([, ms]) => ms.size === 12).map(([y]) => y).sort((a, b) => a - b);
  if (fullYears.length) out.push({ key: "ganzjahr", family: "ganzjahr", title: "Lesejahr komplett", desc: `In jedem Monat eines Jahres mindestens ein Buch beendet: ${fullYears.join(", ")}.`, icon: "sparkle", color: "#B8862E", tier: 0, tiers: 0, earned: true, date: `${fullYears[fullYears.length - 1]}-12`, value: 12, target: 12, unit: "Monate", count: fullYears.length });
  const msNow = monthsByYear.get(year)?.size ?? 0;
  if (msNow < 12) out.push({ key: `ganzjahr-${year}`, family: "ganzjahr", title: `Lesejahr ${year} komplett`, desc: `In jedem Monat von ${year} mindestens ein Buch beenden.`, icon: "sparkle", color: "#B8862E", tier: 0, tiers: 0, earned: false, value: msNow, target: 12, unit: "Monate" });

  // SuB-Ziel
  const lasting = lib.goals.find((g) => g.year === 0);
  if (lasting?.sub_goal != null) {
    const tbr = entries.filter((e) => e.mine.status === "tbr").length;
    out.push({ key: "sub-ziel", family: "sub", title: "SuB-Ziel erreicht", desc: `Deinen SuB auf ${lasting.sub_goal} Bücher abgebaut.`, icon: "stack", color: "#7A6FA8", tier: 0, tiers: 0, earned: tbr <= lasting.sub_goal, value: Math.max(0, (lasting.books_goal ?? tbr) - tbr), target: Math.max(1, (lasting.books_goal ?? tbr) - lasting.sub_goal), unit: "Bücher abgebaut" });
  }

  // Bingo und Listen: geschafft
  const now = today();
  for (const c of lib.challenges) {
    const es = lib.challenge_entries.filter((x) => x.challenge_id === c.id);
    const done = es.filter((x) => x.done).length;
    if (c.kind === "bingo" && es.length) {
      const active = !c.ends_on || c.ends_on >= now;
      if (done >= es.length || active) out.push({ key: `bingo-${c.id}`, family: "bingo", title: `Bingo: ${c.name}`, desc: "Alle Felder des Bingos geschafft.", icon: "grid", color: "#3E6FD1", tier: 0, tiers: 0, earned: done >= es.length, value: done, target: es.length, unit: "Felder" });
    }
    if (c.kind === "liste" && c.target) {
      const active = !c.ends_on || c.ends_on >= now;
      if (done >= c.target || active) out.push({ key: `liste-${c.id}`, family: "liste", title: c.name, desc: `Challenge geschafft: ${c.target} Punkte erledigt.`, icon: "list", color: "#2E9C8F", tier: 0, tiers: 0, earned: done >= c.target, value: done, target: c.target, unit: "Punkte" });
    }
  }
  return out;
}

/** Für die Anzeige: von jeder Stufen-Gruppe nur die höchste erreichte Stufe, dazu alle einzelnen Patches. */
export function earnedShowcase(all: Patch[]): Patch[] {
  const best = new Map<string, Patch>();
  const singles: Patch[] = [];
  for (const p of all.filter((p) => p.earned)) {
    if (p.tiers) { const b = best.get(p.family); if (!b || p.tier > b.tier) best.set(p.family, p); }
    else singles.push(p);
  }
  return [...best.values(), ...singles.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))];
}

/** Als Nächstes erreichbar: pro Gruppe die nächste offene Stufe, sortiert nach Fortschritt. */
export function nextUp(all: Patch[]): Patch[] {
  const seen = new Set<string>();
  const out: Patch[] = [];
  for (const p of all.filter((p) => !p.earned)) {
    const k = p.tiers ? p.family : p.key;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out.sort((a, b) => b.value / b.target - a.value / a.target);
}

export function fmtPatchDate(d?: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return day ? `${day}.${m}.${y}` : m ? `${["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"][+m - 1]} ${y}` : y;
}
