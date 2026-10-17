import type { Entry } from "../data/types";
import { readEvents } from "./stats";

/** Regeln für Benutzernamen: 3 bis 20 Zeichen, nur a–z, 0–9, Punkt und Unterstrich, vorne ein Buchstabe oder eine Zahl. */
export const HANDLE_RE = /^[a-z0-9][a-z0-9._]{2,19}$/;
const RESERVED = new Set(["admin", "booktracker", "support", "hilfe", "help", "profil", "einstellungen", "system", "root", "team"]);

/** Tippen in einen Benutzernamen umwandeln: klein, Umlaute ausgeschrieben, Leerzeichen als Unterstrich. */
export function normalizeHandle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 20);
}

/** Was am Benutzernamen nicht passt, oder null, wenn er gültig ist. */
export function handleProblem(h: string): string | null {
  if (!h) return "Bitte such dir einen Benutzernamen aus.";
  if (h.length < 3) return "Mindestens 3 Zeichen.";
  if (!/^[a-z0-9]/.test(h)) return "Vorne bitte ein Buchstabe oder eine Zahl.";
  if (!HANDLE_RE.test(h)) return "Erlaubt sind Buchstaben, Zahlen, Punkt und Unterstrich.";
  if (RESERVED.has(h)) return "Dieser Name ist für die App reserviert.";
  return null;
}

/** Vorschlag aus dem Anzeigenamen, z. B. „Larissa Z.“ → „larissa_z“. */
export function suggestHandle(name: string): string {
  return normalizeHandle(name).replace(/[._]+$/, "");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const SEASON: Record<number, string> = { 0: "Winter", 1: "Winter", 2: "Frühling", 3: "Frühling", 4: "Frühling", 5: "Sommer", 6: "Sommer", 7: "Sommer", 8: "Herbst", 9: "Herbst", 10: "Herbst", 11: "Winter" };

function top(m: Map<string, number>, n: number): string[] {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

/**
 * Lese-Persönlichkeit aus den eigenen Daten: Lieblingsgenres und Tropes, Reihen oder Einzelbände,
 * Buchdicke und die Jahreszeit, in der am meisten gelesen wird.
 */
export function readerProfile(entries: Entry[]) {
  const read = entries.filter((e) => e.mine.status === "gelesen");
  const genres = new Map<string, number>(), tropes = new Map<string, number>();
  for (const e of read) {
    if (e.book.genre) genres.set(e.book.genre, (genres.get(e.book.genre) ?? 0) + 1);
    // Gut bewertete Bücher zählen bei Tropes doppelt
    const w = (e.mine.rating ?? 0) >= 4 ? 2 : 1;
    for (const t of e.book.tropes ?? []) tropes.set(t, (tropes.get(t) ?? 0) + w);
  }
  const topGenres = top(genres, 3);
  const topTropes = top(tropes, 3);

  const seriesShare = read.length ? read.filter((e) => e.series).length / read.length : 0;
  const withPages = read.filter((e) => (e.book.pages ?? 0) > 0);
  const avgPages = withPages.length ? Math.round(withPages.reduce((s, e) => s + e.book.pages!, 0) / withPages.length) : 0;

  const seasons = new Map<string, number>();
  for (const x of readEvents(entries)) {
    const m = /^\d{4}-(\d{2})/.exec(x.r.finished_on ?? "");
    if (m) { const s = SEASON[Number(m[1]) - 1]; seasons.set(s, (seasons.get(s) ?? 0) + 1); }
  }
  const season = top(seasons, 1)[0];

  // Ein, zwei kurze Sätze in Du-Form
  const parts: string[] = [];
  if (topGenres.length) parts.push(`Am liebsten liest du ${topGenres.slice(0, 2).join(" und ")}.`);
  const likes: string[] = [];
  if (seriesShare >= 0.5) likes.push("lange Reihen");
  else if (read.length >= 10 && seriesShare < 0.25) likes.push("Einzelbände");
  if (avgPages >= 450) likes.push("dicke Bücher");
  else if (avgPages > 0 && avgPages < 260) likes.push("eher kurze Bücher");
  let s2 = likes.length ? `Du magst ${likes.join(" und ")}` : "";
  if (season) s2 = s2 ? `${s2}, und im ${season} liest du am meisten.` : `Im ${season} liest du am meisten.`;
  else if (s2) s2 += ".";
  if (s2) parts.push(s2);

  return { sentence: parts.join(" "), topGenres, topTropes, avgPages, seriesShare };
}
