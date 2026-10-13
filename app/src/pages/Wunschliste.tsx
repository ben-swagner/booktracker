import { useMemo, useState } from "react";
import { useDeleteWishlistItem, useLibrary, useSaveWishlistItem } from "../data/hooks";
import type { WishlistItem } from "../data/types";
import { euro, fmtDate } from "../lib/labels";
import { Empty } from "../components/ui";
import { toast } from "../App";

const PRIO: Record<WishlistItem["priority"], string> = { hoch: "Hoch", mittel: "Mittel", niedrig: "Niedrig", gekauft: "Gekauft" };

export default function Wunschliste() {
  const { data: lib, isLoading } = useLibrary();
  const save = useSaveWishlistItem();
  const del = useDeleteWishlistItem();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"offen" | "gekauft" | "alle">("offen");
  const [draft, setDraft] = useState({ title: "", author: "", isbn: "", price: "", priority: "mittel" as WishlistItem["priority"] });

  const items = useMemo(() => {
    const all = lib?.wishlist_items ?? [];
    const nq = q.toLowerCase();
    return all
      .filter((w) => filter === "alle" || (filter === "gekauft" ? w.priority === "gekauft" || w.owned : w.priority !== "gekauft" && !w.owned))
      .filter((w) => !nq || [w.title, w.author, w.series_name, w.genre].join(" ").toLowerCase().includes(nq))
      .sort((a, b) => (a.release_date ?? "9999").localeCompare(b.release_date ?? "9999") || a.title.localeCompare(b.title, "de"));
  }, [lib, q, filter]);

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
          {(["offen", "gekauft", "alle"] as const).map((f) => (
            <button key={f} className="tab" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>{f === "offen" ? "Offen" : f === "gekauft" ? "Gekauft" : "Alle"}</button>
          ))}
        </div>
        <div className="tools"><input className="input search" type="search" placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      {items.length === 0 ? (
        <div className="grid"><Empty title="Nichts auf der Liste" text="Trag oben ein Buch ein, auf das du dich freust." /></div>
      ) : (
        <div className="panel table-wrap">
          <table className="table">
            <thead><tr><th>Titel</th><th>Autor:in</th><th>Reihe</th><th>Format</th><th>Erscheint</th><th>Preis</th><th>Prio</th><th></th></tr></thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id}>
                  <td><strong>{w.title}</strong>{w.recommended_by ? <div className="meta">Empfohlen von {w.recommended_by}</div> : null}</td>
                  <td>{w.author}</td>
                  <td>{w.series_name ? `${w.series_name}${w.series_number ? ` #${w.series_number}` : ""}` : ""}</td>
                  <td>{w.wanted_format}</td>
                  <td className="mono">{fmtDate(w.release_date, w.release_text)}</td>
                  <td className="mono">{euro(w.price_cents)}</td>
                  <td>
                    <select className="input" style={{ padding: "4px 8px" }} value={w.priority} onChange={(e) => save.mutate({ id: w.id, title: w.title, priority: e.target.value as any, owned: e.target.value === "gekauft" })}>
                      {(Object.keys(PRIO) as WishlistItem["priority"][]).map((p) => <option key={p} value={p}>{PRIO[p]}</option>)}
                    </select>
                  </td>
                  <td><button className="btn ghost small" onClick={() => confirm(`„${w.title}“ von der Wunschliste streichen?`) && del.mutate(w.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
