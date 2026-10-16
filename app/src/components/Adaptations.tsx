import { useState } from "react";
import type { Adaptation, AdaptationReview, Entry } from "../data/types";
import { useDeleteAdaptation, useSaveAdaptation, useSaveUserBook } from "../data/hooks";
import { StarPicker } from "./ui";
import { Icon, type IconName } from "./Icon";
import { toast } from "../App";

/** Arten von Adaptionen. Die Werte sind die aus der alten Tabelle, damit nichts doppelt entsteht. */
export const ADAPT_KINDS: [string, string, IconName][] = [
  ["Film", "Film", "film"], ["Serie", "Serie", "film"], ["Anime", "Anime", "film"], ["Game", "Spiel", "sparkle"],
  ["Musical/Theater", "Theater oder Musical", "ticket"], ["Hörspiel", "Hörspiel", "headphones"], ["Andere", "Andere", "sparkle"]
];
const kindLabel = (k: string) => ADAPT_KINDS.find(([v]) => v === k)?.[1] ?? k;
const kindIcon = (k: string): IconName => ADAPT_KINDS.find(([v]) => v === k)?.[2] ?? "film";
/** Passendes Wort: Film gesehen, Spiel gespielt, Hörspiel gehört. */
const seenWord = (k: string) => (k === "Game" ? ["Gespielt", "Noch nicht gespielt"] : k === "Hörspiel" ? ["Gehört", "Noch nicht gehört"] : ["Gesehen", "Noch nicht gesehen"]);
const COMPARE: [NonNullable<AdaptationReview["compare"]>, string][] = [["buch", "Buch besser"], ["gleich", "Gleich gut"], ["adaption", "Adaption besser"]];

/** Adaptionen eines Buchs, auch wenn sie noch aus der alten Liste nur als Art gespeichert sind. */
export function adaptationRows(e: Entry): Adaptation[] {
  return e.book.adaptation_rows ?? (e.book.adaptations ?? []).map((kind) => ({ id: `${e.book.id}|${kind}`, book_id: e.book.id, kind }));
}

/** Bereich „Adaptionen“ in der Buchkarte: welche es gibt, ob gesehen, und wie man sie fand. */
export function AdaptationsSection({ e }: { e: Entry }) {
  const b = e.book, m = e.mine;
  const saveA = useSaveAdaptation();
  const delA = useDeleteAdaptation();
  const saveUB = useSaveUserBook();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ kind: "Film", title: "", year: "" });
  const rows = adaptationRows(e);
  const reviews = m.adaptation_reviews ?? {};
  // Alte Liste: ein Häkchen „Adaption gesehen“ fürs ganze Buch
  const reviewOf = (a: Adaptation): AdaptationReview => ({ seen: m.adaptation_seen && reviews[a.id]?.seen == null ? true : undefined, ...reviews[a.id] });

  async function setReview(a: Adaptation, patch: AdaptationReview) {
    const next = { ...reviews, [a.id]: { ...reviewOf(a), ...patch } };
    try {
      await saveUB.mutateAsync({ id: m.id, book_id: b.id, adaptation_reviews: next });
    } catch (x: any) {
      const msg = String(x?.message ?? x);
      toast(/adaptation_reviews/.test(msg) ? "Zum Speichern deiner Meinung fehlt noch eine kleine Ergänzung der Datenbank (0003_adaptionen.sql)." : "Speichern hat nicht geklappt.");
    }
  }

  async function add(ev: React.FormEvent) {
    ev.preventDefault();
    try {
      const row = await saveA.mutateAsync({ book_id: b.id, kind: draft.kind, title: draft.title.trim() || null, year: draft.year ? Number(draft.year) : null });
      // Das alte Häkchen „Adaption gesehen“ soll nicht für neu eingetragene Adaptionen gelten
      if (m.adaptation_seen) saveUB.mutateAsync({ id: m.id, book_id: b.id, adaptation_reviews: { ...reviews, [row.id]: { seen: false } } }).catch(() => {});
      setDraft({ kind: "Film", title: "", year: "" });
      setAdding(false);
      toast(`${kindLabel(draft.kind)} eingetragen.`);
    } catch {
      toast("Die Adaption konnte nicht gespeichert werden.");
    }
  }

  async function remove(a: Adaptation) {
    if (!confirm(`${kindLabel(a.kind)}${a.title ? ` „${a.title}“` : ""} entfernen?`)) return;
    try { await delA.mutateAsync(a.id); } catch (x: any) { toast(x?.message ?? "Entfernen hat nicht geklappt."); }
  }

  return (
    <div className="adapt">
      <div className="bd-sub">
        <h3><Icon name="film" size={16} /> Adaptionen</h3>
        {!adding && <button type="button" className="btn small" onClick={() => setAdding(true)}>+ Adaption</button>}
      </div>

      {rows.length === 0 && !adding && <p className="meta" style={{ margin: 0 }}>Gibt es einen Film, eine Serie, ein Spiel oder ein Theaterstück zu diesem Buch? Trag es hier ein.</p>}

      {rows.map((a) => {
        const r = reviewOf(a);
        return (
          <div key={a.id} className="adapt-row">
            <div className="adapt-id">
              <span className="adapt-ico"><Icon name={kindIcon(a.kind)} size={18} /></span>
              <span className="adapt-name"><strong>{kindLabel(a.kind)}</strong>{a.title || a.year ? <small>{[a.title, a.year].filter(Boolean).join(" · ")}</small> : null}</span>
              <button type="button" className="adapt-del" onClick={() => remove(a)} aria-label="Adaption entfernen" title="Entfernen">×</button>
            </div>
            <div className="adapt-me">
              <button type="button" className={"chip adapt-seen" + (r.seen ? " on" : "")} aria-pressed={!!r.seen} onClick={() => setReview(a, { seen: !r.seen })}>
                <Icon name="check" size={14} /> {seenWord(a.kind)[r.seen ? 0 : 1]}
              </button>
              {r.seen && (
                <>
                  <StarPicker value={r.rating ?? null} onChange={(v) => setReview(a, { rating: v })} size={22} />
                  <div className="adapt-cmp" role="group" aria-label="Vergleich mit dem Buch">
                    {COMPARE.map(([k, l]) => <button key={k} type="button" className={"chip" + (r.compare === k ? " on" : "")} aria-pressed={r.compare === k} onClick={() => setReview(a, { compare: r.compare === k ? null : k })}>{l}</button>)}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}

      {adding && (
        <form className="adapt-form" onSubmit={add}>
          <select className="input" value={draft.kind} onChange={(ev) => setDraft({ ...draft, kind: ev.target.value })} aria-label="Art der Adaption">
            {ADAPT_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input className="input" placeholder="Titel (falls anders als das Buch)" value={draft.title} onChange={(ev) => setDraft({ ...draft, title: ev.target.value })} />
          <input className="input adapt-year" inputMode="numeric" placeholder="Jahr" value={draft.year} onChange={(ev) => setDraft({ ...draft, year: ev.target.value.replace(/\D/g, "").slice(0, 4) })} />
          <div className="adapt-form-actions">
            <button type="button" className="btn small ghost" onClick={() => setAdding(false)}>Abbrechen</button>
            <button type="submit" className="btn small primary" disabled={saveA.isPending}>Eintragen</button>
          </div>
        </form>
      )}
    </div>
  );
}
