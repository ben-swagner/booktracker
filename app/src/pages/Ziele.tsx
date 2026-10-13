import { useMemo, useState } from "react";
import { useDeleteChallenge, useDeleteChallengeEntry, useEntries, useSaveChallenge, useSaveChallengeEntry, useSaveGoal } from "../data/hooks";
import type { Challenge, ChallengeEntry, Entry } from "../data/types";
import { readEvents, seriesNo } from "../lib/stats";
import { Link } from "../components/Link";
import { Empty } from "../components/ui";
import { toast } from "../App";

function Ring({ value, target, label }: { value: number; target: number | null; label: string }) {
  const p = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="ring" style={{ ["--p" as any]: p }}>
      <div>
        <span>{value}{target ? <small style={{ display: "inline", fontSize: 13 }}> / {target}</small> : null}</span>
        <small>{label}</small>
      </div>
    </div>
  );
}

function BookPicker({ entries, value, onChange }: { entries: Entry[]; value?: string | null; onChange: (bookId: string | null) => void }) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const nq = q.trim().toLowerCase();
    if (nq.length < 2) return [];
    return entries.filter((e) => e.book.title.toLowerCase().includes(nq)).slice(0, 8);
  }, [entries, q]);
  const current = entries.find((e) => e.book.id === value);
  return (
    <div className="field">
      <label>Buch</label>
      {current ? (
        <div className="actions"><span className="chip">{current.book.title}</span><button type="button" className="btn ghost small" onClick={() => onChange(null)}>entfernen</button></div>
      ) : (
        <>
          <input className="input" placeholder="Titel tippen…" value={q} onChange={(e) => setQ(e.target.value)} />
          {hits.length > 0 && <div className="chips">{hits.map((e) => <button type="button" key={e.mine.id} className="chip" onClick={() => { onChange(e.book.id); setQ(""); }}>{e.book.title}</button>)}</div>}
        </>
      )}
    </div>
  );
}

