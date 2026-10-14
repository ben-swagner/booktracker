import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Author, Entry } from "../data/types";
import { data } from "../data";
import { useEntries, useSaveAuthor } from "../data/hooks";
import { cachedAuthorPhoto, findAuthorPhoto } from "../lib/authorPhotos";
import { Cover, Stars, StatusPill } from "./ui";
import { isDesktop, useOpenBook } from "./openBook";
import { Icon } from "./Icon";

export type AuthorRow = { author: Author; books: Entry[]; read: number; avg: number | null; pagesRead: number; tbr: number; series: { name: string; n: number }[] };

/** Farben der Autor:innen-Karten nach Geschlecht: kräftig für Kopfband, hell für Initialen. */
export const GENDER_COLOR: Record<string, { band: string; soft: string; fg: string; label: string }> = {
  weiblich: { band: "#C2A7F1", soft: "#EEE5FD", fg: "#2A1A52", label: "Weiblich" },
  maennlich: { band: "#8ACBF1", soft: "#DDEFFA", fg: "#15303C", label: "Männlich" },
  divers: { band: "#F5D266", soft: "#FFF4CC", fg: "#5A4200", label: "Divers" },
  mehrere: { band: "#8FDCB4", soft: "#DAF2E4", fg: "#0F3D28", label: "Duo oder Team" },
  unbekannt: { band: "#C9D3D9", soft: "#EEF2F4", fg: "#34434C", label: "Noch nicht eingetragen" }
};
export const genderColor = (g?: string | null) => GENDER_COLOR[g ?? "unbekannt"] ?? GENDER_COLOR.unbekannt;

export const GENDER: Record<string, string> = { weiblich: "weiblich", maennlich: "männlich", divers: "divers", mehrere: "Duo oder Team", unbekannt: "" };

/** Alle Autor:innen mit ihren Büchern und Kennzahlen. */
export function authorRows(entries: Entry[]): AuthorRow[] {
  const by = new Map<string, AuthorRow>();
  for (const e of entries) for (const a of e.authors) {
    let r = by.get(a.id);
    if (!r) { r = { author: a, books: [], read: 0, avg: null, pagesRead: 0, tbr: 0, series: [] }; by.set(a.id, r); }
    r.books.push(e);
  }
  for (const r of by.values()) {
    const read = r.books.filter((e) => e.mine.status === "gelesen");
    r.read = read.length;
    r.pagesRead = read.reduce((s, e) => s + (e.book.pages ?? 0), 0);
    r.tbr = r.books.filter((e) => e.mine.status === "tbr" || e.mine.status === "ungelesen").length;
    const rated = r.books.filter((e) => e.mine.rating != null);
    r.avg = rated.length ? rated.reduce((s, e) => s + (e.mine.rating ?? 0), 0) / rated.length : null;
    const ser = new Map<string, number>();
    for (const e of r.books) if (e.series) ser.set(e.series.name, (ser.get(e.series.name) ?? 0) + 1);
    r.series = [...ser.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
    r.books.sort((a, b) => (a.series?.name ?? "zzz").localeCompare(b.series?.name ?? "zzz", "de") || (Number(a.book.series_number) || 0) - (Number(b.book.series_number) || 0) || a.book.title.localeCompare(b.book.title, "de"));
  }
  return [...by.values()];
}

const initials = (name: string) => name.split(/\s+/).filter((w) => /^[A-Za-zÀ-ÿ]/.test(w)).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

/** Rundes Foto der Autor:in. Fehlt ein Foto, wird es gesucht, sobald das Bild sichtbar wird; sonst Initialen. */
export function AuthorPhoto({ author, size = 64 }: { author: Author; size?: number }) {
  const [src, setSrc] = useState<string | null>(author.photo_url ?? cachedAuthorPhoto(author.name) ?? null);
  const ref = useRef<HTMLDivElement>(null);
  const gc = genderColor(author.gender);
  const c = { bg: gc.soft, fg: gc.fg };

  useEffect(() => {
    if (src || author.photo_url || cachedAuthorPhoto(author.name) !== undefined) return;
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      findAuthorPhoto(author.name).then((url) => {
        if (!alive || !url) return;
        setSrc(url);
        data.saveAuthorPhoto(author.id, url).catch(() => {});
      });
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => { alive = false; io.disconnect(); };
  }, [author.id, author.name, author.photo_url, src]);

  return (
    <div ref={ref} className="aphoto" style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: size * 0.34 }} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setSrc(null)} /> : initials(author.name)}
    </div>
  );
}

/** Autor:in öffnen: als Fenster über der aktuellen Seite (Merker ?autor=<slug>, damit „Zurück“ es schließt). */
export function useOpenAuthor() {
  const [params, setParams] = useSearchParams();
  return (slug: string) => {
    const p = new URLSearchParams(params);
    p.delete("buch");
    p.set("autor", slug);
    setParams(p, { state: { authorModal: true } });
  };
}

