import { useState, type ComponentType } from "react";
import type { Challenge, ChallengeEntry, Entry } from "../data/types";
import { useDeleteChallengeEntry, useSaveChallenge, useSaveChallengeEntry } from "../data/hooks";
import { today } from "../lib/labels";
import { toast } from "../App";

/**
 * Kaufstopp-Challenge: zählt die Tage ohne neuen Buchkauf.
 * Gespeichert wird ohne eigene Tabelle in den Challenge-Einträgen:
 *   „start:JJJJ-MM-TT“            = Beginn der Challenge
 *   „kauf:JJJJ-MM-TT|Notiz“       = ein Rückfall, danach beginnt die Zählung neu
 *   „belohnung:JJJJ-MM-TT|Notiz“  = ein verdienter Kauf (Belohnung), der Zähler läuft weiter
 * Belohnung: alle `target` gelesenen SuB-Bücher (Standard 5, 0 = aus) darf ein Buch gekauft werden.
 */
export type Purchase = { entry: ChallengeEntry; date: string; note: string; reward: boolean };

const DAY = 86400000;
const days = (from: string, to: string) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / DAY));
const de = (iso: string) => iso.split("-").reverse().join(".");
const MILESTONES = [7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 730, 1000];
export const DEFAULT_REWARD_EVERY = 5;

/**
 * SuB-Bücher, die seit dem Start gelesen wurden: erster Durchgang (kein Reread) mit Beendet-Datum ab dem Start.
 * Nicht mit gezählt werden Bücher, die erst während der Challenge eingetragen und gleich gelesen wurden
 * (z. B. aus der Stadtbibliothek). Der Tag des großen Imports zählt dabei als „schon im Regal“.
 */
