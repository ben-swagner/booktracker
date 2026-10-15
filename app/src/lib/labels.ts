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
  lila: [["#ECE9FA", "#2E2470"], ["#B9B3F0", "#241B5C"], ["#5B45A8", "#FFFFFF"]],
  rosa: [["#FBE6EE", "#5A1E36"], ["#F3B0C8", "#5A1E36"], ["#B23A64", "#FFFFFF"]],
  blau: [["#E6EBFB", "#1E2F6E"], ["#9DB2F2", "#16255A"], ["#3552C9", "#FFFFFF"]],
  gruen: [["#E2F0E6", "#1F4630"], ["#A9D3B5", "#1A3D29"], ["#2F7A5A", "#FFFFFF"]],
  gelb: [["#FBF2D6", "#5A4510"], ["#F4E2A0", "#5A4510"], ["#B7861F", "#FFFFFF"]],
  petrol: [["#DCEDEB", "#1B3B3A"], ["#9FCFC7", "#163533"], ["#2F6E6A", "#FFFFFF"]],
  rot: [["#F8DEDF", "#5A1A22"], ["#EBA0A8", "#4A141B"], ["#9E2F45", "#FFFFFF"]],
  sand: [["#FBE7DB", "#5A2E14"], ["#F8C7A4", "#6A3418"], ["#C2652F", "#FFFFFF"]],
  grau: [["#F0EFF2", "#3B3740"], ["#D3D0D8", "#2E2B33"], ["#6B6670", "#FFFFFF"]]
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
    ["#E6EBFB", "#1E2F6E"], ["#ECE9FA", "#2E2470"], ["#FBE6EE", "#5A1E36"], ["#FBF2D6", "#5A4510"], ["#E2F0E6", "#1F4630"],
    ["#3552C9", "#FFFFFF"], ["#5B45A8", "#FFFFFF"], ["#B23A64", "#FFFFFF"], ["#C2652F", "#FFFFFF"], ["#2F7A5A", "#FFFFFF"],
    ["#9DB2F2", "#16255A"], ["#B9B3F0", "#241B5C"], ["#F3B0C8", "#5A1E36"], ["#F4E2A0", "#5A4510"], ["#A9D3B5", "#1A3D29"]
  ];
  const [bg, fg] = palettes[h % palettes.length];
  return { bg, fg };
}

/** Drei Töne (kräftig, mittel, hell) der Genre-Familie, z. B. für die Farbwolke hinter einem Buch ohne Bild. */
export function familyTones(genre: string | null | undefined): [string, string, string] {
  const fam = FAMILY[genre ? GENRE_FAMILY[genre] ?? "sand" : "grau"];
  return [fam[2][0], fam[1][0], fam[0][0]];
}

/**
 * Farbwolke für ein Platzhaltercover: drei Töne der Genre-Familie, Lage der Wolke je Titel leicht anders,
 * damit nicht jedes Fantasy-Buch gleich aussieht. Oben hell (Titel gut lesbar), unten kräftig.
 */
export function genreCloud(genre: string | null | undefined, seed: string): { bg: string; fg: string; fg2: string } {
  const fam = FAMILY[genre ? GENRE_FAMILY[genre] ?? "sand" : "grau"];
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const x = 20 + (h % 61);           // 20 % bis 80 %
  const w = 110 + ((h >> 3) % 50);   // Breite der Wolke
  const mid = 38 + ((h >> 7) % 18);  // wo der mittlere Ton liegt
  const bg = `radial-gradient(${w}% 90% at ${x}% 108%, ${fam[2][0]} 0%, ${fam[1][0]} ${mid}%, ${fam[0][0]} 88%)`;
  return { bg, fg: fam[0][1], fg2: "#FFFFFF" };
}
