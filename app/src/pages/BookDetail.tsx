import { useNavigate, useParams } from "react-router-dom";
import { Link } from "../components/Link";
import { useState } from "react";
import { useDeleteReading, useDeleteUserBook, useEntries, useSaveReading, useSaveUserBook } from "../data/hooks";
import type { Entry, Reading, ReadingStatus } from "../data/types";
import { BURN, COMPANY, EXPECTATION, STATUS, STATUS_ORDER, VERDICT, euro, spiceLabel, today } from "../lib/labels";
import { Cover, SeriesNo, Stars, StatusPill, authorNames } from "../components/ui";
import { useOpenAuthor } from "../components/Authors";
import { toast } from "../App";
import { Icon } from "../components/Icon";
import { CoverPicker } from "../components/CoverPicker";
import { NO_COVER } from "../lib/covers";
import { data } from "../data";
import { useQueryClient } from "@tanstack/react-query";

/** Chips, die zur Bibliothek mit passendem Filter führen (z. B. alle Bücher mit diesem Trope). */
function Chips({ items, param }: { items?: string[]; param?: "trope" | "ohne" }) {
  if (!items?.length) return null;
  return (
    <div className="chips">
      {items.map((x) => param
        ? <Link key={x} className="chip chip-link" to={`/bibliothek?${param}=${encodeURIComponent(x)}`} title={param === "trope" ? `Alle Bücher mit „${x}“` : `Bücher ohne „${x}“`}>{x}</Link>
        : <span key={x} className="chip">{x}</span>)}
    </div>
  );
}

/** Buchseite. Mit `id` und `onClose` läuft sie als Fenster über einer anderen Seite (am Computer). */
export default function BookDetail(props: { id?: string; onClose?: () => void } = {}) {
  const params = useParams();
  const id = props.id ?? params.id;
  const inModal = !!props.onClose;
  const nav = useNavigate();
  const openAuthor = useOpenAuthor();
  const { entries, isLoading } = useEntries();
  const saveUB = useSaveUserBook();
  const saveReading = useSaveReading();
  const del = useDeleteUserBook();
  const [page, setPage] = useState<string>("");
  const [pickCover, setPickCover] = useState(false);
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
        <Cover title={b.title} author={authorNames(e)} url={b.cover_url} isbn={b.isbn13} bookId={b.id} genre={b.genre} large />
        <div className="section">
          <div className="card-top">
            <StatusPill status={m.status} />
            {e.series && <span className="tag">{e.series.name}<SeriesNo n={b.series_number} total={e.series.total_count} />{e.series.total_count ? <span className="sno-total">von {e.series.total_count}</span> : null}</span>}
            {b.series_roles?.map((r) => <span key={r} className="tag">{r}</span>)}
          </div>
          <h1 style={{ fontSize: "clamp(24px,4vw,36px)" }}>{b.title}</h1>
          {b.subtitle && <p className="lede" style={{ marginTop: 0 }}>{b.subtitle}</p>}
          <p className="book-author" style={{ fontSize: 16 }}>{e.authors.map((a, i) => <span key={a.id}>{i > 0 ? ", " : ""}<button type="button" className="linklike" onClick={() => openAuthor(a.slug)} title="Mehr über diese Autor:in">{a.name}</button></span>)}{b.original_title ? ` · Original: ${b.original_title}` : ""}</p>
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
            <button className="btn small ghost" onClick={() => setPickCover(true)}>{b.cover_url && b.cover_url !== NO_COVER ? "Cover ändern" : "Cover suchen"}</button>
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
          {b.blurb && <p className="prose" style={{ margin: 0 }}>{b.blurb}</p>}
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
          {b.tropes?.length ? <><h3>Tropes</h3><Chips items={b.tropes} param="trope" /></> : null}
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
          <Readings e={e} />
          {m.notes && <><h3>Meine Notiz</h3><p className="prose" style={{ margin: 0 }}>{m.notes}</p></>}
          {m.review && <><h3>Rezension</h3><p className="prose" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.review}</p></>}
        </div>
      </div>
      <div className="actions">
        <button className="btn danger" onClick={remove}>Aus dem Regal entfernen</button>
      </div>
      {pickCover && (
        <CoverPicker
          book={{ isbn: b.isbn13, title: b.title, author: authorNames(e) }}
          current={b.cover_url === NO_COVER ? null : b.cover_url}
          onClose={() => setPickCover(false)}
          onPick={async (url) => {
            await data.saveCover(b.id, url ?? NO_COVER);
            await qc.invalidateQueries({ queryKey: ["library"] });
            toast(url ? "Cover gespeichert." : "Bild entfernt.");
          }}
        />
      )}
    </>
  );
}

const daysBetween = (start?: string | null, end?: string | null) =>
  start && end ? Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86400000)) : null;

/**
 * Lesevorgänge eines Buchs: jede Zeile ist ein Durchgang (1. Lesen, Reread, …).
 * Daten lassen sich direkt ändern, Rereads hinzufügen und Einträge löschen.
 * Der Buchstatus folgt dem letzten Durchgang (offen = Lese ich, beendet = Gelesen).
 */
