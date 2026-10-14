import type { ReadingStatus, Verdict } from "../data/types";

export const STATUS: Record<ReadingStatus, string> = {
  lese: "Am Lesen",
  tbr: "SuB",
  ungelesen: "Ungelesen",
  gelesen: "Gelesen",
  abgebrochen: "Abgebrochen",
  wunschliste: "Wunschliste"
};
export const STATUS_ORDER: ReadingStatus[] = ["lese", "tbr", "ungelesen", "gelesen", "abgebrochen"];

export const VERDICT: Record<Verdict, string> = {
  love: "Love", like: "Like", middle: "Mittel", dislike: "Dislike", hate: "Hate", idk: "Weiß nicht"
};
export const EXPECTATION = { uebertroffen: "Übertroffen", erfuellt: "Erfüllt", untertroffen: "Untertroffen" } as const;
export const BURN = { no: "No Burn", slow: "Slow Burn", fast: "Fast Burn" } as const;
export const COMPANY = { solo: "Solo", buddy: "Buddy Read", group: "Gruppe" } as const;
export const KINDS = ["Buch", "Manga", "Manhwa", "Kurzgeschichte", "Graphic Novel", "Kinderbuch", "Bildband", "Comic", "Magazin", "Sonstiges"];
export const AUDIENCE = { Child: "Kinder (3-12)", Teen: "Teen (12-17)", YA: "YA (14-20)", NA: "NA (18-30)", Adult: "Adult (25+)" } as const;
export const PERIODS = ["Gegenwart", "Vergangenheit", "Zukunft", "Unbestimmt"];
export const MEDIA = ["Print", "Digital", "Audiobook"];
export const FORMATS = ["Hardcover", "Taschenbuch", "Paperback", "eBook"];

export function spiceLabel(n?: number | null) {
  if (n == null) return "";
  return n === 0 ? "🥛" : "🌶️".repeat(n);
}

export function euro(cents?: number | null) {
  if (cents == null) return "";
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export function fmtDate(iso?: string | null, text?: string | null) {
  if (iso) {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }
  return text ?? "";
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Farbe für einen Stoffeinband, abhängig vom Titel (wie in V1) */
export function coverColors(seed: string): { bg: string; fg: string } {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const palettes = [
    ["#DDEFFA", "#15303C"], ["#EEE5FD", "#2A1A52"], ["#FCE3EE", "#5A1A36"], ["#FFF4CC", "#5A4200"], ["#DAF2E4", "#0F3D28"],
    ["#1E7EBE", "#FFFFFF"], ["#6A47B8", "#FFFFFF"], ["#B03A6C", "#FFFFFF"], ["#C98F00", "#FFFFFF"], ["#22825A", "#FFFFFF"],
    ["#8ACBF1", "#15303C"], ["#C2A7F1", "#2A1A52"], ["#F4A8C7", "#5A1A36"], ["#F5D266", "#5A4200"], ["#8FDCB4", "#0F3D28"]
  ];
  const [bg, fg] = palettes[h % palettes.length];
  return { bg, fg };
}
