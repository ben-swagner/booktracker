import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useEntries, useUser } from "../data/hooks";
import { Icon } from "./Icon";
import { Link } from "./Link";
import { patchSvg, TIER_METAL } from "../lib/patchArt";
import { TIER_NAMES, computePatches, earnedShowcase, fmtPatchDate, nextUp, type Patch } from "../lib/patches";

export function usePatches() {
  const { entries, lib } = useEntries();
  return useMemo(() => (lib ? computePatches(entries, lib) : []), [entries, lib]);
}

/** Ein Patch als Talisman-Sticker: eigenes Motiv je Art, Metallfaden in der Farbe der Stufe, weißer Aufkleberrand. */
export function PatchBadge({ p, size = 96 }: { p: Patch; size?: number }) {
  const svg = useMemo(() => patchSvg(p.family, TIER_METAL[p.tier] ?? "gold", !p.earned), [p.family, p.tier, p.earned]);
  return (
    <span className={"patch-art" + (p.earned ? "" : " locked")} style={{ width: size, height: size }} aria-hidden="true">
      <span className="patch-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      {(p.count ?? 0) > 1 && <span className="patch-count">{p.count}×</span>}
    </span>
  );
}

function PatchTile({ p, onOpen, showProgress }: { p: Patch; onOpen: (p: Patch) => void; showProgress?: boolean }) {
  return (
    <button type="button" className="patch-tile" onClick={() => onOpen(p)} title={p.title}>
      <PatchBadge p={p} />
      <span className="patch-name">{p.title}</span>
      {showProgress && !p.earned ? (
        <span className="patch-prog"><span className="patch-bar"><span style={{ width: `${Math.min(100, (p.value / p.target) * 100)}%` }} /></span><small>{p.value.toLocaleString("de-DE")} / {p.target.toLocaleString("de-DE")}</small></span>
      ) : p.tier > 0 ? <span className="patch-tier">{TIER_NAMES[p.tier]}</span> : (p.count ?? 0) > 1 ? <span className="patch-tier">{p.count}× geschafft</span> : p.date ? <span className="patch-tier">{fmtPatchDate(p.date)}</span> : null}
    </button>
  );
}

function PatchDetail({ p, all, onClose }: { p: Patch; all: Patch[]; onClose: () => void }) {
  const ladder = p.tiers ? all.filter((x) => x.family === p.family) : [];
  return createPortal(
    <div className="modal-bg" onClick={onClose}>
      <div className="modal patch-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={p.title}>
        <PatchBadge p={p} size={132} />
        <h2>{p.title}</h2>
        <p className="muted" style={{ margin: 0 }}>{p.desc}</p>
        {p.earned ? (
          <p className="patch-when"><Icon name="check" size={15} /> Erreicht{p.date ? `${p.date.length > 7 ? " am " : " im "}${fmtPatchDate(p.date)}` : ""}{p.tier ? ` · Stufe ${TIER_NAMES[p.tier]}` : ""}</p>
        ) : (
          <div className="patch-prog big"><span className="patch-bar"><span style={{ width: `${Math.min(100, (p.value / p.target) * 100)}%` }} /></span><small>{p.value.toLocaleString("de-DE")} von {p.target.toLocaleString("de-DE")} {p.unit ?? ""}</small></div>
        )}
        {ladder.length > 1 && (
          <div className="patch-ladder">
            {ladder.map((x) => (
              <span key={x.key} className={x.earned ? "on" : ""} title={x.title}><PatchBadge p={x} size={44} /><small>{x.target.toLocaleString("de-DE")}</small></span>
            ))}
          </div>
        )}
        <button type="button" className="btn" onClick={onClose}>Schließen</button>
      </div>
    </div>,
    document.body
  );
}

