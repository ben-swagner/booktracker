import { useMemo, useState } from "react";
import { useDeleteChallenge, useDeleteChallengeEntry, useEntries, useSaveChallenge, useSaveChallengeEntry, useSaveGoal } from "../data/hooks";
import type { Challenge, ChallengeEntry, Entry } from "../data/types";
import { readEvents, seriesNo } from "../lib/stats";
import { Link } from "../components/Link";
import { Empty } from "../components/ui";
import { toast } from "../App";
import { KaufstoppCard, subReadSince } from "../components/Kaufstopp";
import { today } from "../lib/labels";

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

type GoalKey = "books" | "sub" | "series";
const GOALS: Record<GoalKey, { field: "books_goal" | "sub_goal" | "series_goal"; title: string; question: string }> = {
  books: { field: "books_goal", title: "Bücher lesen", question: "Wie viele Bücher möchtest du dieses Jahr lesen?" },
  sub: { field: "sub_goal", title: "Vom SuB lesen", question: "Wie viele Bücher von deinem SuB möchtest du dieses Jahr lesen?" },
  series: { field: "series_goal", title: "Reihen beenden", question: "Wie viele Reihen möchtest du dieses Jahr beenden?" }
};

/** Ein einzelnes Jahresziel als eigene Karte mit Ring, Balken und Knopf zum Ändern. */
function GoalCard({ title, emoji, value, target, unit, lines, onEdit, color }: {
  title: string; emoji: string; value: number; target: number | null; unit: string; lines: (string | null)[]; onEdit: () => void; color: "blue" | "lilac" | "green";
}) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const done = !!target && value >= target;
  return (
    <div className={`panel goal-card gc-${color}` + (done ? " done" : "")}>
      <div className="goal-card-head">
        <h3><span aria-hidden="true">{emoji}</span> {title}</h3>
        <button type="button" className="btn ghost small" onClick={onEdit}>{target ? "Ziel ändern" : "Ziel setzen"}</button>
      </div>
      <div className="goal-card-main">
        <Ring value={value} target={target} label={unit} />
        <div className="goal-card-text">
          {target ? (
            <p className="goal-big">{done ? "Ziel erreicht! 🎉" : <>Noch <strong>{target - value}</strong> bis {target}</>}</p>
          ) : (
            <p className="goal-big muted">Noch kein Ziel gesetzt</p>
          )}
          {target ? <div className="goalbar"><div style={{ width: `${pct}%` }} /></div> : null}
          {lines.filter(Boolean).map((l) => <p key={l!} className="meta" style={{ margin: 0 }}>{l}</p>)}
        </div>
      </div>
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
  const [edit, setEdit] = useState<GoalKey | null>(null);
  const [draft, setDraft] = useState("");
  const [newCh, setNewCh] = useState<{ name: string; kind: "liste" | "bingo" | "kaufstopp"; target: string; ends: string; start?: string } | null>(null);
  const [cell, setCell] = useState<ChallengeEntry | null>(null);
  const [newLabel, setNewLabel] = useState<Record<string, string>>({});

  const goal = lib?.goals.find((g) => g.year === year);
  const stats = useMemo(() => {
    const ev = readEvents(entries).filter((x) => x.year === year);
    const sub = entries.filter((e) => e.mine.status === "tbr").length;
    // Vom SuB: erstmals gelesen und schon vorher im Regal (gleiche Regel wie beim Kaufstopp)
    const subRead = subReadSince(entries, `${year}-01-01`).filter((x) => x.date.startsWith(String(year))).length;
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
    if (!edit) return;
    const v = draft.trim() === "" ? null : Math.max(0, Number(draft));
    const next = { books_goal: goal?.books_goal ?? null, sub_goal: goal?.sub_goal ?? null, series_goal: goal?.series_goal ?? null, [GOALS[edit].field]: v };
    await saveGoal.mutateAsync({ user_id: "", year, ...next });
    setEdit(null);
    toast(v ? "Ziel gespeichert." : "Ziel entfernt.");
  }
  const openEdit = (k: GoalKey) => { setDraft(goal?.[GOALS[k].field]?.toString() ?? ""); setEdit(k); };
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
          <p className="lede">{stats.read} Bücher und {stats.pages.toLocaleString("de-DE")} Seiten dieses Jahr{stats.pace != null ? <>. Nach Plan wärst du jetzt bei <strong>{stats.pace}</strong>{stats.read >= stats.pace ? ", du liegst vorn" : ", du holst das auf"}.</> : "."}</p>
        </div>
      </div>

      <section className="goal-cards">
        <GoalCard
          title="Bücher lesen" emoji="📚" value={stats.read} target={goal?.books_goal ?? null} unit="Bücher"
          lines={[
            `${stats.pages.toLocaleString("de-DE")} Seiten gelesen`,
            goal?.books_goal && stats.pace != null ? (stats.read >= stats.pace ? `Du liegst vorn: Nach Plan wärst du bei ${stats.pace}.` : `Nach Plan wärst du bei ${stats.pace}, noch ${stats.pace - stats.read} aufholen.`) : null
          ]}
          onEdit={() => openEdit("books")} color="blue"
        />
        <GoalCard
          title="Vom SuB lesen" emoji="🗂️" value={stats.subRead} target={goal?.sub_goal ?? null} unit="SuB-Bücher"
          lines={[`Auf dem SuB liegen gerade ${stats.sub} Bücher.`]}
          onEdit={() => openEdit("sub")} color="lilac"
        />
        <GoalCard
          title="Reihen beenden" emoji="🔗" value={stats.seriesDone} target={goal?.series_goal ?? null} unit="Reihen"
          lines={["Zählt Reihen, deren letzter Band dieses Jahr beendet wurde."]}
          onEdit={() => openEdit("series")} color="green"
        />
      </section>

      {edit && (
        <div className="modal-bg" onClick={() => setEdit(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submitGoal}>
            <h2>{GOALS[edit].title} {year}</h2>
            <div className="field"><label htmlFor="g1">{GOALS[edit].question}</label><input id="g1" className="input" type="number" min={0} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="leer lassen = kein Ziel" /></div>
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
