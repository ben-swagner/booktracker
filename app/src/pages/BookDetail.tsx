import { useNavigate, useParams } from "react-router-dom";
import { Link } from "../components/Link";
import { useState } from "react";
import { useDeleteReading, useDeleteUserBook, useEntries, useSaveReading, useSaveUserBook } from "../data/hooks";
import type { Entry, Reading, ReadingStatus } from "../data/types";
import { BURN, COMPANY, EXPECTATION, STATUS, STATUS_ORDER, VERDICT, euro, spiceLabel, today } from "../lib/labels";
import { Cover, SeriesNo, Stars, authorNames } from "../components/ui";
import { AuthorPhoto, useOpenAuthor } from "../components/Authors";
import { toast } from "../App";
import { Icon, type IconName } from "../components/Icon";
import { CoverPicker } from "../components/CoverPicker";
import { NO_COVER } from "../lib/covers";
import { data } from "../data";
import { useQueryClient } from "@tanstack/react-query";
import { BookAura } from "../components/Aura";

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

const STATUS_ICON: Record<ReadingStatus, IconName> = { lese: "book", tbr: "stack", ungelesen: "bookmark", gelesen: "check", abgebrochen: "pause", wunschliste: "heart" };

/** Vorschläge für die Stimmung eines Buchs; eigene Wörter gehen auch. */
const MOODS = ["gemütlich", "spannend", "romantisch", "lustig", "herzzerreißend", "düster", "nachdenklich", "hoffnungsvoll", "nervenaufreibend", "wohlig", "verstörend", "leicht"];

/** Eine Zeile mit Symbol, Bezeichnung und Wert. Bleibt leer, wenn es nichts zu zeigen gibt. */
function Fact({ icon, label, value }: { icon: IconName; label: string; value: any }) {
  if (value == null || value === "" || (Array.isArray(value) && !value.length)) return null;
  return (
    <li className="bdf">
      <span className="bdf-ico"><Icon name={icon} size={17} /></span>
      <span className="bdf-label">{label}</span>
      <span className="bdf-value">{Array.isArray(value) ? value.join(", ") : String(value)}</span>
    </li>
  );
}

