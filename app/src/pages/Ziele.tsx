import { Icon } from "../components/Icon";
import { useMemo, useState } from "react";
import { useDeleteChallenge, useDeleteChallengeEntry, useEntries, useSaveChallenge, useSaveChallengeEntry, useSaveGoal } from "../data/hooks";
import type { Challenge, ChallengeEntry, Entry } from "../data/types";
import { Link } from "../components/Link";
import { Empty } from "../components/ui";
import { toast } from "../App";
import { KaufstoppCard } from "../components/Kaufstopp";
import { SeriesGoalCard, SubGoalCard, YearGoalCard, goalStats } from "../components/GoalCards";
import { today } from "../lib/labels";

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

type GoalKey = "books" | "sub";
/** Jahr 0 steht für die dauerhaften Ziele ohne Jahresbezug (SuB abbauen). */
const LASTING = 0;

export default function Ziele() {
  const { entries, lib, isLoading } = useEntries();
  const saveGoal = useSaveGoal();
  const saveCh = useSaveChallenge();
  const delCh = useDeleteChallenge();
  const saveEntry = useSaveChallengeEntry();
  const delEntry = useDeleteChallengeEntry();
  const year = new Date().getFullYear();
  const [edit, setEdit] = useState<GoalKey | null>(null);
  const [draft, setDraft] = useState("");
  const [newCh, setNewCh] = useState<{ name: string; kind: "liste" | "bingo" | "kaufstopp"; target: string; ends: string; start?: string } | null>(null);
  const [cell, setCell] = useState<ChallengeEntry | null>(null);
  const [newLabel, setNewLabel] = useState<Record<string, string>>({});

  const goal = lib?.goals.find((g) => g.year === year);
  const lasting = lib?.goals.find((g) => g.year === LASTING);
  const stats = useMemo(() => goalStats(entries, year), [entries, year]);

  if (isLoading || !lib) return <p className="muted">Lade…</p>;

  async function submitGoal(ev: React.FormEvent) {
    ev.preventDefault();
    if (!edit) return;
    const v = draft.trim() === "" ? null : Math.max(0, Number(draft));
    if (edit === "books") {
      await saveGoal.mutateAsync({ user_id: "", year, books_goal: v, sub_goal: goal?.sub_goal ?? null, series_goal: goal?.series_goal ?? null });
    } else {
      // Startpunkt merken, damit sich der Fortschritt berechnen lässt; beim Ändern des Ziels bleibt er erhalten.
      const start = v == null ? null : lasting?.books_goal ?? stats.tbr;
      await saveGoal.mutateAsync({ user_id: "", year: LASTING, sub_goal: v, books_goal: start, series_goal: null });
    }
    setEdit(null);
    toast(v ? "Ziel gespeichert." : "Ziel entfernt.");
  }
  const openEdit = (k: GoalKey) => { setDraft((k === "books" ? goal?.books_goal : lasting?.sub_goal)?.toString() ?? ""); setEdit(k); };
  async function createChallenge(ev: React.FormEvent) {
    ev.preventDefault();
    if (!newCh?.name.trim()) return;
    if (newCh.kind === "kaufstopp") {
      const c = await saveCh.mutateAsync({ name: newCh.name.trim(), kind: "kaufstopp", target: newCh.target === "" ? 5 : Math.max(0, Number(newCh.target)), ends_on: null, description: "Tage ohne neuen Buchkauf" });
      await saveEntry.mutateAsync({ challenge_id: c.id, label: `start:${newCh.start || today()}`, position: 0, done: false });
      setNewCh(null);
      toast("Kaufstopp gestartet. Viel Erfolg!");
      return;
    }
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
          <p className="lede"><strong>{stats.read}</strong> Bücher und <strong>{stats.pages.toLocaleString("de-DE")}</strong> Seiten dieses Jahr.</p>
        </div>
      </div>

      <section className="gcards">
        <YearGoalCard s={stats} goal={goal} year={year} onEdit={() => openEdit("books")} />
        <h2 className="gcards-title">Dauerhafte Ziele</h2>
        <SubGoalCard s={stats} goal={lasting} onEdit={() => openEdit("sub")} />
        <SeriesGoalCard s={stats} />
      </section>

      {edit && (
        <div className="modal-bg" onClick={() => setEdit(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submitGoal}>
            <h2>{edit === "books" ? `Jahresziel ${year}` : "SuB abbauen"}</h2>
            <div className="field">
              <label htmlFor="g1">{edit === "books" ? "Wie viele Bücher möchtest du dieses Jahr lesen?" : `Auf wie viele Bücher soll dein SuB schrumpfen? Gerade sind es ${stats.tbr}.`}</label>
              <input id="g1" className="input" type="number" min={0} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={edit === "books" ? "leer lassen = kein Ziel" : "0 = ganz leer, leer lassen = kein Ziel"} />
              {edit === "sub" && <p className="meta" style={{ margin: "6px 0 0" }}>Dieses Ziel gilt ohne Enddatum. Der Fortschritt zählt ab dem Tag, an dem du es zum ersten Mal festlegst.</p>}
            </div>
            <div className="actions" style={{ justifyContent: "flex-end" }}><button type="button" className="btn" onClick={() => setEdit(null)}>Abbrechen</button><button className="btn primary" type="submit">Speichern</button></div>
          </form>
        </div>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Challenges</h2>
          <button className="btn small" onClick={() => setNewCh({ name: "", kind: "liste", target: "", ends: `${year}-12-31` })}>+ Neue Challenge</button>
        </div>
        {lib.challenges.length === 0 && <Empty title="Noch keine Challenge" text="Ein Bingo mit 25 Feldern, eine Liste mit Ziel oder ein Kaufstopp, der die Tage ohne neues Buch zählt." />}
        {lib.challenges.map((c) => {
          const es = entriesOf(c);
          const done = es.filter((e) => e.done).length;
          if (c.kind === "kaufstopp") {
            return <KaufstoppCard key={c.id} c={c} es={es} entries={entries} BookPicker={BookPicker} onDelete={() => { if (confirm(`Challenge „${c.name}“ löschen?`)) delCh.mutate(c.id); }} />;
          }
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
                      <span className="bingo-goal">{e.label}</span>
                      {bookTitle(e.book_id)
                        ? <span className="bingo-book"><Icon name="book" size={13} /><span>{bookTitle(e.book_id)}</span></span>
                        : e.done ? <span className="bingo-check" aria-label="geschafft"><Icon name="check" size={14} /></span> : null}
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
              <select id="ck" className="input" value={newCh.kind} onChange={(e) => { const kind = e.target.value as any; setNewCh({ ...newCh, kind, name: newCh.name || (kind === "kaufstopp" ? "Kaufstopp" : "") }); }}>
                <option value="liste">Liste mit Punkten</option><option value="bingo">Bingo mit 25 Feldern</option><option value="kaufstopp">Kaufstopp: Tage ohne Buchkauf zählen</option>
              </select></div>
            {newCh.kind === "kaufstopp" && (
              <>
                <p className="meta" style={{ margin: 0 }}>Die App zählt, wie viele Tage du kein neues Buch gekauft hast. Kaufst du doch eins, trägst du es ein und der Zähler beginnt von vorn. Dein Rekord bleibt gespeichert.</p>
                <div className="field"><label htmlFor="cr">Belohnung: ein neues Buch nach wie vielen gelesenen SuB-Büchern? (0 = keine Belohnung)</label><input id="cr" className="input" type="number" min={0} value={newCh.target === "" ? "5" : newCh.target} onChange={(e) => setNewCh({ ...newCh, target: e.target.value })} /></div>
                <div className="field"><label htmlFor="cs">Gestartet am</label><input id="cs" className="input" type="date" max={today()} value={newCh.start ?? today()} onChange={(e) => setNewCh({ ...newCh, start: e.target.value })} /></div>
              </>
            )}
            {newCh.kind === "liste" && <div className="field"><label htmlFor="ct">Ziel (Anzahl, optional)</label><input id="ct" className="input" type="number" min={1} value={newCh.target} onChange={(e) => setNewCh({ ...newCh, target: e.target.value })} /></div>}
            {newCh.kind !== "kaufstopp" && <div className="field"><label htmlFor="ce">Läuft bis</label><input id="ce" className="input" type="date" value={newCh.ends} onChange={(e) => setNewCh({ ...newCh, ends: e.target.value })} /></div>}
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