/** Karte für die Rasteransicht. */
export function AuthorCard({ r, onOpen }: { r: AuthorRow; onOpen: () => void }) {
  const c = { bg: genderColor(r.author.gender).band };
  const pct = r.books.length ? Math.round((r.read / r.books.length) * 100) : 0;
  const meta = [r.author.country, GENDER[r.author.gender ?? ""] || null].filter(Boolean).join(" · ");
  const shown = r.books.slice(0, 4);
  return (
    <button type="button" className="acard" onClick={onOpen} style={{ ["--ac" as any]: c.bg }}>
      <div className="acard-top">
        <AuthorPhoto author={r.author} size={68} />
        <div className="acard-id">
          <strong className="acard-name">{r.author.name}</strong>
          {meta && <span className="acard-meta">{meta}</span>}
          {r.avg != null && <span className="acard-meta"><Stars value={r.avg} /> {r.avg.toFixed(1)}</span>}
        </div>
      </div>
      <div className="acard-covers">
        {shown.map((e) => (
          <span key={e.mine.id} className="acard-cover"><Cover title={e.book.title} url={e.book.cover_url} isbn={e.book.isbn13} bookId={e.book.id} genre={e.book.genre} /></span>
        ))}
        {r.books.length > shown.length && <span className="acard-more">+{r.books.length - shown.length}</span>}
      </div>
      <div className="acard-foot">
        <span className="acard-count"><Icon name="book" size={15} />{r.books.length} {r.books.length === 1 ? "Buch" : "Bücher"}</span>
        <span className="acard-count"><Icon name="check" size={15} />{r.read} gelesen</span>
        <div className="acard-bar" title={`${pct} % gelesen`}><div style={{ width: `${pct}%` }} /></div>
      </div>
    </button>
  );
}

/** Das Fenster mit allen Infos zu einer Autor:in. Liegt einmal in der App und reagiert auf ?autor=<slug>. */
export function AuthorModal() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const slug = params.get("autor");
  const bookOpen = !!params.get("buch");
  const { entries } = useEntries();
  const openBook = useOpenBook();
  const saveAuthor = useSaveAuthor();
  const r = useMemo(() => (slug ? authorRows(entries.filter((e) => e.authors.some((a) => a.slug === slug))).find((x) => x.author.slug === slug) : undefined), [entries, slug]);

  const close = () => {
    if (window.history.state?.usr?.authorModal) { nav(-1); return; }
    const p = new URLSearchParams(params);
    p.delete("autor");
    setParams(p, { replace: true });
  };

  useEffect(() => {
    if (!slug) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !new URLSearchParams(window.location.search).get("buch")) close(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (!slug) return null;
  return (
    <div className="bm-backdrop" style={bookOpen ? { visibility: "hidden" } : undefined} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="bm am" role="dialog" aria-modal="true" aria-label="Autor:in">
        <button className="bm-close" onClick={close} aria-label="Schließen" title="Schließen (Esc)">×</button>
        {!r ? <p className="muted">Diese Autor:in steht nicht in deinem Regal.</p> : (
          <>
            <header className="am-head" style={{ ["--ac" as any]: genderColor(r.author.gender).band }}>
              <AuthorPhoto author={r.author} size={120} />
              <div className="am-id">
                <h2>{r.author.name}</h2>
                <div className="am-meta">
                  {r.author.country && <span className="muted">{r.author.country}</span>}
                  <select className="input am-gender" value={r.author.gender ?? "unbekannt"} aria-label="Geschlecht"
                    onChange={(ev) => saveAuthor.mutate({ id: r.author.id, gender: ev.target.value })}>
                    {Object.entries(GENDER_COLOR).map(([k, c]) => <option key={k} value={k}>{k === "unbekannt" ? "Geschlecht eintragen" : c.label}</option>)}
                  </select>
                </div>
                <div className="gchips">
                  <span className="gchip"><Icon name="book" size={16} />Im Regal <strong>{r.books.length}</strong></span>
                  <span className="gchip"><Icon name="check" size={16} />Gelesen <strong>{r.read}</strong></span>
                  {r.tbr > 0 && <span className="gchip"><Icon name="books" size={16} />Noch ungelesen <strong>{r.tbr}</strong></span>}
                  {r.pagesRead > 0 && <span className="gchip"><Icon name="stack" size={16} />Seiten gelesen <strong>{r.pagesRead.toLocaleString("de-DE")}</strong></span>}
                  {r.avg != null && <span className="gchip"><Stars value={r.avg} /> <strong>{r.avg.toFixed(1)}</strong></span>}
                </div>
              </div>
            </header>
            {r.series.length > 0 && (
              <div className="am-series">
                <span className="gcard-kicker">Reihen</span>
                <div className="chips">{r.series.map((s) => <span key={s.name} className="chip">{s.name} <span className="muted">· {s.n}</span></span>)}</div>
              </div>
            )}
            <div className="am-books">
              {r.books.map((e) => (
                <button key={e.mine.id} type="button" className="am-book" onClick={() => (isDesktop() ? openBook(e.mine.id) : nav(`/buch/${e.mine.id}`))}>
                  <Cover title={e.book.title} url={e.book.cover_url} isbn={e.book.isbn13} bookId={e.book.id} genre={e.book.genre} />
                  <span className="am-book-title">{e.book.title}</span>
                  <span className="am-book-meta">{e.series ? `${e.series.name}${e.book.series_number ? ` #${e.book.series_number}` : ""}` : e.book.pages ? `${e.book.pages} Seiten` : ""}</span>
                  <span className="am-book-foot"><StatusPill status={e.mine.status} />{e.mine.rating != null && <Stars value={e.mine.rating} />}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