function Sub({ icon, children, right }: { icon: IconName; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="bd-sub">
      <h3><Icon name={icon} size={16} /> {children}</h3>
      {right}
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
  const [stOpen, setStOpen] = useState(false);
  const [quote, setQuote] = useState("");
  const [moodText, setMoodText] = useState("");
  const [moreMoods, setMoreMoods] = useState(false);
  const [tab, setTab] = useState<"book" | "me">(() => (localStorage.getItem("bt-book-tab") === "me" ? "me" : "book"));
  const pickTab = (t: "book" | "me") => { setTab(t); try { localStorage.setItem("bt-book-tab", t); } catch { /* egal */ } };
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

  /** Stimmung und Zitate liegen in zwei neuen Spalten; fehlen sie noch in der Datenbank, sagt die App das. */
  async function savePersonal(fields: { moods?: string[]; quotes?: string[] }) {
    try {
      await saveUB.mutateAsync({ id: m.id, book_id: b.id, ...fields });
    } catch (x: any) {
      const msg = String(x?.message ?? "");
      toast(/column|moods|quotes/i.test(msg) ? "Dafür fehlt noch eine kleine Ergänzung in der Datenbank (Datei 0002 im SQL-Editor einspielen)." : msg || "Das hat nicht geklappt.");
      throw x;
    }
  }

  async function toggleMood(w: string) {
    const cur = m.moods ?? [];
    const next = cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w];
    await savePersonal({ moods: next });
  }
  async function addMood() {
    const w = moodText.trim();
    if (!w) return;
    await toggleMood(w);
    setMoodText("");
  }
  async function addQuote() {
    const q = quote.trim();
    if (!q) return;
    await savePersonal({ quotes: [...(m.quotes ?? []), q] });
    setQuote("");
    toast("Zitat gespeichert.");
  }
  async function removeQuote(i: number) {
    await savePersonal({ quotes: (m.quotes ?? []).filter((_, k) => k !== i) });
  }

  async function remove() {
    if (!confirm(`„${b.title}“ wirklich aus deinem Regal entfernen?`)) return;
    await del.mutateAsync(m.id);
    if (props.onClose) props.onClose(); else nav("/bibliothek");
  }

  const year = /^\d{4}/.test(String(b.first_published ?? "")) ? String(b.first_published).slice(0, 4) : null;
  const hasRating = m.rating != null || m.verdict || m.expectation;
  const hasEdition = [m.medium, m.format, m.edition, m.specials, m.price_cents, m.bought, m.audio_platforms, m.narrators, m.duration_min].some((v) => v != null && v !== "" && !(Array.isArray(v) && !v.length));
  const moodChoices = [...new Set([...(m.moods ?? []), ...MOODS])];
  const shownMoods = moreMoods ? moodChoices : moodChoices.slice(0, Math.max(6, (m.moods ?? []).length));

  return (
    <>
      <BookAura book={b} inline={inModal} />
      {!inModal && (
        <div className="actions">
          <button className="btn ghost" onClick={() => nav(-1)}>← Zurück</button>
        </div>
      )}

      <div className="panel detail bd-hero">
        <div className="bd-cover">
          <Cover title={b.title} author={authorNames(e)} url={b.cover_url} isbn={b.isbn13} bookId={b.id} genre={b.genre} large />
          <button className="btn small ghost bd-coverbtn" onClick={() => setPickCover(true)}><Icon name="cover" size={15} /> {b.cover_url && b.cover_url !== NO_COVER ? "Cover ändern" : "Cover suchen"}</button>
        </div>
        <div className="section bd-head">
          <div className="card-top">
            {e.series && <span className="tag">{e.series.name}<SeriesNo n={b.series_number} total={e.series.total_count} />{e.series.total_count ? <span className="sno-total">von {e.series.total_count}</span> : null}</span>}
            {b.series_roles?.map((r) => <span key={r} className="tag">{r}</span>)}
          </div>
          <h1 className="bd-title">{b.title}</h1>
          {b.subtitle && <p className="lede bd-subtitle">{b.subtitle}</p>}
          <div className="bd-authors">
            {e.authors.map((a) => (
              <button key={a.id} type="button" className="bd-author" onClick={() => openAuthor(a.slug)} title="Mehr über diese Autor:in">
                <AuthorPhoto author={a} size={40} />
                <span>{a.name}</span>
              </button>
            ))}
            {b.original_title && <span className="meta">Original: {b.original_title}</span>}
          </div>
          <ul className="bd-quick">
            {b.pages ? <li><Icon name="pages" size={16} /> {b.pages} Seiten</li> : null}
            {b.kind ? <li><Icon name="book" size={16} /> {b.kind}</li> : null}
            {b.genre ? <li><Icon name="tag" size={16} /> {b.genre}</li> : null}
            {year ? <li><Icon name="calendar" size={16} /> {year}</li> : null}
            {b.language?.length ? <li><Icon name="globe" size={16} /> {b.language.join(", ")}</li> : null}
          </ul>
          {hasRating && (
            <p className="bd-rating">
              {m.rating != null && <><Stars value={m.rating} /> <strong className="mono">{m.rating}</strong></>}
              {m.verdict ? <span className="chip">{VERDICT[m.verdict]}</span> : null}
              {m.expectation ? <span className="chip">{EXPECTATION[m.expectation]}</span> : null}
            </p>
          )}
          <div className="actions">
            <div className="st-menu-wrap">
              <button type="button" className={"st-menu-btn st-" + m.status} aria-haspopup="menu" aria-expanded={stOpen} onClick={() => setStOpen(!stOpen)}>
                <span className="st-dot" aria-hidden="true" /><span className="st-menu-label">{STATUS[m.status]}</span><Icon name="chevron" size={14} />
              </button>
              {stOpen && (
                <>
                  <div className="rf-veil" onClick={() => setStOpen(false)} />
                  <div className="st-menu" role="menu">
                    <span className="st-menu-head">Status ändern</span>
                    {STATUS_ORDER.map((s) => (
                      <button key={s} type="button" role="menuitemradio" aria-checked={s === m.status} className={"st-menu-item st-" + s + (s === m.status ? " on" : "")}
                        onClick={async () => { setStOpen(false); if (s === m.status) return; if (s === "gelesen" && e.readings.some((r) => !r.finished_on && !r.abandoned)) await finish(); else await setStatus(s); }}>
                        <span className="st-dot" aria-hidden="true" /><Icon name={STATUS_ICON[s]} size={15} /> {STATUS[s]}{s === m.status && <Icon name="check" size={15} />}
                      </button>
                    ))}
                    {m.status === "gelesen" && (() => {
                      const last = [...e.readings].filter((r) => !r.abandoned).sort((x, y) => x.read_number - y.read_number).pop();
                      return (
                        <>
                          <span className="st-menu-sep" />
                          <button type="button" role="menuitem" className="st-menu-item" onClick={() => { setStOpen(false); if (last && (last.finished_on || last.finished_text)) toggleFinished(last); else setStatus("lese"); }}>
                            <Icon name="history" size={15} /> Doch noch nicht beendet
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>
            <Link className="btn small primary" to={`/buch/${m.id}/bearbeiten`}><Icon name="pencil" size={15} /> Bearbeiten</Link>
          </div>
        </div>
      </div>

      <div className="bd-tabs" role="tablist" aria-label="Bereich">
        <button role="tab" className={"bd-tab tone-book" + (tab === "book" ? " on" : "")} aria-selected={tab === "book"} onClick={() => pickTab("book")}>
          <span className="bd-sec-ico"><Icon name="book" size={18} /></span><span><strong>Das Buch</strong><small>Angaben, die für alle gleich sind</small></span>
        </button>
        <button role="tab" className={"bd-tab tone-me" + (tab === "me" ? " on" : "")} aria-selected={tab === "me"} onClick={() => pickTab("me")}>
          <span className="bd-sec-ico"><Icon name="heart" size={18} /></span><span><strong>Mein Lesen</strong><small>Status, Stimmung, Zitate, Bewertung</small></span>
        </button>
      </div>

      {tab === "book" && (
        <section className="panel bd-sec tone-book">
          {b.blurb && <p className="prose bd-blurb">{b.blurb}</p>}
          <ul className="bd-facts">
            <Fact icon="book" label="Art" value={b.kind} />
            <Fact icon="layers" label="Kategorie" value={b.category} />
            <Fact icon="tag" label="Genre" value={b.genre} />
            <Fact icon="tag" label="Untergenre" value={b.subgenres} />
            <Fact icon="people" label="Zielgruppe" value={b.audience} />
            <Fact icon="globe" label="Sprache" value={b.language} />
            <Fact icon="building" label="Verlag" value={b.publisher} />
            <Fact icon="calendar" label="Erschienen" value={year ?? b.first_published} />
            <Fact icon="pages" label="Seiten" value={b.pages} />
            <Fact icon="list" label="Kapitel" value={b.chapters} />
            <Fact icon="barcode" label="ISBN" value={b.isbn13} />
            <Fact icon="clock" label="Zeit" value={b.period} />
            <Fact icon="pin" label="Schauplatz" value={b.setting} />
            <Fact icon="eye" label="Erzählperspektive" value={b.pov} />
            <Fact icon="users" label="Hauptfiguren" value={b.main_characters} />
            <Fact icon="film" label="Adaption" value={b.adaptations} />
          </ul>
          {b.tropes?.length ? <><Sub icon="sparkle">Tropes</Sub><Chips items={b.tropes} param="trope" /></> : null}
          {b.trigger_warnings?.length ? <><Sub icon="warning">Triggerwarnungen</Sub><Chips items={b.trigger_warnings} /></> : null}
        </section>
      )}

      {tab === "me" && (
        <section className="panel bd-sec tone-me">

          {m.status === "lese" && (
            <div className="bd-progress">
              <div className="section-head">
                <strong><Icon name="book" size={16} /> Wo bist du gerade?</strong>
                <span className="muted">{m.current_page ? `Seite ${m.current_page}${b.pages ? ` von ${b.pages}` : ""}` : "Noch keine Seite eingetragen"}</span>
              </div>
              {b.pages && m.current_page ? <div className="progress big"><div style={{ width: `${Math.min(100, (m.current_page / b.pages) * 100)}%` }} /></div> : null}
              <div className="actions" style={{ marginTop: 10 }}>
                <input className="input" style={{ width: 120 }} type="number" min={1} max={b.pages ?? undefined} placeholder="Seite" value={page} onChange={(ev) => setPage(ev.target.value)} />
                <button className="btn small" onClick={savePage}>Seite merken</button>
                <button className="btn small primary" onClick={finish}><Icon name="check" size={15} /> Fertig gelesen</button>
              </div>
            </div>
          )}

          <div className="bd-me-grid">
            <div className="section">
          <Sub icon="star" right={<Link className="btn small ghost" to={`/buch/${m.id}/bearbeiten`}>{hasRating ? "Ändern" : "Bewerten"}</Link>}>Bewertung</Sub>
          {hasRating ? (
            <div className="bd-verdict">
              {m.rating != null && <div className="bd-stars"><Stars value={m.rating} /><strong className="mono">{m.rating}</strong><span className="muted">von 5</span></div>}
              <ul className="bd-facts compact">
                <Fact icon="heart" label="Urteil" value={m.verdict ? VERDICT[m.verdict] : null} />
                <Fact icon="target" label="Erwartung" value={m.expectation ? EXPECTATION[m.expectation] : null} />
                <Fact icon="flame" label="Spice" value={spiceLabel(m.spice)} />
                <Fact icon="bolt" label="Burn" value={m.burn ? BURN[m.burn] : null} />
                <Fact icon="people" label="Gelesen mit" value={m.company ? COMPANY[m.company] : null} />
              </ul>
            </div>
          ) : <p className="meta" style={{ margin: 0 }}>Noch keine Bewertung. Sterne, Urteil und Spice trägst du unter „Bewerten“ ein.</p>}

          <Sub icon="smile">Stimmung</Sub>
          <div className="chips">
            {shownMoods.map((w) => {
              const on = (m.moods ?? []).includes(w);
              return <button key={w} type="button" className={"chip chip-toggle" + (on ? " on" : "")} onClick={() => toggleMood(w)}>{on && <Icon name="check" size={12} />}{w}</button>;
            })}
            {moodChoices.length > shownMoods.length && <button type="button" className="chip chip-toggle" onClick={() => setMoreMoods(true)}>mehr…</button>}
          </div>
          <form className="bd-inline" onSubmit={(ev) => { ev.preventDefault(); addMood(); }}>
            <input className="input" placeholder="Eigenes Wort, z. B. „regnerischer Sonntag“" value={moodText} onChange={(ev) => setMoodText(ev.target.value)} />
            <button className="btn small" type="submit" disabled={!moodText.trim()}>Hinzufügen</button>
          </form>

          <Sub icon="quote">Lieblingszitate{m.quotes?.length ? ` · ${m.quotes.length}` : ""}</Sub>
          {m.quotes?.length ? (
            <ul className="quotes">
              {m.quotes.map((q, i) => (
                <li key={i} className="quote">
                  <Icon name="quote" size={18} className="quote-mark" />
                  <p>{q}</p>
                  <button type="button" className="btn small ghost" aria-label="Zitat löschen" title="Zitat löschen" onClick={() => removeQuote(i)}>×</button>
                </li>
              ))}
            </ul>
          ) : <p className="meta" style={{ margin: 0 }}>Noch kein Zitat. Sätze, die du behalten willst, kommen hier hin.</p>}
          <form className="bd-inline" onSubmit={(ev) => { ev.preventDefault(); addQuote(); }}>
            <textarea className="input" rows={2} placeholder="Zitat eintippen…" value={quote} onChange={(ev) => setQuote(ev.target.value)} />
            <button className="btn small" type="submit" disabled={!quote.trim()}>Zitat speichern</button>
          </form>

            </div>
            <div className="section">
          <Readings e={e} />

          {hasEdition && (
            <>
              <Sub icon="bookmark">Meine Ausgabe</Sub>
              <ul className="bd-facts compact">
                <Fact icon="book" label="Medium" value={m.medium} />
                <Fact icon="layers" label="Format" value={m.format} />
                <Fact icon="sparkle" label="Edition" value={m.edition} />
                <Fact icon="gift" label="Extras" value={m.specials} />
                <Fact icon="coin" label="Preis" value={euro(m.price_cents)} />
                <Fact icon="check" label="Gekauft" value={m.bought == null ? null : m.bought ? "Ja" : "Nein"} />
                <Fact icon="headphones" label="Hörbuch" value={m.audio_platforms} />
                <Fact icon="speech" label="Sprecher:in" value={m.narrators} />
                <Fact icon="clock" label="Hördauer" value={m.duration_min ? `${Math.floor(m.duration_min / 60)} h ${m.duration_min % 60} min` : null} />
                <Fact icon="film" label="Adaption gesehen" value={m.adaptation_seen ? "Ja" : null} />
              </ul>
            </>
          )}

          {m.notes && <><Sub icon="note">Meine Notiz</Sub><p className="prose" style={{ margin: 0 }}>{m.notes}</p></>}
          {m.review && <><Sub icon="pencil">Rezension</Sub><p className="prose" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.review}</p></>}
            </div>
          </div>
        </section>
      )}

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