export default function Ziele() {
  const { entries, lib, isLoading } = useEntries();
  const saveGoal = useSaveGoal();
  const saveCh = useSaveChallenge();
  const delCh = useDeleteChallenge();
  const saveEntry = useSaveChallengeEntry();
  const delEntry = useDeleteChallengeEntry();
  const year = new Date().getFullYear();
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState({ books: "", sub: "", series: "" });
  const [newCh, setNewCh] = useState<{ name: string; kind: "liste" | "bingo"; target: string; ends: string } | null>(null);
  const [cell, setCell] = useState<ChallengeEntry | null>(null);
  const [newLabel, setNewLabel] = useState<Record<string, string>>({});

  const goal = lib?.goals.find((g) => g.year === year);
  const stats = useMemo(() => {
    const ev = readEvents(entries).filter((x) => x.year === year);
    const sub = entries.filter((e) => e.mine.status === "tbr").length;
    const subRead = ev.filter((x) => x.e.mine.status === "gelesen").length;
    // Reihen, die in diesem Jahr abgeschlossen wurden: letzter Band dieses Jahr beendet
    const bySeries = new Map<string, Entry[]>();
    for (const e of entries) if (e.series) bySeries.set(e.series.id, [...(bySeries.get(e.series.id) ?? []), e]);
    let seriesDone = 0;
    for (const vols of bySeries.values()) {
      const total = Math.max(vols[0].series?.total_count ?? 0, vols.length);
      const read = vols.filter((e) => e.mine.status === "gelesen");
      if (read.length < total || total === 0) continue;
      const last = [...read].sort((a, b) => seriesNo(b.book.series_number) - seriesNo(a.book.series_number))[0];
      if (last.readings.some((r) => (r.finished_on ?? r.finished_text ?? "").startsWith(String(year)))) seriesDone++;
    }
    const pages = ev.reduce((s, x) => s + (x.e.book.pages ?? 0), 0);
    const dayOfYear = Math.floor((Date.now() - new Date(year, 0, 1).getTime()) / 86400000) + 1;
    const pace = goal?.books_goal ? Math.round((goal.books_goal / 365) * dayOfYear) : null;
    return { read: ev.length, sub, subRead, seriesDone, pages, pace };
  }, [entries, year, goal]);

  if (isLoading || !lib) return <p className="muted">Lade…</p>;

  async function submitGoal(ev: React.FormEvent) {
    ev.preventDefault();
    await saveGoal.mutateAsync({ user_id: "", year, books_goal: draft.books ? Number(draft.books) : goal?.books_goal ?? null, sub_goal: draft.sub ? Number(draft.sub) : goal?.sub_goal ?? null, series_goal: draft.series ? Number(draft.series) : goal?.series_goal ?? null });
    setEdit(false);
    toast("Ziele gespeichert.");
  }
  async function createChallenge(ev: React.FormEvent) {
    ev.preventDefault();
    if (!newCh?.name.trim()) return;
    const c = await saveCh.mutateAsync({ name: newCh.name.trim(), kind: newCh.kind, target: newCh.target ? Number(newCh.target) : null, ends_on: newCh.ends || null });
    if (newCh.kind === "bingo") {
      for (let i = 1; i <= 25; i++) await saveEntry.mutateAsync({ challenge_id: c.id, label: `Feld ${i}`, position: i, done: false });
    }
    setNewCh(null);
    toast("Challenge angelegt.");
  }

  const entriesOf = (c: Challenge) => lib!.challenge_entries.filter((e) => e.challenge_id === c.id).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const bookTitle = (id?: string | null) => entries.find((e) => e.book.id === id)?.book.title;

  return (
    <>
      <div className="mast">
        <div>
          <h1>Ziele <em>{year}</em></h1>
          <p className="lede">{stats.read} Bücher und {stats.pages.toLocaleString("de-DE")} Seiten dieses Jahr{stats.pace != null ? <>. Nach Plan wärst du jetzt bei <strong>{stats.pace}</strong>{stats.read >= stats.pace ? ", du liegst vorn" : ", du holst das auf"}.</> : "."}</p>
        </div>
        <div className="actions"><button className="btn" onClick={() => { setDraft({ books: goal?.books_goal?.toString() ?? "", sub: goal?.sub_goal?.toString() ?? "", series: goal?.series_goal?.toString() ?? "" }); setEdit(true); }}>Ziele anpassen</button></div>
      </div>

      <div className="panel">
        <div className="goal-row">
          <Ring value={stats.read} target={goal?.books_goal ?? null} label="Bücher" />
          <Ring value={stats.subRead} target={goal?.sub_goal ?? null} label="vom SuB" />
          <Ring value={stats.seriesDone} target={goal?.series_goal ?? null} label="Reihen beendet" />
          <div className="section" style={{ flex: 1, minWidth: 200 }}>
            <p style={{ margin: 0 }}>{goal?.books_goal ? <>Jahresziel <strong>{goal.books_goal} Bücher</strong>.</> : "Noch kein Jahresziel gesetzt."}</p>
            <p className="meta">SuB im Moment: {stats.sub} Bücher. {goal?.sub_goal ? `Ziel: ${goal.sub_goal} davon dieses Jahr lesen.` : ""}</p>
            {goal?.books_goal ? <div className="goalbar" style={{ background: "var(--surface-2)" }}><div style={{ width: `${Math.min(100, (stats.read / goal.books_goal) * 100)}%` }} /></div> : null}
          </div>
        </div>
      </div>

      {edit && (
        <div className="modal-bg" onClick={() => setEdit(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submitGoal}>
            <h2>Ziele {year}</h2>
            <div className="field"><label htmlFor="g1">Bücher im Jahr</label><input id="g1" className="input" type="number" min={1} value={draft.books} onChange={(e) => setDraft({ ...draft, books: e.target.value })} /></div>
            <div className="field"><label htmlFor="g2">Davon vom SuB</label><input id="g2" className="input" type="number" min={0} value={draft.sub} onChange={(e) => setDraft({ ...draft, sub: e.target.value })} /></div>
            <div className="field"><label htmlFor="g3">Reihen beenden</label><input id="g3" className="input" type="number" min={0} value={draft.series} onChange={(e) => setDraft({ ...draft, series: e.target.value })} /></div>
            <div className="actions" style={{ justifyContent: "flex-end" }}><button type="button" className="btn" onClick={() => setEdit(false)}>Abbrechen</button><button className="btn primary" type="submit">Speichern</button></div>
          </form>
        </div>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Challenges</h2>
          <button className="btn small" onClick={() => setNewCh({ name: "", kind: "liste", target: "", ends: `${year}-12-31` })}>+ Neue Challenge</button>
        </div>
        {lib.challenges.length === 0 && <Empty title="Noch keine Challenge" text="Ein Bingo mit 25 Feldern oder eine Liste mit Ziel, du entscheidest." />}
        {lib.challenges.map((c) => {
          const es = entriesOf(c);
          const done = es.filter((e) => e.done).length;
          return (
            <div key={c.id} className="panel section">
              <div className="section-head">
                <div>
                  <h3>{c.name}</h3>
                  <p className="meta">{c.kind === "bingo" ? `${done} von ${es.length} Feldern` : `${done}${c.target ? ` von ${c.target}` : ""} geschafft`}{c.ends_on ? ` · bis ${c.ends_on.split("-").reverse().join(".")}` : ""}</p>
                </div>
                <button className="btn ghost small" onClick={() => { if (confirm(`Challenge „${c.name}“ löschen?`)) delCh.mutate(c.id); }}>Löschen</button>
              </div>
              {c.kind === "bingo" ? (
                <div className="bingo">
                  {es.map((e) => (
                    <button key={e.id} type="button" className={"bingo-cell" + (e.done ? " done" : "")} onClick={() => setCell(e)}>
                      <span>{e.label}</span>
                      <small>{bookTitle(e.book_id) ?? (e.done ? "✓" : "")}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <div>
                  {es.map((e) => (
                    <div key={e.id} className="vol-row">
                      <input type="checkbox" checked={!!e.done} onChange={(ev) => saveEntry.mutate({ id: e.id, challenge_id: c.id, done: ev.target.checked })} aria-label="erledigt" />
                      <button type="button" className="btn ghost small" style={{ justifyContent: "flex-start", textAlign: "left" }} onClick={() => setCell(e)}>
                        {e.label || bookTitle(e.book_id) || "(ohne Titel)"}{e.label && bookTitle(e.book_id) ? <span className="muted"> · {bookTitle(e.book_id)}</span> : null}
                      </button>
                      <button type="button" className="btn ghost small" onClick={() => delEntry.mutate(e.id)}>✕</button>
                    </div>
                  ))}
                  <form className="actions" style={{ marginTop: 8 }} onSubmit={async (ev) => { ev.preventDefault(); const l = (newLabel[c.id] ?? "").trim(); if (!l) return; await saveEntry.mutateAsync({ challenge_id: c.id, label: l, position: es.length + 1, done: false }); setNewLabel({ ...newLabel, [c.id]: "" }); }}>
                    <input className="input" style={{ flex: 1 }} placeholder="Neuer Punkt, z. B. „Ein Buch mit blauem Cover“" value={newLabel[c.id] ?? ""} onChange={(e) => setNewLabel({ ...newLabel, [c.id]: e.target.value })} />
                    <button className="btn small" type="submit">Hinzufügen</button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {newCh && (
        <div className="modal-bg" onClick={() => setNewCh(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={createChallenge}>
            <h2>Neue Challenge</h2>
            <div className="field"><label htmlFor="cn">Name</label><input id="cn" className="input" value={newCh.name} onChange={(e) => setNewCh({ ...newCh, name: e.target.value })} placeholder={`Bookish Bingo ${year}`} /></div>
            <div className="field"><label htmlFor="ck">Art</label>
              <select id="ck" className="input" value={newCh.kind} onChange={(e) => setNewCh({ ...newCh, kind: e.target.value as any })}>
                <option value="liste">Liste mit Punkten</option><option value="bingo">Bingo mit 25 Feldern</option>
              </select></div>
            {newCh.kind === "liste" && <div className="field"><label htmlFor="ct">Ziel (Anzahl, optional)</label><input id="ct" className="input" type="number" min={1} value={newCh.target} onChange={(e) => setNewCh({ ...newCh, target: e.target.value })} /></div>}
            <div className="field"><label htmlFor="ce">Läuft bis</label><input id="ce" className="input" type="date" value={newCh.ends} onChange={(e) => setNewCh({ ...newCh, ends: e.target.value })} /></div>
            <div className="actions" style={{ justifyContent: "flex-end" }}><button type="button" className="btn" onClick={() => setNewCh(null)}>Abbrechen</button><button className="btn primary" type="submit">Anlegen</button></div>
          </form>
        </div>
      )}

      {cell && (
        <div className="modal-bg" onClick={() => setCell(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Feld bearbeiten</h2>
            <div className="field"><label htmlFor="cl">Aufgabe</label><input id="cl" className="input" value={cell.label ?? ""} onChange={(e) => setCell({ ...cell, label: e.target.value })} /></div>
            <BookPicker entries={entries} value={cell.book_id} onChange={(id) => setCell({ ...cell, book_id: id, done: id ? true : cell.done })} />
            <label className="check"><input type="checkbox" checked={!!cell.done} onChange={(e) => setCell({ ...cell, done: e.target.checked })} />Erledigt</label>
            <div className="actions" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => setCell(null)}>Abbrechen</button>
              <button type="button" className="btn primary" onClick={async () => { await saveEntry.mutateAsync({ id: cell.id, challenge_id: cell.challenge_id, label: cell.label, book_id: cell.book_id ?? null, done: !!cell.done, position: cell.position }); setCell(null); }}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      <p className="meta">Tipp: Deine Lesestatistik mit Genres, Monaten und Autor:innen findest du unter <Link to="/statistik">Statistik</Link>.</p>
    </>
  );
}