/** Patch-Wand für die Ziele-Seite: erreichte Patches und was als Nächstes kommt. */
export function PatchWall() {
  const all = usePatches();
  const [tab, setTab] = useState<"erreicht" | "naechste" | "alle">("erreicht");
  const [open, setOpen] = useState<Patch | null>(null);
  const earned = all.filter((p) => p.earned);
  const list = tab === "erreicht" ? earnedShowcase(all) : tab === "naechste" ? nextUp(all) : all;
  return (
    <section className="panel patch-wall" id="patches">
      <div className="section-head">
        <div>
          <h2 style={{ margin: 0 }}>Patches</h2>
          <p className="meta" style={{ margin: "2px 0 0" }}>{earned.length} von {all.length} erreicht. Die App vergibt sie von selbst, sobald du etwas geschafft hast.</p>
        </div>
        <div className="tabs patch-tabs" role="tablist">
          {([["erreicht", "Erreicht"], ["naechste", "Als Nächstes"], ["alle", "Alle"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>
      {list.length ? (
        <div className="patch-grid">{list.map((p) => <PatchTile key={p.key} p={p} onOpen={setOpen} showProgress={tab !== "erreicht"} />)}</div>
      ) : <p className="meta" style={{ margin: 0 }}>Noch kein Patch. Schau unter „Als Nächstes“, was du bald erreichst.</p>}
      {open && <PatchDetail p={open} all={all} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** Kurze Patch-Reihe fürs Profil. */
export function ProfilePatches() {
  const all = usePatches();
  const [open, setOpen] = useState<Patch | null>(null);
  const show = earnedShowcase(all);
  return (
    <section className="panel pf-sec">
      <div className="section-head"><h2>Patches</h2><Link to="/ziele#patches" className="muted">{all.filter((p) => p.earned).length} erreicht · Alle →</Link></div>
      {show.length ? <div className="patch-row">{show.map((p) => <PatchTile key={p.key} p={p} onOpen={setOpen} />)}</div>
        : <p className="meta" style={{ margin: 0 }}>Noch kein Patch. Unter Ziele siehst du, was du als Nächstes erreichen kannst.</p>}
      {open && <PatchDetail p={open} all={all} onClose={() => setOpen(null)} />}
    </section>
  );
}

/**
 * Meldet neu erreichte Patches mit einem kleinen Fenster. Beim allerersten Mal auf einem Gerät
 * merkt sie sich still den Stand, damit nicht alle alten Patches auf einmal aufpoppen.
 */
export function PatchNotifier() {
  const all = usePatches();
  const { data: user } = useUser();
  const [fresh, setFresh] = useState<Patch[]>([]);
  useEffect(() => {
    if (!all.length || !user) return;
    const key = `bt-patches-seen:${user.id}`;
    const earned = all.filter((p) => p.earned).map((p) => p.key);
    let seen: string[] | null = null;
    try { seen = JSON.parse(localStorage.getItem(key) ?? "null"); } catch { seen = null; }
    const save = () => { try { localStorage.setItem(key, JSON.stringify(earned)); } catch { /* egal */ } };
    if (!seen) { save(); return; }
    const neu = all.filter((p) => p.earned && !seen!.includes(p.key));
    if (neu.length) { setFresh(neu); save(); }
  }, [all, user]);
  if (!fresh.length) return null;
  // Bei mehreren Stufen derselben Gruppe nur die höchste zeigen
  const show = earnedShowcase(fresh);
  return createPortal(
    <div className="modal-bg" onClick={() => setFresh([])}>
      <div className="modal patch-modal patch-new" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Neuer Patch">
        <p className="patch-kicker">{show.length === 1 ? "Neuer Patch!" : `${show.length} neue Patches!`}</p>
        <div className="patch-new-row">{show.slice(0, 4).map((p) => <PatchBadge key={p.key} p={p} size={show.length === 1 ? 140 : 96} />)}</div>
        <h2>{show.length === 1 ? show[0].title : show.slice(0, 3).map((p) => p.title).join(", ")}</h2>
        {show.length === 1 && <p className="muted" style={{ margin: 0 }}>{show[0].desc}</p>}
        <div className="actions" style={{ justifyContent: "center" }}>
          <Link to="/ziele#patches" className="btn" onClick={() => setFresh([])}>Alle Patches</Link>
          <button type="button" className="btn primary" onClick={() => setFresh([])}>Juhu!</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
