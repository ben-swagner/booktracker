import { useMemo, useState } from "react";
import { useDeleteWishlistItem, useLibrary, useSaveWishlistItem } from "../data/hooks";
import type { WishlistItem } from "../data/types";
import { euro, fmtDate } from "../lib/labels";
import { Empty } from "../components/ui";
import { toast } from "../App";
import { Icon } from "../components/Icon";

const PRIO: Record<WishlistItem["priority"], string> = { hoch: "Hoch", mittel: "Mittel", niedrig: "Niedrig", gekauft: "Gekauft" };
const PRIO_ORDER = ["hoch", "mittel", "niedrig"] as const;
/** Gekauft ist ein Buch, wenn es als gekauft markiert ist (alte Einträge haben dafür noch die Priorität „gekauft“). */
const isBought = (w: WishlistItem) => !!w.owned || w.priority === "gekauft";
/**
 * Wie ein Buch von der Wunschliste ins Regal kam. Gespeichert im Feld purchase_condition
 * (ältere Einträge haben dort „Neu“ oder „Gebraucht“ und zählen als gekauft).
 */
type How = "Gekauft" | "Geschenkt" | "Mitgenommen";
const HOWS: How[] = ["Gekauft", "Geschenkt", "Mitgenommen"];
const howOf = (w: WishlistItem): How => (w.purchase_condition === "Geschenkt" || w.purchase_condition === "Mitgenommen" ? w.purchase_condition : "Gekauft");
const parseEuro = (v: string) => { const n = Number(v.replace(/[^\d,.-]/g, "").replace(",", ".")); return v.trim() === "" || isNaN(n) ? null : Math.round(n * 100); };

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
  const { data: lib, isLoading } = useLibrary();
  const save = useSaveWishlistItem();
  const del = useDeleteWishlistItem();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"offen" | "gekauft">("offen");
  const [draft, setDraft] = useState({ title: "", author: "", isbn: "", price: "", priority: "mittel" as WishlistItem["priority"] });

  const all = lib?.wishlist_items ?? [];
  const counts = { offen: all.filter((w) => !isBought(w)).length, gekauft: all.filter(isBought).length };
  const items = useMemo(() => {
    const nq = q.toLowerCase();
    return all
      .filter((w) => (filter === "gekauft" ? isBought(w) : !isBought(w)))
      .filter((w) => !nq || [w.title, w.author, w.series_name, w.genre].join(" ").toLowerCase().includes(nq))
      .sort((a, b) => (a.release_date ?? "9999").localeCompare(b.release_date ?? "9999") || a.title.localeCompare(b.title, "de"));
  }, [all, q, filter]);

  function markBought(w: WishlistItem) {
    save.mutate({ id: w.id, title: w.title, owned: true, purchase_condition: "Gekauft" });
    toast(`„${w.title}“ ist jetzt unter Gekauft.`);
  }

  const bought = all.filter(isBought);
  const spend = {
    paid: bought.filter((w) => howOf(w) === "Gekauft").reduce((n, w) => n + (w.price_cents ?? 0), 0),
    nBought: bought.filter((w) => howOf(w) === "Gekauft").length,
    nGift: bought.filter((w) => howOf(w) === "Geschenkt").length,
    nFree: bought.filter((w) => howOf(w) === "Mitgenommen").length,
    saved: bought.filter((w) => howOf(w) !== "Gekauft").reduce((n, w) => n + (w.price_cents ?? 0), 0)
  };

  if (isLoading || !lib) return <p className="muted">Lade…</p>;
  const total = items.reduce((s, w) => s + (w.price_cents ?? 0), 0);

  async function add(ev: React.FormEvent) {
    ev.preventDefault();
    if (!draft.title.trim()) return;
    await save.mutateAsync({
      title: draft.title.trim(), author: draft.author || null, isbn: draft.isbn || null,
      price_cents: draft.price ? Math.round(Number(draft.price.replace(",", ".")) * 100) : null, priority: draft.priority
    });
    setDraft({ title: "", author: "", isbn: "", price: "", priority: "mittel" });
    toast("Auf die Wunschliste gesetzt.");
  }

  return (
    <>
      <div className="mast">
        <div>
          <h1>Wunsch<em>liste</em></h1>
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
          {spend.saved > 0 && <span className="gchip"><Icon name="sparkle" size={16} />Gespart <strong>{euro(spend.saved)}</strong></span>}
        </div>
      </section>

      <form className="panel form-grid" onSubmit={add}>
        <div className="field span2"><label htmlFor="wt">Neuer Wunsch</label><input id="wt" className="input" placeholder="Titel" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
        <div className="field"><label htmlFor="wa">Autor:in</label><input id="wa" className="input" value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} /></div>
        <div className="field"><label htmlFor="wi">ISBN</label><input id="wi" className="input" value={draft.isbn} onChange={(e) => setDraft({ ...draft, isbn: e.target.value })} /></div>
        <div className="field"><label htmlFor="wp">Preis in €</label><input id="wp" className="input" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></div>
        <div className="field"><label htmlFor="wprio">Priorität</label>
          <select id="wprio" className="input" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as any })}>
            {(["hoch", "mittel", "niedrig"] as const).map((p) => <option key={p} value={p}>{PRIO[p]}</option>)}
          </select>
        </div>
        <div className="actions span2" style={{ justifyContent: "flex-end" }}><button className="btn primary" type="submit">Hinzufügen</button></div>
      </form>

      <div className="toolbar">
        <div className="tabs" role="tablist">
          {(["offen", "gekauft"] as const).map((f) => (
            <button key={f} className="tab" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>{f === "offen" ? "Offen" : "Gekauft"} <span className="tab-count">{counts[f]}</span></button>
          ))}
        </div>
        <div className="tools"><input className="input search" type="search" placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      {items.length === 0 ? (
        <div className="grid">{filter === "offen" ? <Empty title="Nichts auf der Liste" text="Trag oben ein Buch ein, auf das du dich freust." /> : <Empty title="Noch nichts gekauft" text="Sobald du bei einem Wunsch auf „Gekauft“ klickst, landet er hier." />}</div>
      ) : (
        <div className="panel table-scroll">
          <table className="table wish-table">
            <thead><tr>{filter === "offen" && <th className="check-col">Gekauft</th>}<th>Titel</th><th>Autor:in</th><th>Reihe</th><th>Format</th><th>Erscheint</th>{filter === "offen" ? <th>Preis</th> : <><th>Wie?</th><th>Bezahlt</th></>}{filter === "offen" && <th>Priorität</th>}<th aria-label="Aktionen"></th></tr></thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id}>
                  {filter === "offen" && (
                    <td className="check-col">
                      <input type="checkbox" className="wish-check" checked={false} onChange={() => markBought(w)} aria-label={`„${w.title}“ als gekauft abhaken`} title="Als gekauft abhaken" />
                    </td>
                  )}
                  <td><strong>{w.title}</strong>{w.recommended_by ? <div className="meta">Empfohlen von {w.recommended_by}</div> : null}</td>
                  <td>{w.author}</td>
                  <td>{w.series_name ? `${w.series_name}${w.series_number ? ` #${w.series_number}` : ""}` : ""}</td>
                  <td>{w.wanted_format}</td>
                  <td className="mono">{fmtDate(w.release_date, w.release_text)}</td>
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
                      <button className="btn ghost small" aria-label="Von der Wunschliste streichen" title="Von der Wunschliste streichen" onClick={() => confirm(`„${w.title}“ von der Wunschliste streichen?`) && del.mutate(w.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
