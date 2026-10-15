import { useEffect, useRef, useState } from "react";
import { coverCandidates, loadSheetCovers, sheetCoverFor, shrinkCoverFile, type Candidate } from "../lib/covers";

/**
 * Auswahlfenster für ein Buchcover: zeigt alle Vorschläge aus Open Library und Google Books
 * als Bilder, dazu ein Feld für einen eigenen Bild-Link und die Möglichkeit, gar kein Bild zu zeigen.
 */
export function CoverPicker({ book, current, onPick, onClose }: {
  book: { isbn?: string | null; title: string; author?: string };
  current?: string | null;
  onPick: (url: string | null) => Promise<void> | void;
  onClose: () => void;
}) {
  const [list, setList] = useState<Candidate[] | null>(null);
  const [own, setOwn] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<string | null>(null);
  const [upErr, setUpErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    loadSheetCovers().then((l) => { if (alive) setSheet(sheetCoverFor(l, book.title, book.author)); });
    return () => { alive = false; };
  }, [book.title, book.author]);

  async function upload(f: File | undefined) {
    if (!f) return;
    setUpErr(null);
    try { await pick(await shrinkCoverFile(f)); }
    catch { setUpErr("Das Bild konnte nicht gelesen werden. Probier ein JPG oder PNG."); }
  }

  useEffect(() => {
    let alive = true;
    coverCandidates(book).then((c) => { if (alive) setList(c); }).catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, [book.isbn, book.title, book.author]);

  async function pick(url: string | null) {
    setBusy(true);
    try { await onPick(url); onClose(); } finally { setBusy(false); }
  }

  const sure = list?.filter((c) => c.sure) ?? [];
  const unsure = list?.filter((c) => !c.sure) ?? [];

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Cover auswählen">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h2 style={{ margin: 0 }}>Cover auswählen</h2>
          <button className="btn ghost small" onClick={onClose}>Schließen</button>
        </div>
        <p className="muted" style={{ margin: 0 }}>{book.title}{book.author ? `, ${book.author}` : ""}{book.isbn ? ` · ISBN ${book.isbn}` : " · ohne ISBN"}</p>

        {list === null && <p className="muted">Suche in Open Library und Google Books…</p>}
        {list !== null && !list.length && <p className="muted">Keine Vorschläge gefunden. Unten kannst du einen eigenen Bild-Link eintragen.</p>}

        {sure.length > 0 && (
          <>
            <h3 style={{ margin: 0 }}>Passt zu Titel und Autor:in</h3>
            <div className="cover-grid">{sure.map((c) => <Choice key={c.url} c={c} active={c.url === current} onPick={pick} busy={busy} />)}</div>
          </>
        )}
        {unsure.length > 0 && (
          <>
            <h3 style={{ margin: 0 }}>Weitere Vorschläge <span className="muted" style={{ fontWeight: 400 }}>(bitte genau hinschauen)</span></h3>
            <div className="cover-grid">{unsure.map((c) => <Choice key={c.url} c={c} active={c.url === current} onPick={pick} busy={busy} />)}</div>
          </>
        )}

        <h3 style={{ margin: 0 }}>Eigenes Cover hochladen</h3>
        <p className="muted" style={{ margin: 0 }}>Foto vom Buch machen oder ein Bild aus deinen Dateien wählen. Es wird automatisch verkleinert und gespeichert.</p>
        <div className="actions">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
          <button className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>Bild hochladen</button>
          {upErr && <span className="muted">{upErr}</span>}
        </div>

        {sheet && (
          <>
            <h3 style={{ margin: 0 }}>Aus deiner alten Tabelle</h3>
            <div className="cover-grid"><Choice c={{ url: sheet, label: "Tabelle", source: "openlibrary", sure: true }} active={sheet === current} onPick={pick} busy={busy} /></div>
          </>
        )}

        <h3 style={{ margin: 0 }}>Bild-Link einfügen</h3>
        <p className="muted" style={{ margin: 0 }}>Bild im Netz suchen (z. B. beim Verlag oder Buchhändler), Rechtsklick auf das Bild, „Bildadresse kopieren“, hier einfügen.</p>
        <div className="actions" style={{ flexWrap: "nowrap" }}>
          <input className="input" style={{ flex: 1 }} type="url" placeholder="https://…" value={own} onChange={(e) => setOwn(e.target.value)} />
          <button className="btn primary" disabled={!own.trim() || busy} onClick={() => pick(own.trim())}>Übernehmen</button>
        </div>
        {own.trim() && <img src={own.trim()} alt="" style={{ maxHeight: 160, borderRadius: 6, alignSelf: "flex-start" }} />}

        {current && <div className="actions"><button className="btn danger" disabled={busy} onClick={() => pick(null)}>Kein Bild, farbigen Einband zeigen</button></div>}
      </div>
    </div>
  );
}

function Choice({ c, active, onPick, busy }: { c: Candidate; active: boolean; onPick: (u: string) => void; busy: boolean }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <button className={"cover-choice" + (active ? " active" : "")} disabled={busy} onClick={() => onPick(c.url)} title={c.label}>
      <img src={c.url} alt="" loading="lazy" onLoad={(e) => { if (e.currentTarget.naturalWidth <= 1) setOk(false); }} onError={() => setOk(false)} />
      <span>{c.label}</span>
    </button>
  );
}
