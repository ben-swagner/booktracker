import { Suspense, lazy, useMemo, useState } from "react";
import { useDeleteWishlistItem, useEntries, useSaveWishlistItem } from "../data/hooks";
import { cleanIsbn, lookupIsbn } from "../lib/isbn";
import { findDuplicates, normIsbn } from "../lib/duplicates";
import { Barcode } from "../components/Barcode";
import { STATUS } from "../lib/labels";
import type { WishlistItem } from "../data/types";
import { euro, fmtDate, today } from "../lib/labels";
import { Empty, SeriesNo } from "../components/ui";
import { toast } from "../App";
import { Icon } from "../components/Icon";

// Der Scanner wird erst geladen, wenn er gebraucht wird
const Scanner = lazy(() => import("../components/Scanner").then((m) => ({ default: m.Scanner })));

/** Erscheinungsdatum aus der Buchsuche, nur wenn es ein genauer Tag ist. */
function parseRelease(v?: string): string {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const t = Date.parse(v);
  if (!isNaN(t) && /\d{1,2}/.test(v.replace(/\d{4}/, ""))) { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
  return "";
}

const PRIO: Record<WishlistItem["priority"], string> = { hoch: "Hoch", mittel: "Mittel", niedrig: "Niedrig", gekauft: "Gekauft" };
const PRIO_ORDER = ["hoch", "mittel", "niedrig"] as const;
/** Gekauft ist ein Buch, wenn es als gekauft markiert ist (alte Einträge haben dafür noch die Priorität „gekauft“). */
const isBought = (w: WishlistItem) => !!w.owned || w.priority === "gekauft";
/**
 * Wie ein Buch von der Wunschliste ins Regal kam. Gespeichert im Feld purchase_condition
 * (ältere Einträge haben dort „Neu“ oder „Gebraucht“ und zählen als gekauft).
 */
type How = "Gekauft" | "Geschenkt" | "Mitgenommen" | "Anders";
const HOWS: How[] = ["Gekauft", "Geschenkt", "Mitgenommen", "Anders"];
const howOf = (w: WishlistItem): How => (w.purchase_condition === "Geschenkt" || w.purchase_condition === "Mitgenommen" || w.purchase_condition === "Anders" ? w.purchase_condition : "Gekauft");
const parseEuro = (v: string) => { const n = Number(v.replace(/[^\d,.-]/g, "").replace(",", ".")); return v.trim() === "" || isNaN(n) ? null : Math.round(n * 100); };

/** Formate, die man sich wünschen kann. Alte Werte aus dem Sheet bleiben gültig. */
const FORMATS: [string, string][] = [
  ["Egal", "Egal"], ["Taschenbuch", "Taschenbuch"], ["Paperback", "Paperback"], ["Paperback/Taschenbuch", "Paperback/TB"],
  ["Hardcover", "Hardcover"], ["Special Edition", "Special Edition"], ["eBook", "eBook"], ["Hörbuch", "Hörbuch"], ["Set", "Set oder Schuber"]
];

/** Erscheinungstermin: nach dem Erscheinungstag ein Haken, kurz davor ein Countdown. */
function Release({ w }: { w: WishlistItem }) {
  const t = today();
  const textDone = !!w.release_text && /✔|✓|erschienen|ja/i.test(w.release_text);
  if ((w.release_date && w.release_date <= t) || (!w.release_date && textDone)) {
    return <span className="rel-done" title={w.release_date ? `Erschienen am ${fmtDate(w.release_date)}` : "Erschienen"}><Icon name="check" size={15} />Erschienen</span>;
  }
  if (!w.release_date) return <span className="rel-unknown">{w.release_text?.trim() || "Termin offen"}</span>;
  const days = Math.round((Date.parse(w.release_date) - Date.parse(t)) / 86400000);
  return (
    <span className="rel-future">
      <span className="mono">{fmtDate(w.release_date)}</span>
      <span className={days <= 30 ? "rel-soon" : "rel-later"}>{days === 1 ? "morgen" : `in ${days.toLocaleString("de-DE")} Tagen`}</span>
    </span>
  );
}

/** Preisfeld, das erst beim Verlassen speichert. */
function PriceInput({ w, onSave }: { w: WishlistItem; onSave: (cents: number | null) => void }) {
  const fmt = (c?: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
  const [v, setV] = useState(fmt(w.price_cents));
  return (
    <input className="input price-input" inputMode="decimal" value={v} placeholder="0,00" aria-label="Bezahlter Preis in Euro"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { const c = parseEuro(v); if (c !== (w.price_cents ?? null)) onSave(c); setV(fmt(c)); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
  );
}

export default function Wunschliste() {
  const { entries, lib, isLoading } = useEntries();
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<React.ReactNode>(null);
  const [showCode, setShowCode] = useState<WishlistItem | null>(null);
  const save = useSaveWishlistItem();
  const del = useDeleteWishlistItem();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"offen" | "gekauft">("offen");
  const [draft, setDraft] = useState({ title: "", author: "", isbn: "", price: "", priority: "mittel" as WishlistItem["priority"], format: "Egal", release: "", rec: "" });

  const all = lib?.wishlist_items ?? [];
  type WSort = "erscheint" | "prio" | "preis-auf" | "preis-ab" | "titel" | "autor" | "neu";
  const [sort, setSortState] = useState<WSort>(() => { try { return (localStorage.getItem("bt-wunsch-sort") as WSort) || "erscheint"; } catch { return "erscheint"; } });
  const setSort = (v: WSort) => { setSortState(v); try { localStorage.setItem("bt-wunsch-sort", v); } catch { /* egal */ } };
  const counts = { offen: all.filter((w) => !isBought(w)).length, gekauft: all.filter(isBought).length };
  const items = useMemo(() => {
    const nq = q.toLowerCase();
    return all
      .filter((w) => (filter === "gekauft" ? isBought(w) : !isBought(w)))
      .filter((w) => !nq || [w.title, w.author, w.series_name, w.genre].join(" ").toLowerCase().includes(nq))
      .sort((a, b) => {
        const byTitle = a.title.localeCompare(b.title, "de");
        const prio = (w: WishlistItem) => { const i = (PRIO_ORDER as readonly string[]).indexOf(w.priority); return i < 0 ? 9 : i; };
        const price = (w: WishlistItem) => w.price_cents ?? null;
        switch (sort) {
          case "prio": return prio(a) - prio(b) || (a.release_date ?? "9999").localeCompare(b.release_date ?? "9999") || byTitle;
          case "preis-auf": { const x = price(a), y = price(b); return x == null ? (y == null ? byTitle : 1) : y == null ? -1 : x - y || byTitle; }
          case "preis-ab": { const x = price(a), y = price(b); return x == null ? (y == null ? byTitle : 1) : y == null ? -1 : y - x || byTitle; }
          case "titel": return byTitle;
          case "autor": return (a.author ?? "~").localeCompare(b.author ?? "~", "de") || byTitle;
          case "neu": return (b.created_at ?? "").localeCompare(a.created_at ?? "") || byTitle;
          default: return (a.release_date ?? "9999").localeCompare(b.release_date ?? "9999") || byTitle;
        }
      });
  }, [all, q, filter, sort]);

  const [ask, setAsk] = useState<WishlistItem | null>(null);
  function markBought(w: WishlistItem, how: How, priceCents?: number | null) {
    save.mutate({ id: w.id, title: w.title, owned: true, purchase_condition: how, ...(how === "Gekauft" && priceCents !== undefined ? { price_cents: priceCents } : {}) });
    toast(`„${w.title}“ ist jetzt unter Gekauft (${how}).`);
  }
  function backToWishlist(w: WishlistItem) {
    save.mutate({ id: w.id, title: w.title, owned: false, purchase_condition: null, ...(w.priority === "gekauft" ? { priority: "mittel" as const } : {}) });
    toast(`„${w.title}“ steht wieder auf der Wunschliste.`);
  }

  const bought = all.filter(isBought);
  const spend = {
    paid: bought.filter((w) => howOf(w) === "Gekauft").reduce((n, w) => n + (w.price_cents ?? 0), 0),
    nBought: bought.filter((w) => howOf(w) === "Gekauft").length,
    nGift: bought.filter((w) => howOf(w) === "Geschenkt").length,
    nFree: bought.filter((w) => howOf(w) === "Mitgenommen").length,
    nOther: bought.filter((w) => howOf(w) === "Anders").length,
    saved: bought.filter((w) => howOf(w) !== "Gekauft").reduce((n, w) => n + (w.price_cents ?? 0), 0)
  };

  if (isLoading || !lib) return <p className="muted">Lade…</p>;
  const total = items.reduce((s, w) => s + (w.price_cents ?? 0), 0);

  /** ISBN nachschlagen: Titel, Autor:in und ggf. Erscheinungstag eintragen und prüfen, ob es das Buch schon gibt. */
  async function fillFromIsbn(raw: string) {
    const isbn = cleanIsbn(raw);
    if (!isbn) { toast("Das ist keine gültige ISBN."); return; }
    setDraft((d) => ({ ...d, isbn }));
    const dupLib = findDuplicates(entries, { isbn });
    const dupWish = all.find((w) => normIsbn(w.isbn) === isbn);
    setHint(dupLib.length
      ? <><Icon name="books" size={16} /> Steht schon in deiner Bibliothek: <b>{dupLib[0].e.book.title}</b> ({STATUS[dupLib[0].e.mine.status]})</>
      : dupWish ? <><Icon name="heart" size={16} /> Ist schon auf deiner Wunschliste{isBought(dupWish) ? " und als gekauft markiert" : ""}: <b>{dupWish.title}</b></> : null);
    setBusy(true);
    try {
      const r = await lookupIsbn(isbn);
      if (!r) { toast("Keine Buchdaten gefunden. Trag Titel und Autor:in bitte selbst ein."); return; }
      const rel = parseRelease(r.first_published);
      setDraft((d) => ({ ...d, isbn, title: r.title ? `${r.title}${r.subtitle ? `: ${r.subtitle}` : ""}` : d.title, author: (r.authors ?? []).join(", ") || d.author, release: rel && rel > today() ? rel : d.release }));
      toast("Buch gefunden. Prüf kurz die Angaben und tipp auf Hinzufügen.");
    } catch {
      toast("Die Buchsuche hat gerade nicht geklappt.");
    } finally {
      setBusy(false);
    }
  }


  async function add(ev: React.FormEvent) {
    ev.preventDefault();
    if (!draft.title.trim()) return;
    await save.mutateAsync({
      title: draft.title.trim(), author: draft.author || null, isbn: draft.isbn || null,
      price_cents: draft.price ? Math.round(Number(draft.price.replace(",", ".")) * 100) : null, priority: draft.priority,
      wanted_format: draft.format, release_date: draft.release || null, recommended_by: draft.rec.trim() || null
    });
    setDraft({ title: "", author: "", isbn: "", price: "", priority: "mittel", format: "Egal", release: "", rec: "" });
    setHint(null);
    toast("Auf die Wunschliste gesetzt.");
  }

  return (
    <>
      <div className="mast">
        <div>
          <h1>Wunschliste</h1>
          <p className="lede">{items.length} Bücher{total ? <> · zusammen <strong>{euro(total)}</strong></> : null}</p>
        </div>
      </div>

      <section className="spend">
        <div className="spend-main">
          <span className="gcard-kicker">Ausgegeben für Bücher von der Wunschliste</span>
          <strong className="spend-sum">{euro(spend.paid) || "0,00 €"}</strong>
          <span className="muted">{spend.nBought} {spend.nBought === 1 ? "Buch" : "Bücher"} gekauft</span>
        </div>
        <div className="gchips">
          <span className="gchip"><Icon name="gift" size={16} />Geschenkt <strong>{spend.nGift}</strong></span>
          <span className="gchip"><Icon name="books" size={16} />Mitgenommen <strong>{spend.nFree}</strong></span>
          {spend.nOther > 0 && <span className="gchip"><Icon name="sparkle" size={16} />Anders <strong>{spend.nOther}</strong></span>}
          {spend.saved > 0 && <span className="gchip"><Icon name="sparkle" size={16} />Gespart <strong>{euro(spend.saved)}</strong></span>}
        </div>
      </section>

      {scanning && <Suspense fallback={<div className="scanner"><p className="scanner-status">Scanner wird geladen…</p></div>}><Scanner onResult={(isbn) => { setScanning(false); fillFromIsbn(isbn); }} onClose={() => setScanning(false)} /></Suspense>}
      <form className="panel form-grid" onSubmit={add}>
        <div className="span2 wish-form-head">
          <button type="button" className="btn primary wish-scan" onClick={() => setScanning(true)}><Icon name="camera" size={18} /> Buch scannen</button>
          <span className="meta">Im Buchladen den Strichcode auf der Rückseite scannen, die App füllt den Rest aus.</span>
        </div>
        {hint && <p className="span2 wish-hint">{hint}</p>}
        <div className="field span2"><label htmlFor="wt">Neuer Wunsch</label><input id="wt" className="input" placeholder="Titel" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
        <div className="field"><label htmlFor="wa">Autor:in</label><input id="wa" className="input" value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} /></div>
        <div className="field"><label htmlFor="wi">ISBN</label>
          <div className="isbn-row">
            <input id="wi" className="input" inputMode="numeric" value={draft.isbn} onChange={(e) => setDraft({ ...draft, isbn: e.target.value })} />
            <button type="button" className="btn small" disabled={!draft.isbn || busy} onClick={() => fillFromIsbn(draft.isbn)}>{busy ? "Suche…" : "Suchen"}</button>
          </div>
        </div>
        <div className="field"><label htmlFor="wp">Preis in €</label><input id="wp" className="input" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></div>
        <div className="field"><label htmlFor="wf">Format</label>
          <select id="wf" className="input" value={draft.format} onChange={(e) => setDraft({ ...draft, format: e.target.value })}>
            {FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="wr">Erscheint am</label><input id="wr" className="input" type="date" value={draft.release} onChange={(e) => setDraft({ ...draft, release: e.target.value })} /></div>
        <div className="field"><label htmlFor="wprio">Priorität</label>
          <select id="wprio" className="input" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as any })}>
            {(["hoch", "mittel", "niedrig"] as const).map((p) => <option key={p} value={p}>{PRIO[p]}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="wrec">Empfohlen von</label><input id="wrec" className="input" autoComplete="off" value={draft.rec} onChange={(e) => setDraft({ ...draft, rec: e.target.value })} /></div>
        <div className="actions span2" style={{ justifyContent: "flex-end" }}><button className="btn primary" type="submit">Hinzufügen</button></div>
      </form>

      <div className="toolbar">
        <div className="tabs" role="tablist">
          {(["offen", "gekauft"] as const).map((f) => (
            <button key={f} className="tab" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>{f === "offen" ? "Offen" : "Gekauft"} <span className="tab-count">{counts[f]}</span></button>
          ))}
        </div>
        <div className="tools">
          <input className="input search" type="search" placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input wish-sort" value={sort} onChange={(e) => setSort(e.target.value as WSort)} aria-label="Sortierung">
            <option value="erscheint">Erscheint zuerst</option>
            <option value="prio">Priorität</option>
            <option value="preis-auf">Preis aufsteigend</option>
            <option value="preis-ab">Preis absteigend</option>
            <option value="titel">Titel A-Z</option>
            <option value="autor">Autor:in A-Z</option>
            <option value="neu">Zuletzt hinzugefügt</option>
          </select>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="grid">{filter === "offen" ? <Empty title="Nichts auf der Liste" text="Trag oben ein Buch ein, auf das du dich freust." /> : <Empty title="Noch nichts gekauft" text="Sobald du bei einem Wunsch auf „Gekauft“ klickst, landet er hier." />}</div>
      ) : (
        <div className="panel table-scroll">
          <table className="table wish-table">
            <thead><tr>{filter === "offen" && <th className="check-col">Habe ich</th>}<th>Titel</th><th>Autor:in</th><th>Reihe</th><th>Format</th><th>Erscheint</th>{filter === "offen" ? <th>Preis</th> : <><th>Wie?</th><th>Bezahlt</th></>}{filter === "offen" && <th>Priorität</th>}<th aria-label="Aktionen"></th></tr></thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id}>
                  {filter === "offen" && (
                    <td className="check-col">
                      <input type="checkbox" className="wish-check" checked={false} onChange={() => setAsk(w)} aria-label={`„${w.title}“ abhaken`} title="Abhaken: gekauft, geschenkt …" />
                    </td>
                  )}
                  <td><strong>{w.title}</strong><RecBy value={w.recommended_by ?? ""} onSave={(v) => save.mutate({ id: w.id, title: w.title, recommended_by: v || null })} /></td>
                  <td>{w.author}</td>
                  <td>{w.series_name ? <>{w.series_name}<SeriesNo n={w.series_number} total={w.series_total} /></> : ""}</td>
                  <td>
                    {filter === "offen" ? (
                      <select className="input format-select" value={w.wanted_format ?? "Egal"} aria-label="Gewünschtes Format"
                        onChange={(e) => save.mutate({ id: w.id, title: w.title, wanted_format: e.target.value })}>
                        {FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        {w.wanted_format && !FORMATS.some(([v]) => v === w.wanted_format) && <option value={w.wanted_format}>{w.wanted_format}</option>}
                      </select>
                    ) : w.wanted_format}
                  </td>
                  <td><Release w={w} /></td>
                  {filter === "offen" ? <td className="mono">{euro(w.price_cents)}</td> : (
                    <>
                      <td>
                        <select className={"input how-select how-" + howOf(w).toLowerCase()} value={howOf(w)} aria-label="Wie bekommen"
                          onChange={(e) => save.mutate({ id: w.id, title: w.title, purchase_condition: e.target.value })}>
                          {HOWS.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </td>
                      <td>{howOf(w) === "Gekauft" ? <PriceInput key={w.id + (w.price_cents ?? "")} w={w} onSave={(c) => save.mutate({ id: w.id, title: w.title, price_cents: c })} /> : <span className="muted">kostenlos</span>}</td>
                    </>
                  )}
                  {filter === "offen" && (
                    <td>
                      <select className={"input prio-select prio-" + w.priority} value={w.priority === "gekauft" ? "mittel" : w.priority} aria-label="Priorität"
                        onChange={(e) => save.mutate({ id: w.id, title: w.title, priority: e.target.value as WishlistItem["priority"] })}>
                        {PRIO_ORDER.map((p) => <option key={p} value={p}>{PRIO[p]}</option>)}
                      </select>
                    </td>
                  )}
                  <td>
                    <div className="wish-actions">
                      {filter === "gekauft" && <button className="btn ghost small wish-back" title="Zurück auf die Wunschliste" onClick={() => backToWishlist(w)}><Icon name="history" size={16} /> Zurück</button>}
                      {w.isbn && cleanIsbn(w.isbn) && <button className="btn ghost small" aria-label="Barcode zeigen" title="Barcode zum Vorzeigen im Laden" onClick={() => setShowCode(w)}><Icon name="barcode" size={18} /></button>}
                      <button className="btn ghost small" aria-label="Von der Wunschliste streichen" title="Von der Wunschliste streichen" onClick={() => confirm(`„${w.title}“ von der Wunschliste streichen?`) && del.mutate(w.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ask && <HowDialog w={ask} onClose={() => setAsk(null)} onPick={(how, c) => { markBought(ask, how, c); setAsk(null); }} />}
      {showCode && (
        <div className="bm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCode(null); }}>
          <div className="code-modal" role="dialog" aria-modal="true" aria-label="Barcode">
            <button className="bm-close" onClick={() => setShowCode(null)} aria-label="Schließen">×</button>
            <p className="code-kicker">Zum Vorzeigen im Buchladen</p>
            <h2>{showCode.title}</h2>
            {showCode.author && <p className="muted" style={{ margin: 0 }}>{showCode.author}</p>}
            <div className="code-box"><Barcode isbn={cleanIsbn(showCode.isbn!) ?? ""} /></div>
            <p className="code-meta">ISBN {cleanIsbn(showCode.isbn!)}{showCode.wanted_format && showCode.wanted_format !== "Egal" ? ` · gewünscht: ${showCode.wanted_format}` : ""}{showCode.price_cents ? ` · ${euro(showCode.price_cents)}` : ""}</p>
          </div>
        </div>
      )}
    </>
  );
}

/** „Empfohlen von …“ unter dem Titel: antippen zum Eintragen oder Ändern, Enter oder Wegklicken speichert. */
function RecBy({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(value);
  if (edit) return (
    <input className="input rec-input" autoFocus autoComplete="off" value={text} aria-label="Empfohlen von"
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } if (e.key === "Escape") { setText(value); setEdit(false); } }}
      onBlur={() => { setEdit(false); if (text.trim() !== value) onSave(text.trim()); }} />
  );
  return value
    ? <button type="button" className="rec-btn" onClick={() => { setText(value); setEdit(true); }}>Empfohlen von <strong>{value}</strong></button>
    : <button type="button" className="rec-btn add" onClick={() => { setText(""); setEdit(true); }}>+ Empfohlen von</button>;
}

/** Beim Abhaken fragen, wie das Buch kam: gekauft (mit Preis), geschenkt, mitgenommen oder anders. */
function HowDialog({ w, onClose, onPick }: { w: WishlistItem; onClose: () => void; onPick: (how: How, priceCents?: number | null) => void }) {
  const [how, setHow] = useState<How>("Gekauft");
  const [price, setPrice] = useState(w.price_cents != null ? (w.price_cents / 100).toFixed(2).replace(".", ",") : "");
  const LABEL: Record<How, string> = { Gekauft: "Gekauft", Geschenkt: "Geschenkt bekommen", Mitgenommen: "Mitgenommen (z. B. Tauschregal)", Anders: "Anders bekommen" };
  return (
    <div className="modal-bg cover-picker-bg" onClick={onClose}>
      <div className="modal how-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Wie hast du das Buch bekommen?">
        <h2 style={{ margin: 0 }}>Wie hast du es bekommen?</h2>
        <p className="muted" style={{ margin: 0 }}>„{w.title}“</p>
        <div className="how-choices" role="radiogroup">
          {HOWS.map((h) => (
            <button key={h} type="button" role="radio" aria-checked={how === h} className={"how-choice how-" + h.toLowerCase() + (how === h ? " on" : "")} onClick={() => setHow(h)}>{LABEL[h]}</button>
          ))}
        </div>
        {how === "Gekauft" && (
          <div className="field"><label htmlFor="how-price">Bezahlt in €</label><input id="how-price" className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="optional" /></div>
        )}
        <div className="actions" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>Abbrechen</button>
          <button type="button" className="btn primary" onClick={() => onPick(how, how === "Gekauft" ? parseEuro(price) : undefined)}>Abhaken</button>
        </div>
      </div>
    </div>
  );
}