function Readings({ e }: { e: Entry }) {
  const saveReading = useSaveReading();
  const delReading = useDeleteReading();
  const saveUB = useSaveUserBook();
  const m = e.mine;
  const list = [...e.readings].sort((x, y) => x.read_number - y.read_number);
  const latest = list[list.length - 1];

  async function syncStatus(r: Reading, finished: boolean) {
    if (r.id !== latest?.id || r.abandoned) return;
    if (finished && m.status !== "gelesen") await saveUB.mutateAsync({ id: m.id, book_id: e.book.id, status: "gelesen", current_page: null });
    if (!finished && m.status === "gelesen") await saveUB.mutateAsync({ id: m.id, book_id: e.book.id, status: "lese" });
  }

  const valid = (v: string) => !v || Number(v.slice(0, 4)) >= 1900; // halb getippte Jahre nicht speichern

  async function setStart(r: Reading, v: string) {
    if (!valid(v)) return;
    const started_on = v || null;
    await saveReading.mutateAsync({ ...r, started_on, started_text: v ? null : r.started_text, days: daysBetween(started_on, r.finished_on) });
  }

  async function setEnd(r: Reading, v: string) {
    if (!valid(v)) return;
    const finished_on = v || null;
    await saveReading.mutateAsync({ ...r, finished_on, finished_text: null, days: daysBetween(r.started_on, finished_on) });
    await syncStatus(r, !!finished_on);
    toast(finished_on ? "Beendet-Datum gespeichert." : "Noch nicht beendet.");
  }

  async function addReread() {
    const n = (latest?.read_number ?? 0) + 1;
    await saveReading.mutateAsync({ user_book_id: m.id, read_number: n, started_on: today() });
    await saveUB.mutateAsync({ id: m.id, book_id: e.book.id, status: "lese", current_page: null });
    toast(n > 1 ? `Reread Nr. ${n - 1} angelegt. Die Daten kannst du in der Tabelle anpassen.` : "Lesevorgang angelegt.");
  }

  async function remove(r: Reading) {
    const label = r.read_number === 1 ? "den 1. Lesevorgang" : `den ${r.read_number}. Lesevorgang (Reread)`;
    if (!confirm(`Willst du ${label} wirklich löschen?`)) return;
    await delReading.mutateAsync(r.id);
    // Nummern wieder lückenlos machen
    const rest = list.filter((x) => x.id !== r.id);
    for (let i = 0; i < rest.length; i++) {
      if (rest[i].read_number !== i + 1) await saveReading.mutateAsync({ ...rest[i], read_number: i + 1 });
    }
    toast("Lesevorgang gelöscht.");
  }

  const label = (r: Reading) => (r.read_number === 1 ? "1. Lesen" : `Reread ${r.read_number - 1}`) + (r.abandoned ? " (abgebrochen)" : "");
  const fuzzy = (iso?: string | null, text?: string | null) => (!iso && text ? <span className="meta">bisher nur ungefähr: {text}</span> : null);

  return (
    <>
      <div className="section-head" style={{ marginTop: 6 }}>
        <h3 style={{ margin: 0 }}>Lesevorgänge{list.length > 1 ? ` · ${list.length}× gelesen` : ""}</h3>
        <button className="btn small" onClick={addReread}>{list.length ? "+ Reread eintragen" : "+ Lesevorgang eintragen"}</button>
      </div>
      {list.length > 0 ? (
        <div className="readings">
          {list.map((r) => {
            const done = !!(r.finished_on || r.finished_text);
            return (
              <div key={r.id} className={"reading" + (done ? " done" : "") + (r.abandoned ? " dnf" : "")}>
                <div className="reading-head">
                  <strong>{label(r)}</strong>
                  <span className="meta">{r.days ? `${r.days} Tage` : done || r.abandoned ? "" : "läuft"}</span>
                  <button className="btn small danger" title="Diesen Lesevorgang löschen" aria-label="Löschen" onClick={() => remove(r)}>Löschen</button>
                </div>
                <div className="reading-dates">
                  <label className="field">
                    <span>Begonnen</span>
                    <input className="input date" type="date" value={r.started_on ?? ""} max={r.finished_on ?? undefined} onChange={(ev) => setStart(r, ev.target.value)} />
                    {fuzzy(r.started_on, r.started_text)}
                  </label>
                  <label className="field">
                    <span>Beendet</span>
                    <input className="input date" type="date" value={r.finished_on ?? ""} min={r.started_on ?? undefined} onChange={(ev) => setEnd(r, ev.target.value)} />
                    {fuzzy(r.finished_on, r.finished_text)}
                  </label>
                </div>
                {!r.abandoned && (
                  <div className="actions" style={{ marginTop: 2 }}>
                    {!done && <button className="btn small" onClick={() => setEnd(r, today())}><Icon name="check" size={15} /> Heute beendet</button>}
                    {done && <button className="btn small ghost" title="Wieder auf noch nicht beendet setzen" onClick={() => setEnd(r, "")}>↺ Doch noch nicht beendet</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="meta" style={{ margin: 0 }}>Noch kein Lesevorgang eingetragen.</p>
      )}
      {list.some((r) => r.abandoned && r.abandoned_reasons?.length) && (
        <p className="meta">Abbruchgrund: {list.filter((r) => r.abandoned).flatMap((r) => r.abandoned_reasons ?? []).join(", ")}</p>
      )}
    </>
  );
}
