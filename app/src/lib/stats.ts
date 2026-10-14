import type { Entry, Reading } from "../data/types";

/** Jahr, in dem ein Lesevorgang beendet wurde (Datum oder Jahrestext). Noch offene Durchgänge zählen nicht. */
export function readingYear(r: Reading): number | null {
  const d = r.finished_on ?? r.finished_text ?? "";
  const m = /^(\d{4})/.exec(d);
  return m ? Number(m[1]) : null;
}

/** Abgeschlossene Lesevorgänge (ohne Abbrüche) mit Jahr. */
export function readEvents(entries: Entry[]): { e: Entry; r: Reading; year: number }[] {
  const out: { e: Entry; r: Reading; year: number }[] = [];
  for (const e of entries) for (const r of e.readings) {
    if (r.abandoned) continue;
    const y = readingYear(r);
    if (y) out.push({ e, r, year: y });
  }
  return out;
}

/** Letztes Beendet-Datum eines Eintrags als sortierbarer Text. */
export function lastFinished(e: Entry): string {
  return e.readings.map((r) => r.finished_on ?? r.finished_text ?? "").sort().pop() ?? "";
}

/** Bandnummer als Zahl ("2.5" → 2.5, "1-3" → 1, "" → 999). */
export function seriesNo(v?: string | null): number {
  const m = /(\d+(?:[.,]\d+)?)/.exec(v ?? "");
  return m ? Number(m[1].replace(",", ".")) : 999;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function countBy<T>(items: T[], key: (x: T) => (string | null | undefined)[] | string | null | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const v = key(it);
    for (const k of Array.isArray(v) ? v : [v]) if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
