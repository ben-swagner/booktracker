import { useState, type ComponentType } from "react";
import type { Challenge, ChallengeEntry, Entry } from "../data/types";
import { useDeleteChallengeEntry, useSaveChallengeEntry } from "../data/hooks";
import { today } from "../lib/labels";
import { toast } from "../App";

/**
 * Kaufstopp-Challenge: zählt die Tage ohne neuen Buchkauf.
 * Gespeichert wird ohne eigene Tabelle in den Challenge-Einträgen:
 *   „start:JJJJ-MM-TT“  = Beginn der Challenge
 *   „kauf:JJJJ-MM-TT|Notiz“ (+ optional book_id) = ein Rückfall, danach beginnt die Zählung neu
 */
export type Purchase = { entry: ChallengeEntry; date: string; note: string };

const DAY = 86400000;
const days = (from: string, to: string) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / DAY));
const de = (iso: string) => iso.split("-").reverse().join(".");
const MILESTONES = [7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 730, 1000];

export function parseKaufstopp(c: Challenge, es: ChallengeEntry[]) {
  const startEntry = es.find((e) => e.label?.startsWith("start:"));
  const start = startEntry?.label?.slice(6) || (c.created_at ?? today()).slice(0, 10);
  const purchases: Purchase[] = es
    .filter((e) => e.label?.startsWith("kauf:"))
    .map((e) => {
      const [date, ...rest] = e.label!.slice(5).split("|");
      return { entry: e, date, note: rest.join("|") };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const now = today();
  const streakStart = purchases.length ? purchases[purchases.length - 1].date : start;
  const current = days(streakStart, now);
  // Längste Strecke: zwischen Start, allen Käufen und heute
  const marks = [start, ...purchases.map((p) => p.date), now];
  let best = 0;
  for (let i = 1; i < marks.length; i++) best = Math.max(best, days(marks[i - 1], marks[i]));
  return { start, purchases, streakStart, current, best };
}

export function KaufstoppCard({ c, es, entries, onDelete, BookPicker }: {
  c: Challenge;
  es: ChallengeEntry[];
  entries: Entry[];
  onDelete: () => void;
  BookPicker: ComponentType<{ entries: Entry[]; value?: string | null; onChange: (id: string | null) => void }>;
}) {
  const saveEntry = useSaveChallengeEntry();
  const delEntry = useDeleteChallengeEntry();
  const [fail, setFail] = useState<{ date: string; note: string; book: string | null } | null>(null);
  const k = parseKaufstopp(c, es);
  const next = MILESTONES.find((m) => m > k.current) ?? k.current + 100;
  const prev = [...MILESTONES].reverse().find((m) => m <= k.current) ?? 0;
  const pct = Math.round(((k.current - prev) / (next - prev)) * 100);
  const bookTitle = (id?: string | null) => entries.find((e) => e.book.id === id)?.book.title;
  const isRecord = k.current > 0 && k.current >= k.best;

  async function saveFail(ev: React.FormEvent) {
    ev.preventDefault();
    if (!fail) return;
    const note = fail.note.trim().replace(/\|/g, "/");
    await saveEntry.mutateAsync({ challenge_id: c.id, label: `kauf:${fail.date}|${note}`, book_id: fail.book, done: true, position: es.length + 1 });
    setFail(null);
    toast("Eingetragen. Der Zähler startet neu, du schaffst das!");
  }

  return (
    <div className="panel kaufstopp">
      <div className="section-head">
        <div>
          <h3>{c.name}</h3>
          <p className="meta" style={{ margin: 0 }}>Gestartet am {de(k.start)}{k.purchases.length ? ` · ${k.purchases.length} ${k.purchases.length === 1 ? "Rückfall" : "Rückfälle"}` : " · noch kein Rückfall"}</p>
        </div>
        <button className="btn ghost small" onClick={onDelete}>Löschen</button>
      </div>

      <div className="ks-main">
        <div className="ks-count">
          <span className="ks-num">{k.current}</span>
          <span className="ks-unit">{k.current === 1 ? "Tag" : "Tage"}</span>
        </div>
        <div className="ks-info">
          <p className="ks-line">
            {k.current === 0 ? "Heute geht es los. Ab morgen zählt jeder Tag ohne neues Buch." : <>ohne neues Buch, seit {de(k.streakStart)}</>}
          </p>
          <div className="ks-bar" aria-label={`Noch ${next - k.current} Tage bis ${next}`}><div style={{ width: `${pct}%` }} /></div>
          <p className="meta" style={{ margin: 0 }}>
            Noch {next - k.current} {next - k.current === 1 ? "Tag" : "Tage"} bis zur Marke {next}
            {" · "}{isRecord ? "Das ist dein Rekord!" : `Rekord: ${k.best} Tage`}
          </p>
        </div>
      </div>

      <div className="actions">
        <button className="btn ks-fail" onClick={() => setFail({ date: today(), note: "", book: null })}>Ich habe ein Buch gekauft</button>
      </div>

      {k.purchases.length > 0 && (
        <details className="ks-history">
          <summary>Bisherige Käufe ({k.purchases.length})</summary>
          {[...k.purchases].reverse().map((p) => (
            <div key={p.entry.id} className="ks-row">
              <span className="mono">{de(p.date)}</span>
              <span style={{ flex: 1 }}>{[bookTitle(p.entry.book_id), p.note].filter(Boolean).join(" · ") || "ohne Angabe"}</span>
              <button type="button" className="btn ghost small" title="Eintrag löschen (zum Beispiel wenn er aus Versehen eingetragen wurde)" onClick={() => { if (confirm("Diesen Kauf wieder aus der Liste löschen? Der Zähler rechnet dann neu.")) delEntry.mutate(p.entry.id); }}>✕</button>
            </div>
          ))}
        </details>
      )}

      {fail && (
        <div className="modal-bg" onClick={() => setFail(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveFail}>
            <h2>Neues Buch gekauft</h2>
            <p className="meta" style={{ margin: 0 }}>Passiert. Trag es ein, dann startet der Zähler ab diesem Tag neu. Deine bisherigen {k.current} {k.current === 1 ? "Tag" : "Tage"} bleiben in der Statistik.</p>
            <div className="field"><label htmlFor="ksd">Wann?</label><input id="ksd" className="input" type="date" max={today()} min={k.start} value={fail.date} onChange={(e) => setFail({ ...fail, date: e.target.value })} required /></div>
            <BookPicker entries={entries} value={fail.book} onChange={(id) => setFail({ ...fail, book: id })} />
            <div className="field"><label htmlFor="ksn">Notiz (optional)</label><input id="ksn" className="input" placeholder="z. B. „Signierte Ausgabe, konnte nicht widerstehen“" value={fail.note} onChange={(e) => setFail({ ...fail, note: e.target.value })} /></div>
            <div className="actions" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => setFail(null)}>Abbrechen</button>
              <button className="btn primary" type="submit">Eintragen und neu starten</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
