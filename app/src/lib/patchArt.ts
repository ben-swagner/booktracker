/**
 * Zeichnungen der Patches im Stil „Talisman-Sticker“: mystische Motive mit Metallfaden (Farbe = Stufe),
 * Nachtblau, Orange, Creme und Rosa, ausgestanzt mit weißem Aufkleberrand.
 * Gibt ein fertiges SVG als Text zurück, damit es überall gleich aussieht.
 */

export type Metal = "bronze" | "silber" | "gold" | "platin" | "diamant" | "regenbogen";
export const TIER_METAL: Metal[] = ["gold", "bronze", "silber", "gold", "platin", "diamant", "regenbogen"];

const NAVY = "#1E2756", NAVY2 = "#2C3A78", ORANGE = "#F05A28", CREAM = "#F6EBDA", ROSE = "#EBA5BC", PLUM = "#6B2D5C";

const METALS: Record<Metal, { hi: string; mid: string; lo: string }> = {
  bronze: { hi: "#FFD2A8", mid: "#B8743A", lo: "#5E3212" },
  silber: { hi: "#FFFFFF", mid: "#B9C0C8", lo: "#5F6670" },
  gold: { hi: "#FFF0B8", mid: "#D9A63A", lo: "#7A5413" },
  platin: { hi: "#F2FBFF", mid: "#9FC3D6", lo: "#3F6578" },
  diamant: { hi: "#FFFFFF", mid: "#C9B8FF", lo: "#5A4AA8" },
  regenbogen: { hi: "#FFFFFF", mid: "#FFB3C7", lo: "#7A3FA0" }
};

const f = (n: number) => n.toFixed(1);
function star(cx: number, cy: number, R: number, r: number, n: number, rot = -90) {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180, rr = i % 2 ? r : R;
    d += (i ? "L" : "M") + f(cx + rr * Math.cos(a)) + "," + f(cy + rr * Math.sin(a));
  }
  return d + "Z";
}
const spark = (x: number, y: number, s: number, fill = CREAM) => `<path d="${star(x, y, s, s * 0.3, 4)}" fill="${fill}"/>`;

type Art = { sil: string; art: (m: string, id: number) => string };

