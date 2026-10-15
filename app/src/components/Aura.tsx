import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { familyTones } from "../lib/labels";
import { NO_COVER } from "../lib/covers";
import { olCoverUrl } from "./ui";

type Tones = [string, string, string];

/** Gemerkte Farben je Bildadresse, damit ein Cover nur einmal ausgewertet wird. */
const cache = new Map<string, Tones | null>();

const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/**
 * Liest die Farben eines Coverbilds aus: die kräftigste Farbe, die Durchschnittsfarbe und eine helle Mischung.
 * Klappt das nicht (Bild fehlt oder der Server erlaubt das Auslesen nicht), bleibt es bei den Genre-Farben.
 */
function readTones(src: string): Promise<Tones | null> {
  if (cache.has(src)) return Promise.resolve(cache.get(src)!);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        if (img.naturalWidth <= 1) throw new Error("leer");
        const c = document.createElement("canvas");
        c.width = 24; c.height = 36;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, 24, 36);
        const px = ctx.getImageData(0, 0, 24, 36).data;
        let sr = 0, sg = 0, sb = 0, n = 0, best = -1, vivid: [number, number, number] = [0, 0, 0];
        for (let i = 0; i < px.length; i += 4) {
          const r = px[i], g = px[i + 1], b = px[i + 2];
          sr += r; sg += g; sb += b; n++;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const score = sat * (0.35 + max / 255);
          if (score > best) { best = score; vivid = [r, g, b]; }
        }
        const avg: [number, number, number] = [sr / n, sg / n, sb / n];
        const light = avg.map((v) => v + (255 - v) * 0.7) as [number, number, number];
        const tones: Tones = [hex(...vivid), hex(...avg.map((v, i) => (v + vivid[i]) / 2) as [number, number, number]), hex(...light)];
        cache.set(src, tones);
        resolve(tones);
      } catch {
        cache.set(src, null);
        resolve(null);
      }
    };
    img.onerror = () => { cache.set(src, null); resolve(null); };
    img.src = src;
  });
}

/** Farben für ein Buch: aus dem Cover, sonst aus der Genre-Familie (wie die Platzhaltercover). */
export function useBookTones(book?: { cover_url?: string | null; isbn13?: string | null; genre?: string | null } | null): Tones {
  const fallback = familyTones(book?.genre ?? null);
  const src = !book ? null : book.cover_url && book.cover_url !== NO_COVER ? book.cover_url : book.cover_url !== NO_COVER && book.isbn13 ? olCoverUrl(book.isbn13, "S") : null;
  const [tones, setTones] = useState<Tones | null>(src ? cache.get(src) ?? null : null);
  useEffect(() => {
    let alive = true;
    if (!src) { setTones(null); return; }
    readTones(src).then((t) => { if (alive) setTones(t); });
    return () => { alive = false; };
  }, [src]);
  return tones ?? fallback;
}

/**
 * Weiche, körnige Farbwolke hinter einer Seite, mit mehreren Farben ineinander (wie im Entwurf).
 * `light`: fünf Farben von der Mitte nach außen für den hellen Modus, `dark`: dasselbe für den dunklen.
 * Ohne `inline` liegt sie oben über die ganze Fensterbreite, mit `inline` füllt sie den oberen Teil des umgebenden Kastens.
 */
export function Aura({ tones, dark, inline, soft }: { tones: string[]; dark?: string[]; inline?: boolean; soft?: boolean }) {
  const id = useId().replace(/:/g, "");
  const l = [...tones, ...LILAC_BLUE].slice(0, 5);
  const d = dark ? [...dark, ...LILAC_BLUE_DARK].slice(0, 5) : [tones[2] ?? tones[0], tones[1] ?? tones[0], tones[0], ...LILAC_BLUE_DARK];
  const vars: Record<string, string> = {};
  l.forEach((c, i) => { vars[`--a${i + 1}`] = c; });
  d.forEach((c, i) => { vars[`--d${i + 1}`] = c; });
  const el = (
    <div className={"aura" + (inline ? " inline" : "") + (soft ? " soft" : "")} aria-hidden="true" style={vars}>
      <div className="aura-fill" />
      <svg><filter id={"korn" + id}><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter={`url(#korn${id})`} /></svg>
      <div className="aura-fade" />
    </div>
  );
  return inline ? el : createPortal(el, document.body);
}