export function subReadSince(entries: Entry[], start: string) {
  const perDay = new Map<string, number>();
  for (const e of entries) { const d = (e.mine.created_at ?? "").slice(0, 10); if (d) perDay.set(d, (perDay.get(d) ?? 0) + 1); }
  const importDay = [...perDay.entries()].filter(([, n]) => n >= 50).sort((a, b) => b[1] - a[1])[0]?.[0];
  const out: { e: Entry; date: string }[] = [];
  for (const e of entries) {
    for (const r of e.readings) {
      if (r.abandoned || r.read_number !== 1 || !r.finished_on || r.finished_on < start) continue;
      const added = (e.mine.created_at ?? "").slice(0, 10);
      const began = r.started_on ?? r.finished_on;
      if (added && added !== importDay && added > start && added >= began) continue;
      out.push({ e, date: r.finished_on });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function parseKaufstopp(c: Challenge, es: ChallengeEntry[], entries: Entry[] = []) {
  const startEntry = es.find((e) => e.label?.startsWith("start:"));
  const start = startEntry?.label?.slice(6) || (c.created_at ?? today()).slice(0, 10);
  const purchases: Purchase[] = es
    .filter((e) => e.label?.startsWith("kauf:") || e.label?.startsWith("belohnung:"))
    .map((e) => {
      const reward = e.label!.startsWith("belohnung:");
      const [date, ...rest] = e.label!.slice(reward ? 10 : 5).split("|");
      return { entry: e, date, note: rest.join("|"), reward };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const fails = purchases.filter((p) => !p.reward);
  const now = today();
  const streakStart = fails.length ? fails[fails.length - 1].date : start;
  const current = days(streakStart, now);
  // Längste Strecke: zwischen Start, allen Rückfällen und heute (Belohnungen unterbrechen nichts)
  const marks = [start, ...fails.map((p) => p.date), now];
  let best = 0;
  for (let i = 1; i < marks.length; i++) best = Math.max(best, days(marks[i - 1], marks[i]));

  const every = c.target == null ? DEFAULT_REWARD_EVERY : c.target;
  const subRead = subReadSince(entries, start);
  const earned = every > 0 ? Math.floor(subRead.length / every) : 0;
  const used = purchases.filter((p) => p.reward).length;
  const available = Math.max(0, earned - used);
  const towardNext = every > 0 ? subRead.length % every : 0;
  return { start, purchases, fails, streakStart, current, best, every, subRead, earned, used, available, towardNext };
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
  const saveCh = useSaveChallenge();
  const [buy, setBuy] = useState<{ date: string; note: string; book: string | null } | null>(null);
  const k = parseKaufstopp(c, es, entries);
  const next = MILESTONES.find((m) => m > k.current) ?? k.current + 100;
  const prev = [...MILESTONES].reverse().find((m) => m <= k.current) ?? 0;
  const pct = Math.round(((k.current - prev) / (next - prev)) * 100);
  const bookTitle = (id?: string | null) => entries.find((e) => e.book.id === id)?.book.title;
  const isRecord = k.current > 0 && k.current >= k.best;

  async function savePurchase(reward: boolean) {
    if (!buy) return;
    const note = buy.note.trim().replace(/\|/g, "/");
    await saveEntry.mutateAsync({ challenge_id: c.id, label: `${reward ? "belohnung" : "kauf"}:${buy.date}|${note}`, book_id: buy.book, done: true, position: es.length + 1 });
    setBuy(null);
    toast(reward ? "Belohnung eingelöst. Viel Spaß mit dem neuen Buch, der Zähler läuft weiter!" : "Eingetragen. Der Zähler startet neu, du schaffst das!");
  }

  async function changeEvery() {
    const v = prompt("Nach wie vielen gelesenen SuB-Büchern darfst du ein neues Buch kaufen? (0 schaltet die Belohnung aus)", String(k.every));
    if (v == null) return;
    const n = Math.max(0, Math.round(Number(v)));
    if (Number.isNaN(n)) return;
    await saveCh.mutateAsync({ id: c.id, name: c.name, kind: c.kind, target: n });
    toast(n ? `Belohnung jetzt alle ${n} SuB-Bücher.` : "Belohnung ausgeschaltet.");
  }

  return (
    <div className="panel kaufstopp">
      <div className="section-head">
        <div>
          <h3>{c.name}</h3>
          <p className="meta" style={{ margin: 0 }}>Gestartet am {de(k.start)}{k.fails.length ? ` · ${k.fails.length} ${k.fails.length === 1 ? "Rückfall" : "Rückfälle"}` : " · noch kein Rückfall"}</p>
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
            {k.current === 0 ? (k.fails.length ? "Neuer Anlauf ab heute. Ab morgen zählt wieder jeder Tag." : "Heute geht es los. Ab morgen zählt jeder Tag ohne neues Buch.") : <>ohne neues Buch, seit {de(k.streakStart)}</>}
          </p>
          <div className="ks-bar" aria-label={`Noch ${next - k.current} Tage bis ${next}`}><div style={{ width: `${pct}%` }} /></div>
          <p className="meta" style={{ margin: 0 }}>
            Noch {next - k.current} {next - k.current === 1 ? "Tag" : "Tage"} bis zur Marke {next}
            {" · "}{isRecord ? "Das ist dein Rekord!" : `Rekord: ${k.best} Tage`}
          </p>
        </div>
      </div>

      {k.every > 0 ? (
        <div className={"ks-reward" + (k.available ? " ready" : "")}>
          <div className="ks-reward-head">
            <strong>{k.available ? `🎁 ${k.available === 1 ? "1 Belohnung" : `${k.available} Belohnungen`} verfügbar` : "🎁 Belohnung"}</strong>
            <button type="button" className="btn ghost small" onClick={changeEvery} title="Ändern, nach wie vielen SuB-Büchern es eine Belohnung gibt">alle {k.every} SuB-Bücher ✎</button>
          </div>
          <div className="ks-dots" aria-label={`${k.towardNext} von ${k.every} SuB-Büchern bis zur nächsten Belohnung`}>
            {Array.from({ length: k.every }, (_, i) => <span key={i} className={i < k.towardNext ? "on" : ""} />)}
          </div>
          <p className="meta" style={{ margin: 0 }}>
            {k.towardNext} von {k.every} SuB-Büchern bis zur nächsten Belohnung · seit dem Start {k.subRead.length} vom SuB gelesen, {k.used} {k.used === 1 ? "Belohnung" : "Belohnungen"} eingelöst
          </p>
        </div>
      ) : (
        <p className="meta" style={{ margin: 0 }}>Belohnung ausgeschaltet. <button type="button" className="btn ghost small" onClick={changeEvery}>Einschalten</button></p>
      )}

      <div className="actions">
        <button className="btn ks-fail" onClick={() => setBuy({ date: today(), note: "", book: null })}>Ich habe ein Buch gekauft</button>
      </div>

      {k.purchases.length > 0 && (
        <details className="ks-history">
          <summary>Bisherige Käufe ({k.purchases.length})</summary>
          {[...k.purchases].reverse().map((p) => (
            <div key={p.entry.id} className="ks-row">
              <span className="mono">{de(p.date)}</span>
              <span className="ks-tag">{p.reward ? "🎁 Belohnung" : "Rückfall"}</span>
              <span style={{ flex: 1 }}>{[bookTitle(p.entry.book_id), p.note].filter(Boolean).join(" · ") || "ohne Angabe"}</span>
              <button type="button" className="btn ghost small" title="Eintrag löschen (zum Beispiel wenn er aus Versehen eingetragen wurde)" onClick={() => { if (confirm("Diesen Kauf wieder aus der Liste löschen? Der Zähler rechnet dann neu.")) delEntry.mutate(p.entry.id); }}>✕</button>
            </div>
          ))}
        </details>
      )}

      {buy && (
        <div className="modal-bg" onClick={() => setBuy(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); savePurchase(false); }}>
            <h2>Neues Buch gekauft</h2>
            {k.available > 0 ? (
              <p className="meta" style={{ margin: 0 }}>Du hast dir {k.available === 1 ? "eine Belohnung" : `${k.available} Belohnungen`} verdient. Löst du sie ein, läuft dein Zähler einfach weiter.</p>
            ) : (
              <p className="meta" style={{ margin: 0 }}>Passiert. Trag es ein, dann startet der Zähler ab diesem Tag neu. {k.every > 0 ? `Noch ${k.every - k.towardNext} SuB-Bücher, dann wäre es eine Belohnung gewesen.` : ""}</p>
            )}
            <div className="field"><label htmlFor="ksd">Wann?</label><input id="ksd" className="input" type="date" max={today()} min={k.start} value={buy.date} onChange={(e) => setBuy({ ...buy, date: e.target.value })} required /></div>
            <BookPicker entries={entries} value={buy.book} onChange={(id) => setBuy({ ...buy, book: id })} />
            <div className="field"><label htmlFor="ksn">Notiz (optional)</label><input id="ksn" className="input" placeholder="z. B. „Signierte Ausgabe“" value={buy.note} onChange={(e) => setBuy({ ...buy, note: e.target.value })} /></div>
            <div className="actions" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => setBuy(null)}>Abbrechen</button>
              {k.available > 0 ? (
                <>
                  <button type="submit" className="btn">Als Rückfall zählen</button>
                  <button type="button" className="btn primary" onClick={() => savePurchase(true)}>🎁 Belohnung einlösen</button>
                </>
              ) : (
                <button className="btn primary" type="submit">Eintragen und neu starten</button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