/** Die Motive: sil = Umriss für den Aufkleberrand, art = die eigentliche Zeichnung. */
const MOTIFS: Record<string, Art> = {
  // Mondsichel auf Strahlenscheibe: Bücher in einem Monat
  monat: {
    sil: `<circle cx="70" cy="70" r="60"/>`,
    art: (m, id) => `<path d="${star(70, 70, 60, 50, 18)}" fill="${NAVY}"/><path d="${star(70, 70, 60, 50, 18)}" fill="url(#gr${id})"/>
      <path d="M86,24 A46,46 0 1,0 108,96 A36,36 0 1,1 86,24Z" fill="url(#mt${id})" stroke="${m}" stroke-width="1.2"/>
      ${spark(88, 52, 6)}${spark(98, 76, 4)}${spark(80, 96, 4.5)}`
  },
  // Bücherstapel: Bücher insgesamt
  gesamt: {
    sil: `<path d="M18,30 h104 v94 h-104z" transform="rotate(0)"/><circle cx="70" cy="18" r="10"/>`,
    art: (m, id) => {
      const b = (y: number, w: number, c: string, rot: number) => `<g transform="rotate(${rot} 70 ${y})"><rect x="${70 - w / 2}" y="${y - 10}" width="${w}" height="20" rx="3.5" fill="${c}"/><rect x="${70 - w / 2}" y="${y - 10}" width="${w}" height="20" rx="3.5" fill="url(#gr${id})"/><rect x="${70 - w / 2 + 9}" y="${y - 10}" width="5" height="20" fill="url(#mt${id})"/><rect x="${70 + w / 2 - 14}" y="${y - 10}" width="5" height="20" fill="url(#mt${id})"/></g>`;
      return `${b(112, 100, NAVY, -3)}${b(90, 90, ORANGE, 4)}${b(68, 96, ROSE, -4)}${b(46, 78, NAVY2, 3)}<path d="${star(70, 20, 9, 3, 4)}" fill="url(#mt${id})" stroke="${m}" stroke-width=".8"/>`;
    }
  },
  // Aufgeschlagenes Buch mit Sternen: Seiten
  seiten: {
    sil: `<path d="M10,58 C38,44 58,50 70,60 C82,50 102,44 130,58 L130,118 C102,108 82,112 70,124 C58,112 38,108 10,118Z"/><circle cx="70" cy="36" r="26"/>`,
    art: (_m, id) => `<circle cx="70" cy="40" r="24" fill="${NAVY}"/><circle cx="70" cy="40" r="24" fill="url(#gr${id})"/>${spark(70, 34, 10, "url(#mt" + id + ")")}${spark(56, 50, 4)}${spark(85, 48, 3.5)}
      <path d="M10,58 C38,44 58,50 70,60 C82,50 102,44 130,58 L130,118 C102,108 82,112 70,124 C58,112 38,108 10,118Z" fill="${CREAM}"/>
      <path d="M10,58 C38,44 58,50 70,60 V124 C58,112 38,108 10,118Z" fill="${ROSE}" opacity=".35"/>
      <path d="M70,60 V124" stroke="url(#mt${id})" stroke-width="3"/><path d="M10,58 C38,44 58,50 70,60 C82,50 102,44 130,58 L130,118 C102,108 82,112 70,124 C58,112 38,108 10,118Z" fill="none" stroke="url(#mt${id})" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M22,72 C36,66 50,68 60,74 M22,86 C36,80 50,82 60,88 M80,74 C90,68 104,66 118,72 M80,88 C90,82 104,80 118,86" stroke="${NAVY}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".45"/>`
  },
  // Schlüssel: Reihen beendet
  reihen: {
    sil: `<circle cx="70" cy="40" r="30"/><path d="M60,60 h20 v68 h-20z"/><path d="M76,96 h26 v26 h-26z"/>`,
    art: (m, id) => `<circle cx="70" cy="40" r="28" fill="url(#mt${id})" stroke="${m}" stroke-width="1.2"/><circle cx="70" cy="40" r="16" fill="${NAVY}"/><circle cx="70" cy="40" r="16" fill="url(#gr${id})"/>
      <path d="${star(70, 40, 9, 3.5, 4)}" fill="${ORANGE}"/>
      <path d="M63,66 h14 v58 h-14z" fill="url(#mt${id})" stroke="${m}" stroke-width="1.2"/><path d="M77,100 h22 v8 h-10 v10 h-12z" fill="url(#mt${id})" stroke="${m}" stroke-width="1.2"/>`
  },
  // Kerze: Lesewochen am Stück
  woche: {
    sil: `<path d="M70,6 C80,22 96,32 96,50 C96,62 88,68 86,70 L86,108 L112,112 C118,118 118,126 110,128 L30,128 C22,126 22,118 28,112 L54,108 L54,70 C52,68 44,62 44,50 C44,36 56,28 60,16 C64,26 66,30 70,32 C70,22 68,14 70,6Z"/>`,
    art: (m, id) => `<circle cx="70" cy="42" r="26" fill="${ORANGE}" opacity=".18"/>
      <path d="M70,8 C78,22 92,32 92,48 C92,60 82,68 70,68 C58,68 48,60 48,48 C48,36 58,30 60,18 C64,28 66,32 70,34 C70,24 68,16 70,8Z" fill="${ORANGE}"/>
      <path d="M70,32 C74,40 80,44 80,52 C80,60 75,64 70,64 C65,64 60,60 60,53 C60,47 65,44 66,38 C68,43 69,45 70,46Z" fill="${CREAM}"/>
      <path d="M56,70 h28 v40 h-28z" fill="${CREAM}"/><path d="M56,70 h28 v8 c-4,0 -4,10 -8,10 c-3,0 -3,-6 -6,-6 c-3,0 -3,12 -7,12 c-4,0 -3,-16 -7,-16z" fill="${ROSE}"/>
      <path d="M56,70 h28 v40 h-28z" fill="url(#gr${id})"/>
      <ellipse cx="70" cy="118" rx="44" ry="10" fill="url(#mt${id})" stroke="${m}" stroke-width="1.2"/>`
  },
  // Planet mit Ring: Genres entdeckt
  genres: {
    sil: `<circle cx="70" cy="70" r="44"/><ellipse cx="70" cy="74" rx="64" ry="20" transform="rotate(-18 70 74)"/>`,
    art: (_m, id) => `<circle cx="70" cy="70" r="40" fill="${PLUM}"/><path d="M34,56 C50,62 90,62 106,56 M30,72 C50,80 90,80 110,72 M36,88 C52,94 88,94 104,88" stroke="${ROSE}" stroke-width="5" fill="none" opacity=".6"/><circle cx="70" cy="70" r="40" fill="url(#gr${id})"/>
      <path d="M8,82 A64,20 0 0,0 132,66" transform="rotate(-18 70 74)" fill="none" stroke="url(#mt${id})" stroke-width="9" stroke-linecap="round"/>
      ${spark(32, 30, 6)}${spark(112, 108, 5)}`
  },
  // Schwerer Foliant mit Schließe: Wälzer
  dick: {
    sil: `<rect x="22" y="14" width="96" height="114" rx="10"/>`,
    art: (m, id) => `<rect x="28" y="18" width="88" height="106" rx="8" fill="${CREAM}"/><rect x="24" y="14" width="86" height="106" rx="8" fill="${PLUM}"/><rect x="24" y="14" width="86" height="106" rx="8" fill="url(#gr${id})"/>
      <rect x="30" y="20" width="74" height="94" rx="5" fill="none" stroke="url(#mt${id})" stroke-width="3"/>
      <path d="${star(67, 62, 22, 9, 8)}" fill="url(#mt${id})" stroke="${m}" stroke-width="1"/><circle cx="67" cy="62" r="7" fill="${ORANGE}"/>
      <path d="M104,56 h14 v18 h-14z" fill="url(#mt${id})" stroke="${m}" stroke-width="1"/>`
  },
  // Teetasse mit Dampf: Rereads
  reread: {
    sil: `<path d="M20,64 h86 c0,8 0,14 -2,20 c14,0 22,8 22,18 c0,12 -10,18 -26,16 c-8,8 -18,12 -30,12 c-22,0 -40,-14 -46,-34z"/><path d="M48,10 h44 v54 h-44z"/><ellipse cx="66" cy="124" rx="56" ry="8"/>`,
    art: (m, id) => `<path d="M52,58 C44,46 60,40 54,26 M70,58 C62,44 80,38 72,22 M88,58 C80,46 96,40 90,28" stroke="${CREAM}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".95"/>
      <ellipse cx="66" cy="122" rx="52" ry="7" fill="url(#mt${id})" stroke="${m}" stroke-width="1"/>
      <path d="M104,84 c14,0 20,8 20,16 c0,10 -10,16 -24,14" fill="none" stroke="url(#mt${id})" stroke-width="7" stroke-linecap="round"/>
      <path d="M22,64 h84 c0,30 -16,52 -42,52 c-26,0 -42,-22 -42,-52z" fill="${NAVY}"/><path d="M22,64 h84 c0,30 -16,52 -42,52 c-26,0 -42,-22 -42,-52z" fill="url(#gr${id})"/>
      <path d="M22,64 h84" stroke="url(#mt${id})" stroke-width="5" stroke-linecap="round"/>${spark(64, 90, 9, ROSE)}${spark(44, 80, 3.5)}${spark(84, 98, 3.5)}`
  },
  // Schreibfeder: Bücher von einer Person
  autor: {
    sil: `<path d="M112,10 C70,20 40,56 30,104 L22,126 L34,122 C60,104 96,74 116,26Z"/><circle cx="34" cy="116" r="14"/>`,
    art: (m, id) => `<path d="M112,10 C72,22 44,56 32,102 C60,90 92,62 112,10Z" fill="${CREAM}"/><path d="M112,10 C72,22 44,56 32,102 C60,90 92,62 112,10Z" fill="url(#gr${id})"/>
      <path d="M112,10 C84,40 58,72 32,102" stroke="url(#mt${id})" stroke-width="3.5" fill="none"/><path d="M60,60 l12,10 M74,44 l12,10 M48,78 l10,8" stroke="${ROSE}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M32,102 L22,126 L40,112Z" fill="url(#mt${id})" stroke="${m}" stroke-width="1"/><circle cx="26" cy="124" r="5" fill="${NAVY}"/>`
  },
  // Flammendes Herz: Buddy Reads
  buddy: {
    sil: `<path d="M70,126 C20,96 10,70 20,52 C30,34 54,36 62,46 L60,10 C72,24 80,30 80,46 C90,36 112,36 120,54 C128,72 116,98 70,126Z"/>`,
    art: (_m, id) => `<path d="M70,6 C80,18 88,26 86,40 C84,48 78,50 72,50 C64,50 58,44 60,36 C62,28 70,22 70,6Z" fill="${ORANGE}"/><path d="M72,24 C76,30 78,34 76,40 C74,44 70,44 68,42 C66,38 70,32 72,24Z" fill="${CREAM}"/>
      <path d="M70,124 C22,96 12,72 22,54 C32,36 58,38 70,54 C82,38 108,36 118,54 C128,72 118,96 70,124Z" fill="${ROSE}"/><path d="M70,124 C22,96 12,72 22,54 C32,36 58,38 70,54 C82,38 108,36 118,54 C128,72 118,96 70,124Z" fill="url(#gr${id})"/>
      <path d="M70,124 C22,96 12,72 22,54 C32,36 58,38 70,54 C82,38 108,36 118,54 C128,72 118,96 70,124Z" fill="none" stroke="url(#mt${id})" stroke-width="4" stroke-linejoin="round"/>
      <path d="M44,80 C52,70 62,70 70,80 C78,70 88,70 96,80 C88,92 78,96 70,100 C62,96 52,92 44,80Z" fill="${NAVY}"/>${spark(70, 84, 7, "url(#mt" + id + ")")}`
  },
  // Herzschloss: Kaufstopp
  kaufstopp: {
    sil: `<path d="M38,58 V44 a32,32 0 0,1 64,0 V58 h8 C126,74 120,100 70,128 C20,100 14,74 30,58Z"/>`,
    art: (_m, id) => `<path d="M44,62 V46 a26,26 0 0,1 52,0 V62" fill="none" stroke="url(#mt${id})" stroke-width="10" stroke-linecap="round"/>
      <path d="M70,126 C22,100 14,78 24,62 C34,48 58,50 70,64 C82,50 106,48 116,62 C126,78 118,100 70,126Z" fill="${ORANGE}"/><path d="M70,126 C22,100 14,78 24,62 C34,48 58,50 70,64 C82,50 106,48 116,62 C126,78 118,100 70,126Z" fill="url(#gr${id})"/>
      <circle cx="70" cy="86" r="8" fill="${NAVY}"/><path d="M66,90 h8 l3,16 h-14z" fill="${NAVY}"/>${spark(46, 76, 5)}${spark(96, 74, 4)}`
  },
  // Vierzackiger Stern mit Auge: Jahresziel
  jahresziel: {
    sil: `<path d="${star(70, 70, 66, 26, 4)}"/><circle cx="70" cy="70" r="34"/>`,
    art: (m, id) => `<path d="${star(70, 70, 66, 22, 4)}" fill="url(#mt${id})" stroke="${m}" stroke-width="1.2"/><path d="${star(70, 70, 50, 20, 4, -45)}" fill="url(#mt${id})" stroke="${m}" stroke-width="1"/>
      <circle cx="70" cy="70" r="24" fill="${NAVY}"/><circle cx="70" cy="70" r="24" fill="url(#gr${id})"/>
      <path d="M52,70 C60,60 80,60 88,70 C80,80 60,80 52,70Z" fill="${CREAM}"/><circle cx="70" cy="70" r="7" fill="${ORANGE}"/><circle cx="70" cy="70" r="3" fill="${NAVY}"/><circle cx="72" cy="68" r="1.5" fill="#fff"/>
      <circle cx="70" cy="70" r="24" fill="none" stroke="url(#mt${id})" stroke-width="3"/>`
  },
  // Sonne mit zwölf Strahlen: Lesejahr komplett
  ganzjahr: {
    sil: `<circle cx="70" cy="70" r="62"/>`,
    art: (m, id) => `${Array.from({ length: 12 }, (_, i) => { const a = (i * 30 * Math.PI) / 180; return `<path d="M${f(70 + 30 * Math.cos(a - 0.2))},${f(70 + 30 * Math.sin(a - 0.2))} L${f(70 + 62 * Math.cos(a))},${f(70 + 62 * Math.sin(a))} L${f(70 + 30 * Math.cos(a + 0.2))},${f(70 + 30 * Math.sin(a + 0.2))}Z" fill="url(#mt${id})" stroke="${m}" stroke-width="1"/>`; }).join("")}
      <circle cx="70" cy="70" r="32" fill="${ORANGE}"/><circle cx="70" cy="70" r="32" fill="url(#gr${id})"/>
      <path d="M56,66 q5,-5 10,0 M74,66 q5,-5 10,0" stroke="${NAVY}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M60,80 q10,8 20,0" stroke="${NAVY}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="70" cy="70" r="32" fill="none" stroke="url(#mt${id})" stroke-width="3"/>`
  },
  // Sanduhr: SuB-Ziel
  sub: {
    sil: `<path d="M28,10 h84 v14 c0,22 -26,34 -26,46 c0,12 26,24 26,46 v14 h-84 v-14 c0,-22 26,-34 26,-46 c0,-12 -26,-24 -26,-46z"/>`,
    art: (m, id) => `<path d="M38,22 c0,20 24,34 24,48 c0,14 -24,28 -24,48 h64 c0,-20 -24,-34 -24,-48 c0,-14 24,-28 24,-48z" fill="${CREAM}"/>
      <path d="M50,32 h40 c-4,10 -14,18 -20,24 c-6,-6 -16,-14 -20,-24z" fill="${ORANGE}"/><path d="M44,116 c4,-14 16,-22 26,-26 c10,4 22,12 26,26z" fill="${ORANGE}"/><path d="M70,58 v34" stroke="${ORANGE}" stroke-width="2.5"/>
      <path d="M38,22 c0,20 24,34 24,48 c0,14 -24,28 -24,48 h64 c0,-20 -24,-34 -24,-48 c0,-14 24,-28 24,-48z" fill="url(#gr${id})"/>
      <rect x="28" y="12" width="84" height="12" rx="4" fill="url(#mt${id})" stroke="${m}" stroke-width="1"/><rect x="28" y="116" width="84" height="12" rx="4" fill="url(#mt${id})" stroke="${m}" stroke-width="1"/>`
  },
  // Tarotkarte: Bingo
  bingo: {
    sil: `<rect x="26" y="8" width="88" height="124" rx="10"/>`,
    art: (_m, id) => `<rect x="30" y="12" width="80" height="116" rx="8" fill="${NAVY}"/><rect x="30" y="12" width="80" height="116" rx="8" fill="url(#gr${id})"/>
      <rect x="36" y="18" width="68" height="104" rx="5" fill="none" stroke="url(#mt${id})" stroke-width="2.5"/>
      ${[0, 1, 2].map((r) => [0, 1, 2].map((c) => `<path d="${star(52 + c * 18, 50 + r * 18, 6, 2.2, 4)}" fill="${r === 1 && c === 1 ? ORANGE : "url(#mt" + id + ")"}"/>`).join("")).join("")}
      <path d="M50,106 h40" stroke="${ROSE}" stroke-width="3" stroke-linecap="round"/>`
  },
  // Schriftrolle: Listen-Challenge
  liste: {
    sil: `<path d="M22,24 h96 v14 h-8 v74 h8 v14 h-96 v-14 h8 v-74 h-8z"/>`,
    art: (m, id) => `<rect x="34" y="30" width="72" height="84" fill="${CREAM}"/><rect x="34" y="30" width="72" height="84" fill="url(#gr${id})"/>
      ${[48, 62, 76, 90].map((y, i) => `<circle cx="46" cy="${y}" r="3.5" fill="${i < 3 ? ORANGE : "none"}" stroke="${ORANGE}" stroke-width="1.5"/><path d="M56,${y} h${36 - i * 4}" stroke="${NAVY}" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>`).join("")}
      <rect x="24" y="24" width="92" height="12" rx="6" fill="url(#mt${id})" stroke="${m}" stroke-width="1"/><rect x="24" y="108" width="92" height="12" rx="6" fill="url(#mt${id})" stroke="${m}" stroke-width="1"/>`
  }
};
export const MOTIF_FAMILIES = Object.keys(MOTIFS);

let counter = 0;
/** SVG-Text für einen Patch. locked = noch nicht erreicht (leerer Platz im Stickeralbum). */
export function patchSvg(family: string, metal: Metal, locked = false): string {
  const mo = MOTIFS[family] ?? MOTIFS.jahresziel;
  const id = ++counter;
  const M = METALS[metal];
  const metalFill = metal === "regenbogen"
    ? `<pattern id="mt${id}" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(55)"><rect width="3" height="18" fill="#FF8FA8"/><rect x="3" width="3" height="18" fill="#FFC27A"/><rect x="6" width="3" height="18" fill="#FFE98A"/><rect x="9" width="3" height="18" fill="#8FE0B0"/><rect x="12" width="3" height="18" fill="#8CC8FF"/><rect x="15" width="3" height="18" fill="#C3A6FF"/></pattern>`
    : metal === "diamant"
      ? `<pattern id="mt${id}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#DCD2FF"/><rect width="3" height="8" fill="#FFFFFF"/><rect x="5" width="1.5" height="8" fill="#9FE6F0"/><rect x="6.5" width="1.5" height="8" fill="#FFC7E6"/></pattern>`
      : `<pattern id="mt${id}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(60)"><rect width="4" height="4" fill="${M.mid}"/><rect width="1.6" height="4" fill="${M.hi}"/><rect x="3.2" width=".8" height="4" fill="${M.lo}"/></pattern>`;
  const defs = `<defs>${metalFill}
    <filter id="g${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="${id % 50}"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .32 -.05"/></filter>
    <pattern id="gr${id}" width="140" height="140" patternUnits="userSpaceOnUse"><rect width="140" height="140" filter="url(#g${id})"/></pattern>
    <filter id="sh${id}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#3A2030" flood-opacity=".28"/></filter></defs>`;
  if (locked) {
    return `<svg viewBox="-6 -6 152 152" xmlns="http://www.w3.org/2000/svg">${defs}
      <g fill="rgba(23,21,26,.04)" stroke="rgba(23,21,26,.28)" stroke-width="2.5" stroke-dasharray="6 5" stroke-linejoin="round">${mo.sil}</g>
      <g opacity=".22" style="filter:grayscale(1)">${mo.art(M.lo, id)}</g></svg>`;
  }
  return `<svg viewBox="-6 -6 152 152" xmlns="http://www.w3.org/2000/svg">${defs}
    <g filter="url(#sh${id})"><g fill="#fff" stroke="#fff" stroke-width="16" stroke-linejoin="round">${mo.sil}</g></g>
    ${mo.art(M.lo, id)}</svg>`;
}
