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
/**
 * Feste Farbfamilien je Genre: Platzhaltercover und Buchrücken zeigen so auf einen Blick, was zusammengehört.
 * Jede Familie hat drei Abstufungen (hell, mittel, kräftig); welche ein Buch bekommt, hängt am Titel,
 * damit ein Brett voller Fantasy nicht einfarbig wirkt.
 */
type Shades = [string, string][];
const FAMILY: Record<string, Shades> = {
  lila: [["#EEE5FD", "#2A1A52"], ["#C2A7F1", "#2A1A52"], ["#6A47B8", "#FFFFFF"]],
  rosa: [["#FCE3EE", "#5A1A36"], ["#F4A8C7", "#5A1A36"], ["#B03A6C", "#FFFFFF"]],
  blau: [["#DDEFFA", "#15303C"], ["#8ACBF1", "#15303C"], ["#1E7EBE", "#FFFFFF"]],
  gruen: [["#DAF2E4", "#0F3D28"], ["#8FDCB4", "#0F3D28"], ["#22825A", "#FFFFFF"]],
  gelb: [["#FFF4CC", "#5A4200"], ["#F5D266", "#5A4200"], ["#C98F00", "#FFFFFF"]],
  petrol: [["#D7E6EA", "#1B3540"], ["#8FB3BE", "#14303A"], ["#2E5A68", "#FFFFFF"]],
  rot: [["#F6DCDC", "#5A1A1A"], ["#E39A9A", "#4A1414"], ["#8E2C3B", "#FFFFFF"]],
  sand: [["#F2EBDD", "#4A3B1E"], ["#DCCBA8", "#3E3014"], ["#9C7F4A", "#FFFFFF"]],
  grau: [["#EEF2F4", "#34434C"], ["#C9D3D9", "#26343C"], ["#5E6E78", "#FFFFFF"]]
};
export const GENRE_FAMILY: Record<string, keyof typeof FAMILY> = {
  "Fantasy": "lila", "Märchen & Sagen": "lila",
  "Romance": "rosa",
  "Sci Fi": "blau", "Roman": "blau",
  "Young Adult": "gruen", "Abenteuer": "gruen",
  "Historische Romane": "gelb",
  "Thriller": "petrol", "Krimi": "petrol", "Mystery": "petrol",
  "Horror": "rot"
};
/** Legende für die Genre-Farben (Name, Beispiel-Genre für die Farbe). */
export const GENRE_LEGEND: [string, string | null][] = [
  ["Fantasy, Märchen", "Fantasy"], ["Romance", "Romance"], ["Sci-Fi, Roman", "Sci Fi"], ["Young Adult, Abenteuer", "Young Adult"],
  ["Historisch", "Historische Romane"], ["Thriller, Krimi", "Thriller"], ["Horror", "Horror"], ["Sachbuch", "Sachbuch"], ["Ohne Genre", null]
];
/** Farbe, mit der eine Genre-Familie in Legenden gezeigt wird. */
export const familySwatch = (genre?: string | null) => FAMILY[genre ? GENRE_FAMILY[genre] ?? "sand" : "grau"][1][0];

export function genreColors(genre: string | null | undefined, seed: string): { bg: string; fg: string } {
  // Sachbücher (Kochen, Biografie, Reisen …) teilen sich die Sandtöne, Bücher ohne Genre sind grau
  const fam = FAMILY[genre ? GENRE_FAMILY[genre] ?? "sand" : "grau"];
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = fam[h % fam.length];
  return { bg, fg };
}

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