/** Außenfarben, damit auch eine Buchwolke nicht einfarbig ist: zu Lavendel und Blau hin. */
const LILAC_BLUE = ["#ABA7EC", "#9AA3DA"];
const LILAC_BLUE_DARK = ["#9D7FD8", "#4F6FB8"];

/** Farbwolken für die übrigen Seiten, je Seite etwas anders gemischt (hell, dunkel). */
const PAGE_AURA: Record<string, [string[], string[]]> = {
  bibliothek: [["#F3A7B5", "#F8C7A4", "#F4E2A0", "#B9B3F0", "#9DB2F2"], ["#F4E2A0", "#F8B48E", "#F3A7B5", "#9D7FD8", "#4F6FB8"]],
  regal: [["#FF8547", "#F8B48E", "#ECC3C8", "#ABA7EC", "#9AA3DA"], ["#F8B48E", "#F3A7B5", "#B98ADB", "#6F5BD0", "#3E5FB0"]],
  sub: [["#B9B3F0", "#F3B0C8", "#F8C7A4", "#F4E2A0", "#E2EAF8"], ["#F3A7B5", "#C79BE0", "#7F6FD8", "#4F6FB8", "#2F4F8A"]],
  ziele: [["#9DB2F2", "#B9B3F0", "#F3B0C8", "#F8C7A4", "#F4E2A0"], ["#9DB2F2", "#9D7FD8", "#C77FB0", "#F3A7B5", "#4F6FB8"]],
  wunschliste: [["#F4E2A0", "#F8C7A4", "#F3A7B5", "#B9B3F0", "#9DB2F2"], ["#F4E2A0", "#F8B48E", "#E07FA0", "#9D7FD8", "#4F6FB8"]],
  statistik: [["#FF8547", "#F8B48E", "#ECC3C8", "#ABA7EC", "#9AA3DA"], ["#F4E2A0", "#F8B48E", "#F3A7B5", "#9D7FD8", "#4F6FB8"]],
  reihen: [["#A9D3B5", "#F4E2A0", "#F8C7A4", "#F3B0C8", "#B9B3F0"], ["#A9D3B5", "#E6CF7A", "#F8B48E", "#C77FB0", "#6F5BD0"]],
  autorinnen: [["#F3B0C8", "#B9B3F0", "#9DB2F2", "#A9D3B5", "#F4E2A0"], ["#F3A7B5", "#9D7FD8", "#4F6FB8", "#3E8E6E", "#2F4F6A"]],
  tops: [["#F4E2A0", "#F8C7A4", "#FF8547", "#F3B0C8", "#B9B3F0"], ["#F4E2A0", "#F8B48E", "#FF8547", "#C77FB0", "#6F5BD0"]],
  standard: [["#F8C7A4", "#F3B0C8", "#B9B3F0", "#9DB2F2", "#E2EAF8"], ["#F8B48E", "#F3A7B5", "#9D7FD8", "#4F6FB8", "#2F3F7A"]],
};

/** Farbwolke oben auf einer Seite ohne eigenes Buch (Bibliothek, Statistik, Ziele …). */
export function PageAura({ page }: { page: string }) {
  const [l, d] = PAGE_AURA[page] ?? PAGE_AURA.standard;
  return <Aura tones={l} dark={d} soft />;
}

/** Farbwolke passend zu einem Buch (Cover oder Genre). */
export function BookAura({ book, inline }: { book?: { cover_url?: string | null; isbn13?: string | null; genre?: string | null } | null; inline?: boolean }) {
  const tones = useBookTones(book);
  return <Aura tones={tones} inline={inline} />;
}
