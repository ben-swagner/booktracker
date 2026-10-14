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
    save.mutate({ id: w.id, title: w.title, owned: true });
    toast(`„${w.title}“ ist jetzt unter Gekauft.`);
  }
  function markOpen(w: WishlistItem) {
    save.mutate({ id: w.id, title: w.title, owned: false, priority: w.priority === "gekauft" ? "mittel" : w.priority });
    toast(`„${w.title}“ ist wieder offen.`);
  }

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
            <thead><tr><th>Titel</th><th>Autor:in</th><th>Reihe</th><th>Format</th><th>Erscheint</th><th>Preis</th>{filter === "offen" && <th>Priorität</th>}<th aria-label="Aktionen"></th></tr></thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id}>
                  <td><strong>{w.title}</strong>{w.recommended_by ? <div className="meta">Empfohlen von {w.recommended_by}</div> : null}</td>
                  <td>{w.author}</td>
                  <td>{w.series_name ? `${w.series_name}${w.series_number ? ` #${w.series_number}` : ""}` : ""}</td>
                  <td>{w.wanted_format}</td>
                  <td className="mono">{fmtDate(w.release_date, w.release_text)}</td>
                  <td className="mono">{euro(w.price_cents)}</td>
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
                      {filter === "offen"
                        ? <button className="btn small wish-buy" onClick={() => markBought(w)} title="Als gekauft markieren"><Icon name="check" size={16} /> Gekauft</button>
                        : <button className="btn small ghost" onClick={() => markOpen(w)} title="Zurück auf die offene Liste">Wieder offen</button>}
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
