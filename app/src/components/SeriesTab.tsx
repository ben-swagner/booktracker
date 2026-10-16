import type { Entry, WishlistItem } from "../data/types";
import { seriesNo } from "../lib/stats";
import { Cover, SeriesNo, StatusPill, bindingOf, BINDING_LABEL, type Binding } from "./ui";
import { useOpenBook } from "./openBook";
import { Link } from "./Link";
import { Icon } from "./Icon";

/** Höhe der kleinen Buchrücken je Format (wie auf der Reihen-Seite). */
const SPINE_H: Record<Binding, number> = { manga: 62, taschenbuch: 74, ebook: 82, paperback: 90, hardcover: 100 };

/**
 * Reiter „Die Reihe“ in der Buchkarte: alle Bände mit Cover und Lesestatus,
 * fehlende Bände als Lücke, dazu schnelle Wege zum ersten Band, Vorgänger und Nachfolger.
 */
export function SeriesTab({ e, entries, wishlist }: { e: Entry; entries: Entry[]; wishlist: WishlistItem[] }) {
  const openBook = useOpenBook();
  const s = e.series!;
  const vols = entries
    .filter((x) => x.series?.id === s.id)
    .sort((a, b) => seriesNo(a.book.series_number) - seriesNo(b.book.series_number) || a.book.title.localeCompare(b.book.title, "de"));
  const read = vols.filter((x) => x.mine.status === "gelesen").length;
  const reading = vols.filter((x) => x.mine.status === "lese").length;
  const owned = vols.filter((x) => x.mine.owned !== false && x.mine.status !== "wunschliste").length;
  const total = Math.max(s.total_count ?? 0, vols.length);
  const next = vols.find((x) => x.mine.status === "tbr" || x.mine.status === "ungelesen");
  const complete = total > 0 && read >= total;
  const idx = vols.findIndex((x) => x.mine.id === e.mine.id);
  const prev = idx > 0 ? vols[idx - 1] : undefined;
  const after = idx >= 0 && idx < vols.length - 1 ? vols[idx + 1] : undefined;
  const first = vols[0] && vols[0].mine.id !== e.mine.id ? vols[0] : undefined;
  const norm = (t?: string | null) => (t ?? "").toLowerCase().replace(/[^a-z0-9äöüß]/g, "");
  const wished = (n: number) => wishlist.find((w) => !w.owned && norm(w.series_name) === norm(s.name) && seriesNo(w.series_number) === n);

  // Kacheln: eingetragene Bände in Reihenfolge, Lücken bis zur bekannten Gesamtzahl dazwischen
  type Tile = { kind: "vol"; e: Entry } | { kind: "gap"; n: number; wish?: WishlistItem };
  const tiles: Tile[] = [];
  const nums = new Set(vols.map((x) => seriesNo(x.book.series_number)).filter((n) => n < 999));
  let n = 1;
  for (const v of vols) {
    const vn = seriesNo(v.book.series_number);
    if (vn < 999) for (; n < Math.floor(vn); n++) if (!nums.has(n)) tiles.push({ kind: "gap", n, wish: wished(n) });
    tiles.push({ kind: "vol", e: v });
    if (vn < 999) n = Math.max(n, Math.floor(vn) + 1);
  }
  for (; n <= (s.total_count ?? 0); n++) if (!nums.has(n)) tiles.push({ kind: "gap", n, wish: wished(n) });

  const go = (x?: Entry) => x && openBook(x.mine.id);

  return (
    <section className="panel bd-sec tone-series">
      <div className="bs-head">
        <div className="bs-title">
          <h3>{s.name}</h3>
          <p className="meta">
            {e.book.series_number ? <>Dieses Buch ist Band <SeriesNo n={e.book.series_number} total={s.total_count} />{s.total_count ? ` von ${s.total_count}` : ""} · </> : null}
            {read} von {total} gelesen · {owned} im Regal
          </p>
        </div>
        <span className={"pill " + (complete ? "st-gelesen" : reading ? "st-lese" : read ? "st-tbr" : "st-ungelesen")}>{complete ? "Beendet" : reading ? "Am Lesen" : read ? "Dabei" : "Offen"}</span>
      </div>

      <div className="vol-spines bs-spines" aria-label={`${read} von ${total} gelesen, ${owned} im Regal`}>
        {Array.from({ length: Math.min(total, 80) }, (_, i) => {
          const v = vols.find((x) => seriesNo(x.book.series_number) === i + 1);
          const cls = !v ? "" : v.mine.status === "gelesen" ? "gelesen" : v.mine.status === "lese" ? "lese" : v.mine.status === "wunschliste" || v.mine.owned === false ? "wish" : "owned";
          const bind = v ? bindingOf(v) : null;
          return <span key={i} className={"vs " + cls + (bind ? " b-" + bind : "") + (v?.mine.id === e.mine.id ? " cur" : "")} style={{ height: `${bind ? SPINE_H[bind] : 72}%` }} title={v ? `Band ${i + 1}: ${v.book.title} · ${BINDING_LABEL[bind!]}` : `Band ${i + 1} fehlt`} />;
        })}
      </div>

      <div className="bs-nav">
        {first && <button type="button" className="btn small" onClick={() => go(first)}><Icon name="flag" size={15} /> Zum ersten Band</button>}
        {prev && <button type="button" className="btn small" onClick={() => go(prev)}>← Vorgänger</button>}
        {after && <button type="button" className="btn small" onClick={() => go(after)}>Nachfolger →</button>}
        {next && next.mine.id !== e.mine.id && <button type="button" className="btn small primary" onClick={() => go(next)}><Icon name="book" size={15} /> Als Nächstes: {next.book.series_number ? `Band ${next.book.series_number}` : next.book.title}</button>}
      </div>

      <div className="bs-tiles">
        {tiles.map((t) => t.kind === "vol" ? (
          <button key={t.e.mine.id} type="button" className={"bs-tile" + (t.e.mine.id === e.mine.id ? " cur" : "")} onClick={() => t.e.mine.id !== e.mine.id && go(t.e)} aria-current={t.e.mine.id === e.mine.id ? "true" : undefined}>
            <span className="bs-cover">
              <Cover title={t.e.book.title} url={t.e.book.cover_url} isbn={t.e.book.isbn13} bookId={t.e.book.id} genre={t.e.book.genre} />
              {t.e.book.series_number && <span className="bs-num">{t.e.book.series_number}</span>}
            </span>
            <span className="bs-name">{t.e.book.title}</span>
            <span className="bs-st">{t.e.mine.id === e.mine.id ? <span className="bs-here">Dieses Buch</span> : <StatusPill status={t.e.mine.status} />}</span>
          </button>
        ) : (
          <div key={"gap" + t.n} className="bs-tile gap">
            <span className="bs-cover bs-missing"><span>Band {t.n}</span></span>
            <span className="bs-name">{t.wish ? t.wish.title : "Fehlt noch"}</span>
            <span className="bs-st">{t.wish ? <span className="pill st-wunschliste">Wunschliste</span> : <Link to="/wunschliste" className="bs-addwish">Auf die Wunschliste</Link>}</span>
          </div>
        ))}
      </div>
      {!s.total_count && <p className="meta" style={{ margin: 0 }}>Wie viele Bände die Reihe insgesamt hat, ist noch nicht eingetragen. Dann zeigt die App auch fehlende Bände am Ende.</p>}
    </section>
  );
}
