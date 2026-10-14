import { useNavigate, useParams } from "react-router-dom";
import { Link } from "../components/Link";
import { useState } from "react";
import { useDeleteUserBook, useEntries, useSaveReading, useSaveUserBook } from "../data/hooks";
import type { Reading, ReadingStatus } from "../data/types";
import { BURN, COMPANY, EXPECTATION, STATUS, STATUS_ORDER, VERDICT, euro, fmtDate, spiceLabel, today } from "../lib/labels";
import { Cover, Stars, StatusPill, authorNames } from "../components/ui";
import { toast } from "../App";
import { lookupIsbn } from "../lib/isbn";
import { data } from "../data";
import { useQueryClient } from "@tanstack/react-query";

function Chips({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return <div className="chips">{items.map((x) => <span key={x} className="chip">{x}</span>)}</div>;
}

/** Buchseite. Mit `id` und `onClose` läuft sie als Fenster über einer anderen Seite (am Computer). */
export default function BookDetail(props: { id?: string; onClose?: () => void } = {}) {
  const params = useParams();
  const id = props.id ?? params.id;
  const inModal = !!props.onClose;
  const nav = useNavigate();
  const { entries, isLoading } = useEntries();
  const saveUB = useSaveUserBook();
  const saveReading = useSaveReading();
  const del = useDeleteUserBook();
  const [page, setPage] = useState<string>("");
  const qc = useQueryClient();

  if (isLoading) return <p className="muted">Lade…</p>;
  const e = entries.find((x) => x.mine.id === id);
  if (!e) return <p className="muted">Dieses Buch gibt es nicht (mehr).</p>;
  const { book: b, mine: m } = e;

  async function setStatus(status: ReadingStatus) {
    await saveUB.mutateAsync({ id: m.id, book_id: b.id, status });
    if (status === "lese" && !e!.readings.some((r) => !r.finished_on && !r.abandoned)) {
      await saveReading.mutateAsync({ user_book_id: m.id, read_number: e!.readings.length + 1, started_on: today() });
    }
    toast(`Status: ${STATUS[status]}`);
  }

  async function finish() {
    const open = e!.readings.find((r) => !r.finished_on && !r.abandoned);
    const start = open?.started_on;
    const days = start ? Math.max(1, Math.round((Date.parse(today()) - Date.parse(start)) / 86400000)) : null;
    await saveReading.mutateAsync({ ...(open ?? { user_book_id: m.id, read_number: e!.readings.length + 1 }), user_book_id: m.id, finished_on: today(), days });
    await saveUB.mutateAsync({ id: m.id, book_id: b.id, status: "gelesen", current_page: null });
    toast("Geschafft! Buch als gelesen eingetragen.");
  }

  /** Einen Lesevorgang als beendet markieren oder das wieder zurücknehmen. Hält den Buchstatus passend. */
  async function toggleFinished(r: Reading) {
    const isLatest = r.read_number === Math.max(...e!.readings.map((x) => x.read_number));
    if (r.finished_on || r.finished_text) {
      await saveReading.mutateAsync({ ...r, finished_on: null, finished_text: null, days: null });
      if (isLatest && m.status === "gelesen") await saveUB.mutateAsync({ id: m.id, book_id: b.id, status: "lese" });
      toast("Zurückgenommen: noch nicht beendet.");
    } else {
      const days = r.started_on ? Math.max(1, Math.round((Date.parse(today()) - Date.parse(r.started_on)) / 86400000)) : null;
      await saveReading.mutateAsync({ ...r, finished_on: today(), days });
      if (isLatest && m.status !== "gelesen") await saveUB.mutateAsync({ id: m.id, book_id: b.id, status: "gelesen", current_page: null });
      toast("Als beendet eingetragen.");
    }
  }

  async function savePage() {
    const n = Number(page);
    if (!n) return;
    await saveUB.mutateAsync({ id: m.id, book_id: b.id, current_page: n });
    setPage("");
    toast(`Seite ${n} gemerkt.`);
  }

  async function findCover() {
    if (!b.isbn13) { toast("Ohne ISBN kann ich kein Cover suchen. Trag sie unter Bearbeiten ein."); return; }
    toast("Suche Cover…");
    try {
      const r = await lookupIsbn(b.isbn13);
      if (r?.cover_url) {
        await data.saveCover(b.id, r.cover_url);
        await qc.invalidateQueries({ queryKey: ["library"] });
        toast("Cover gefunden.");
      } else toast("Leider kein Cover gefunden. Du kannst unter Bearbeiten einen Bild-Link eintragen.");
    } catch { toast("Die Suche hat nicht geklappt."); }
  }

  async function remove() {
    if (!confirm(`„${b.title}“ wirklich aus deinem Regal entfernen?`)) return;
    await del.mutateAsync(m.id);
    if (props.onClose) props.onClose(); else nav("/bibliothek");
  }

  const fact = (label: string, v: any) => (v == null || v === "" || (Array.isArray(v) && !v.length) ? null : (
    <><dt>{label}</dt><dd>{Array.isArray(v) ? v.join(", ") : String(v)}</dd></>
  ));

  return (
    <>
      {!inModal && (
        <div className="actions">
          <button className="btn ghost" onClick={() => nav(-1)}>← Zurück</button>
        </div>
      )}
      <div className="panel detail">
        <Cover title={b.title} author={authorNames(e)} url={b.cover_url} isbn={b.isbn13} bookId={b.id} large />
        <div className="section">
          <div className="card-top">
            <StatusPill status={m.status} />
            {e.series && <span className="tag">{e.series.name}{b.series_number ? ` #${b.series_number}` : ""}{e.series.total_count ? ` von ${e.series.total_count}` : ""}</span>}
            {b.series_roles?.map((r) => <span key={r} className="tag">{r}</span>)}
          </div>
          <h1 style={{ fontSize: "clamp(24px,4vw,36px)" }}>{b.title}</h1>
          {b.subtitle && <p className="lede" style={{ marginTop: 0 }}>{b.subtitle}</p>}
          <p className="book-author" style={{ fontSize: 16 }}>{authorNames(e)}{b.original_title ? ` · Original: ${b.original_title}` : ""}</p>
          {m.rating != null && <p><Stars value={m.rating} /> <span className="mono">{m.rating}</span>{m.verdict ? ` · ${VERDICT[m.verdict]}` : ""}{m.expectation ? ` · ${EXPECTATION[m.expectation]}` : ""}</p>}
          <div className="actions">
            {STATUS_ORDER.filter((s) => s !== m.status).map((s) => (
              <button key={s} className="btn small" onClick={() => setStatus(s)}>→ {STATUS[s]}</button>
            ))}
            {m.status === "gelesen" && (() => {
              const last = [...e.readings].filter((r) => !r.abandoned).sort((x, y) => x.read_number - y.read_number).pop();
              return (
                <button className="btn small" onClick={() => (last && (last.finished_on || last.finished_text) ? toggleFinished(last) : setStatus("lese"))}>
                  ↺ Doch noch nicht beendet
                </button>
              );
            })()}
            <Link className="btn small primary" to={`/buch/${m.id}/bearbeiten`}>Bearbeiten</Link>
            {!b.cover_url && <button className="btn small ghost" onClick={findCover}>Cover suchen</button>}
          </div>
          {m.status === "lese" && (
            <div className="panel" style={{ background: "var(--lese-bg)", boxShadow: "none" }}>
              <div className="section-head">
                <strong>Wo bist du gerade?</strong>
                <span className="muted">{m.current_page ? `Seite ${m.current_page}${b.pages ? ` von ${b.pages}` : ""}` : "Noch keine Seite eingetragen"}</span>
              </div>
              {b.pages && m.current_page ? <div className="progress"><div style={{ width: `${Math.min(100, (m.current_page / b.pages) * 100)}%` }} /></div> : null}
              <div className="actions" style={{ marginTop: 10 }}>
                <input className="input" style={{ width: 120 }} type="number" min={1} max={b.pages ?? undefined} placeholder="Seite" value={page} onChange={(ev) => setPage(ev.target.value)} />
                <button className="btn small" onClick={savePage}>Seite merken</button>
                <button className="btn small primary" onClick={finish}>Fertig gelesen</button>
              </div>
            </div>
          )}
          {b.blurb && <p style={{ margin: 0 }}>{b.blurb}</p>}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <div className="panel section">
          <h3>Das Buch</h3>
          <dl className="kv">
            {fact("Art", b.kind)}{fact("Kategorie", b.category)}{fact("Genre", b.genre)}{fact("Untergenre", b.subgenres)}
            {fact("Zielgruppe", b.audience)}{fact("Sprache", b.language)}{fact("Verlag", b.publisher)}{fact("Erschienen", b.first_published)}
            {fact("Seiten", b.pages)}{fact("Kapitel", b.chapters)}{fact("ISBN", b.isbn13)}{fact("Zeit", b.period)}{fact("Schauplatz", b.setting)}
            {fact("Erzählperspektive", b.pov)}{fact("Hauptfiguren", b.main_characters)}{fact("Adaption", b.adaptations)}
          </dl>
          {b.tropes?.length ? <><h3>Tropes</h3><Chips items={b.tropes} /></> : null}
          {b.trigger_warnings?.length ? <><h3>Triggerwarnungen</h3><Chips items={b.trigger_warnings} /></> : null}
        </div>
        <div className="panel section">
          <h3>Meine Ausgabe und mein Lesen</h3>
          <dl className="kv">
            {fact("Medium", m.medium)}{fact("Format", m.format)}{fact("Edition", m.edition)}{fact("Extras", m.specials)}
            {fact("Preis", euro(m.price_cents))}{fact("Gekauft", m.bought == null ? null : m.bought ? "Ja" : "Nein")}
            {fact("Spice", spiceLabel(m.spice))}{fact("Burn", m.burn ? BURN[m.burn] : null)}{fact("Gelesen mit", m.company ? COMPANY[m.company] : null)}
            {fact("Hörbuch", m.audio_platforms)}{fact("Sprecher:in", m.narrators)}{fact("Hördauer", m.duration_min ? `${Math.floor(m.duration_min / 60)} h ${m.duration_min % 60} min` : null)}
            {fact("Adaption gesehen", m.adaptation_seen ? "Ja" : null)}
          </dl>
          {e.readings.length > 0 && (
            <>
              <h3>Lesevorgänge</h3>
              <table className="table">
                <thead><tr><th>#</th><th>Begonnen</th><th>Beendet</th><th>Tage</th></tr></thead>
                <tbody>
                  {e.readings.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.read_number}{r.abandoned ? " (abgebrochen)" : ""}</td>
                      <td className="mono">{fmtDate(r.started_on, r.started_text) || "?"}</td>
                      <td className="mono">
                        {r.abandoned ? fmtDate(r.finished_on, r.finished_text) : (
                          <button
                            className={`btn small ${r.finished_on || r.finished_text ? "" : "ghost"}`}
                            title={r.finished_on || r.finished_text ? "Antippen, um es zurückzunehmen" : "Antippen, wenn du fertig bist"}
                            onClick={() => toggleFinished(r)}
                          >
                            {r.finished_on || r.finished_text ? `✓ ${fmtDate(r.finished_on, r.finished_text)}` : "○ noch nicht beendet"}
                          </button>
                        )}
                      </td>
                      <td className="mono">{r.days ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {e.readings.some((r) => r.abandoned && r.abandoned_reasons?.length) && (
                <p className="meta">Abbruchgrund: {e.readings.filter((r) => r.abandoned).flatMap((r) => r.abandoned_reasons ?? []).join(", ")}</p>
              )}
            </>
          )}
          {m.notes && <><h3>Meine Notiz</h3><p style={{ margin: 0 }}>{m.notes}</p></>}
          {m.review && <><h3>Rezension</h3><p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.review}</p></>}
        </div>
      </div>
      <div className="actions">
        <button className="btn danger" onClick={remove}>Aus dem Regal entfernen</button>
      </div>
    </>
  );
}
