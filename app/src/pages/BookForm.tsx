import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEntries, useSaveBook } from "../data/hooks";
import type { Book, ReadingStatus, UserBook } from "../data/types";
import { AUDIENCE, BURN, COMPANY, EXPECTATION, FORMATS, KINDS, MEDIA, PERIODS, STATUS, STATUS_ORDER, VERDICT } from "../lib/labels";
import { lookupIsbn } from "../lib/isbn";
import { toast } from "../App";
import { findDuplicates, normIsbn } from "../lib/duplicates";
import { Cover, StatusPill, authorNames, StarPicker } from "../components/ui";
import { Link } from "../components/Link";
// Der Scanner wird erst geladen, wenn er gebraucht wird (spart Ladezeit)
const Scanner = lazy(() => import("../components/Scanner").then((m) => ({ default: m.Scanner })));

type Form = {
  title: string; subtitle: string; original_title: string; authors: string; isbn13: string; blurb: string;
  first_published: string; publisher: string; language: string; pages: string; chapters: string; kind: string;
  category: string; genre: string; subgenres: string; audience: string; period: string; setting: string; pov: string;
  main_characters: string; tropes: string; trigger_warnings: string; cover_url: string;
  series_name: string; series_number: string; series_roles: string;
  status: ReadingStatus; medium: string[]; format: string[]; edition: string; specials: string; price: string; bought: boolean;
  rating: string; verdict: string; expectation: string; spice: string; burn: string; company: string; notes: string; review: string;
};

const EMPTY: Form = {
  title: "", subtitle: "", original_title: "", authors: "", isbn13: "", blurb: "", first_published: "", publisher: "", language: "Deutsch",
  pages: "", chapters: "", kind: "Buch", category: "Fiction", genre: "", subgenres: "", audience: "", period: "", setting: "", pov: "",
  main_characters: "", tropes: "", trigger_warnings: "", cover_url: "", series_name: "", series_number: "", series_roles: "",
  status: "tbr", medium: ["Print"], format: [], edition: "", specials: "", price: "", bought: true,
  rating: "", verdict: "", expectation: "", spice: "", burn: "", company: "", notes: "", review: ""
};

// Eingabefelder stehen außerhalb der Seite, damit sie beim Tippen nicht neu aufgebaut werden (sonst springt der Cursor).
function TextField({ k, label, span, type = "text", ph, value, onChange }: {
  k: string; label: string; span?: boolean; type?: string; ph?: string; value: string;
  onChange: (ev: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className={"field" + (span ? " span2" : "")}>
      <label htmlFor={k}>{label}</label>
      <input id={k} className="input" type={type} value={value} onChange={onChange} placeholder={ph} step={type === "number" ? "any" : undefined} />
    </div>
  );
}
function SelectField({ k, label, opts, value, onChange }: {
  k: string; label: string; opts: [string, string][]; value: string;
  onChange: (ev: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={k}>{label}</label>
      <select id={k} className="input" value={value} onChange={onChange}>
        <option value="">(keine Angabe)</option>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

const list = (s: string) => s.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

/** Formular für neue Bücher und zum Bearbeiten. Mit `editId` und `onDone` läuft es eingebettet (z. B. im Buchfenster), ohne Seitenwechsel. */
export default function BookForm({ editId, onDone, startTab }: { editId?: string; onDone?: () => void; startTab?: "buch" | "ich" | "inhalt" } = {}) {
  const params = useParams();
  const id = editId ?? params.id;
  const nav = useNavigate();
  const { entries, isLoading } = useEntries();
  const save = useSaveBook();
  const [f, setF] = useState<Form>(EMPTY);
  const [tab, setTab] = useState<"buch" | "ich" | "inhalt">(startTab ?? "buch");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const existing = id ? entries.find((x) => x.mine.id === id) : undefined;

  // Gibt es das Buch schon in der eigenen Bibliothek? (gleiche ISBN oder gleicher Titel + Autor:in)
  const dupes = useMemo(
    () => findDuplicates(entries, { isbn: f.isbn13, title: f.title, authors: list(f.authors) }, existing?.mine.id),
    [entries, f.isbn13, f.title, f.authors, existing?.mine.id]
  );
  const sameIsbn = dupes.find((d) => d.kind === "isbn");

  useEffect(() => {
    if (!existing) return;
    const { book: b, mine: m } = existing;
    setF({
      title: b.title, subtitle: b.subtitle ?? "", original_title: b.original_title ?? "", authors: existing.authors.map((a) => a.name).join(", "),
      isbn13: b.isbn13 ?? "", blurb: b.blurb ?? "", first_published: b.first_published ?? "", publisher: b.publisher ?? "",
      language: (b.language ?? []).join(", "), pages: b.pages?.toString() ?? "", chapters: b.chapters?.toString() ?? "", kind: b.kind ?? "Buch",
      category: (b.category ?? ["Fiction"]).join(", "), genre: b.genre ?? "", subgenres: (b.subgenres ?? []).join(", "), audience: b.audience ?? "",
      period: b.period ?? "", setting: b.setting ?? "", pov: (b.pov ?? []).join(", "), main_characters: (b.main_characters ?? []).join(", "),
      tropes: (b.tropes ?? []).join(", "), trigger_warnings: (b.trigger_warnings ?? []).join(", "), cover_url: b.cover_url ?? "",
      series_name: existing.series?.name ?? "", series_number: b.series_number ?? "", series_roles: (b.series_roles ?? []).join(", "),
      status: m.status, medium: m.medium ?? [], format: m.format ?? [], edition: m.edition ?? "", specials: (m.specials ?? []).join(", "),
      price: m.price_cents != null ? (m.price_cents / 100).toFixed(2).replace(".", ",") : "", bought: m.bought ?? true,
      rating: m.rating?.toString() ?? "", verdict: m.verdict ?? "", expectation: m.expectation ?? "", spice: m.spice?.toString() ?? "",
      burn: m.burn ?? "", company: m.company ?? "", notes: m.notes ?? "", review: m.review ?? ""
    });
  }, [existing]);

  const up = (k: keyof Form) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: ev.target.type === "checkbox" ? (ev.target as HTMLInputElement).checked : ev.target.value });
  const toggle = (k: "medium" | "format", v: string) => () =>
    setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });

  async function fetchIsbn() {
    setBusy(true);
    try {
      const r = await lookupIsbn(f.isbn13);
      if (!r) { toast("Keine Daten zu dieser ISBN gefunden."); return; }
      setF({
        ...f,
        title: f.title || r.title || "", subtitle: f.subtitle || r.subtitle || "", authors: f.authors || (r.authors ?? []).join(", "),
        publisher: f.publisher || r.publisher || "", pages: f.pages || (r.pages?.toString() ?? ""), first_published: f.first_published || r.first_published || "",
        blurb: f.blurb || r.blurb || "", cover_url: f.cover_url || r.cover_url || "", language: f.language || (r.language ?? []).join(", ")
      });
      toast(`Daten von ${r.source === "openlibrary" ? "Open Library" : "Google Books"} übernommen.`);
    } catch (x: any) {
      toast(x.message ?? "Suche fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  // Nach dem Scannen: ISBN eintragen und sofort die Buchdaten holen
  const onScanned = useCallback((isbn: string) => {
    setScanning(false);
    setF((cur) => ({ ...cur, isbn13: isbn }));
    const owned = entries.find((x) => normIsbn(x.book.isbn13) === normIsbn(isbn) && x.mine.id !== existing?.mine.id);
    if (owned) { toast(`Du hast „${owned.book.title}“ schon.`); return; }
    toast(`ISBN ${isbn} erkannt, hole Daten…`);
    setTimeout(() => document.getElementById("btnIsbn")?.click(), 50);
  }, [entries, existing?.mine.id]);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f.title.trim()) { toast("Ein Titel fehlt noch."); return; }
    if (sameIsbn) { toast(`Diese ISBN hast du schon: „${sameIsbn.e.book.title}“.`); return; }
    if (!existing && dupes.length && !confirm(`Du hast „${dupes[0].e.book.title}“ schon in einer anderen Ausgabe. Trotzdem als eigene Ausgabe anlegen?`)) return;
    const book: Partial<Book> & { id?: string } = {
      id: existing?.book.id, title: f.title.trim(), subtitle: f.subtitle || null, original_title: f.original_title || null,
      isbn13: f.isbn13.replace(/[^0-9Xx]/g, "") || null, blurb: f.blurb || null, first_published: f.first_published || null,
      publisher: f.publisher || null, language: list(f.language), pages: num(f.pages), chapters: num(f.chapters), kind: f.kind,
      category: list(f.category), genre: f.genre || null, subgenres: list(f.subgenres), audience: f.audience || null, period: f.period || null,
      setting: f.setting || null, pov: list(f.pov), main_characters: list(f.main_characters), tropes: list(f.tropes),
      trigger_warnings: list(f.trigger_warnings), cover_url: f.cover_url || null, series_number: f.series_name ? f.series_number || null : null,
      series_roles: list(f.series_roles)
    };
    const mine: Partial<UserBook> = {
      id: existing?.mine.id, status: f.status, medium: f.medium, format: f.format, edition: f.edition || null, specials: list(f.specials),
      price_cents: f.price ? Math.round(Number(f.price.replace(",", ".")) * 100) : null, bought: f.bought,
      rating: num(f.rating), verdict: (f.verdict || null) as any, expectation: (f.expectation || null) as any, spice: num(f.spice),
      burn: (f.burn || null) as any, company: (f.company || null) as any, notes: f.notes || null, review: f.review || null
    };
    const saved = await save.mutateAsync({ book, authors: list(f.authors), series: f.series_name || null, mine });
    toast(existing ? "Gespeichert." : "Buch eingetragen.");
    if (onDone) { onDone(); return; }
    nav(existing ? `/buch/${existing.mine.id}` : `/bibliothek?q=${encodeURIComponent(saved.title)}`);
  }

  if (id && isLoading) return <p className="muted">Lade…</p>;

  return (
    <form onSubmit={submit} className={"section form-page" + (onDone ? " form-embedded" : "")}>
      {scanning && <Suspense fallback={<div className="scanner"><p className="scanner-status">Scanner wird geladen…</p></div>}><Scanner onResult={onScanned} onClose={() => setScanning(false)} /></Suspense>}
      <div className="mast">
        <h1>{existing ? "Buch bearbeiten" : "Neues Buch"}</h1>
        <div className="actions">
          <button type="button" className="btn" onClick={() => (onDone ? onDone() : nav(-1))}>Abbrechen</button>
          <button type="submit" className="btn primary" disabled={save.isPending}>Speichern</button>
        </div>
      </div>

      <div className="panel">
        <div className="form-grid">
          <div className="field span2">
            <label htmlFor="isbn13">ISBN (zum automatischen Ausfüllen)</label>
            <div className="actions" style={{ flexWrap: "nowrap" }}>
              <input id="isbn13" className="input" value={f.isbn13} onChange={up("isbn13")} placeholder="978-3-…" inputMode="numeric" />
              <button type="button" className="btn" onClick={() => setScanning(true)} title="Mit der Kamera scannen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M11 8v8M15 8v8M18 8v8" /></svg>
                Scannen
              </button>
              <button id="btnIsbn" type="button" className="btn" onClick={fetchIsbn} disabled={busy || !f.isbn13}>{busy ? "Suche…" : "Daten holen"}</button>
            </div>
          </div>
          <TextField k="title" label="Titel" span value={f.title} onChange={up("title")} />
          <TextField k="authors" label="Autor:in (mehrere mit Komma)" span value={f.authors} onChange={up("authors")} />
        </div>
        {dupes.length > 0 && (
          <div className={"dupe-box" + (sameIsbn ? " hard" : "")} role="status">
            <strong>{sameIsbn ? "Dieses Buch hast du schon." : dupes.length > 1 ? "Diese Bücher hast du vermutlich schon (andere Ausgabe):" : "Das hast du vermutlich schon in einer anderen Ausgabe:"}</strong>
            {dupes.slice(0, 3).map(({ e, kind }) => (
              <div key={e.mine.id} className="dupe-row">
                <Cover title={e.book.title} author={authorNames(e)} url={e.book.cover_url} isbn={e.book.isbn13} bookId={e.book.id} genre={e.book.genre} />
                <div className="card-body">
                  <div className="card-top"><StatusPill status={e.mine.status} />{kind === "isbn" ? <span className="tag">gleiche ISBN</span> : <span className="tag">gleicher Titel</span>}</div>
                  <div className="book-title">{e.book.title}</div>
                  <p className="book-author">{authorNames(e)}{(e.mine.format ?? []).length ? ` · ${e.mine.format!.join(", ")}` : ""}{e.book.isbn13 ? ` · ISBN ${e.book.isbn13}` : ""}</p>
                </div>
                <Link className="btn small" to={`/buch/${e.mine.id}`}>Zum Buch</Link>
              </div>
            ))}
            <p className="meta" style={{ margin: 0 }}>
              {sameIsbn
                ? "Ein zweites Mal kann diese Ausgabe nicht angelegt werden. Willst du den Status ändern oder einen Reread eintragen, öffne das Buch."
                : "Ist es wirklich eine weitere Ausgabe (zum Beispiel Hardcover und Taschenbuch), kannst du trotzdem speichern."}
            </p>
          </div>
        )}
      </div>

      <div className="tabs" role="tablist" style={{ alignSelf: "flex-start" }}>
        <button type="button" className="tab" role="tab" aria-selected={tab === "buch"} onClick={() => setTab("buch")}>Das Buch</button>
        <button type="button" className="tab" role="tab" aria-selected={tab === "ich"} onClick={() => setTab("ich")}>Meine Ausgabe und Bewertung</button>
        <button type="button" className="tab" role="tab" aria-selected={tab === "inhalt"} onClick={() => setTab("inhalt")}>Inhalt</button>
      </div>

      {tab === "buch" && (
        <div className="panel form-grid">
          <TextField k="subtitle" label="Untertitel" value={f.subtitle} onChange={up("subtitle")} />
          <TextField k="original_title" label="Originaltitel" value={f.original_title} onChange={up("original_title")} />
          <SelectField k="kind" label="Art" opts={KINDS.map((k) => [k, k])} value={f.kind} onChange={up("kind")} />
          <TextField k="category" label="Kategorie" ph="Fiction, Non-Fiction, Fanfiction" value={f.category} onChange={up("category")} />
          <TextField k="genre" label="Genre" ph="Fantasy" value={f.genre} onChange={up("genre")} />
          <TextField k="subgenres" label="Untergenre" ph="Romantasy, Dark Academia" value={f.subgenres} onChange={up("subgenres")} />
          <SelectField k="audience" label="Zielgruppe" opts={Object.entries(AUDIENCE)} value={f.audience} onChange={up("audience")} />
          <TextField k="language" label="Sprache" value={f.language} onChange={up("language")} />
          <TextField k="publisher" label="Verlag" value={f.publisher} onChange={up("publisher")} />
          <TextField k="first_published" label="Erschienen" ph="2024 oder 15.03.2024" value={f.first_published} onChange={up("first_published")} />
          <TextField k="pages" label="Seiten" type="number" value={f.pages} onChange={up("pages")} />
          <TextField k="chapters" label="Kapitel" type="number" value={f.chapters} onChange={up("chapters")} />
          <TextField k="series_name" label="Reihe (leer lassen bei Einzelband)" value={f.series_name} onChange={up("series_name")} />
          <TextField k="series_number" label="Band Nr." ph="1" value={f.series_number} onChange={up("series_number")} />
          <TextField k="series_roles" label="Besonderheit" ph="Spin Off, Prequel, Sequel" value={f.series_roles} onChange={up("series_roles")} />
          <TextField k="cover_url" label="Cover-Bild (Link)" span value={f.cover_url} onChange={up("cover_url")} />
        </div>
      )}

      {tab === "ich" && (
        <div className="panel form-grid">
          <SelectField k="status" label="Lesestatus" opts={STATUS_ORDER.map((s) => [s, STATUS[s]])} value={f.status} onChange={up("status")} />
          <div className="field"><label>Medium</label><div className="actions">{MEDIA.map((m) => <label key={m} className="check"><input type="checkbox" checked={f.medium.includes(m)} onChange={toggle("medium", m)} />{m}</label>)}</div></div>
          <div className="field"><label>Format</label><div className="actions">{FORMATS.map((m) => <label key={m} className="check"><input type="checkbox" checked={f.format.includes(m)} onChange={toggle("format", m)} />{m}</label>)}</div></div>
          <TextField k="edition" label="Edition" ph="Normal, Box, Limited" value={f.edition} onChange={up("edition")} />
          <TextField k="specials" label="Extras" ph="Map, Sprayed Edges, Playlist" value={f.specials} onChange={up("specials")} />
          <TextField k="price" label="Preis in €" ph="9,99" value={f.price} onChange={up("price")} />
          <div className="field"><label>Gekauft</label><label className="check"><input type="checkbox" checked={f.bought} onChange={up("bought")} />Ja, gekauft</label></div>
          <div className="field"><span className="label-like">Sterne</span><StarPicker value={f.rating === "" ? null : Number(f.rating.replace(",", "."))} onChange={(v) => setF({ ...f, rating: v == null ? "" : String(v) })} /></div>
          <SelectField k="verdict" label="Kurzbewertung" opts={Object.entries(VERDICT)} value={f.verdict} onChange={up("verdict")} />
          <SelectField k="expectation" label="Erwartung" opts={Object.entries(EXPECTATION)} value={f.expectation} onChange={up("expectation")} />
          <SelectField k="spice" label="Spice" opts={[["0", "🥛 Keine"], ["1", "🌶️"], ["2", "🌶️🌶️"], ["3", "🌶️🌶️🌶️"], ["4", "🌶️🌶️🌶️🌶️"], ["5", "🌶️🌶️🌶️🌶️🌶️"]]} value={f.spice} onChange={up("spice")} />
          <SelectField k="burn" label="Burn" opts={Object.entries(BURN)} value={f.burn} onChange={up("burn")} />
          <SelectField k="company" label="Gelesen mit" opts={Object.entries(COMPANY)} value={f.company} onChange={up("company")} />
          <div className="field span2"><label htmlFor="notes">Notiz</label><textarea id="notes" className="input" value={f.notes} onChange={up("notes")} /></div>
          <div className="field span2"><label htmlFor="review">Rezension</label><textarea id="review" className="input" value={f.review} onChange={up("review")} /></div>
        </div>
      )}

      {tab === "inhalt" && (
        <div className="panel form-grid">
          <div className="field span2"><label htmlFor="blurb">Klappentext</label><textarea id="blurb" className="input" value={f.blurb} onChange={up("blurb")} /></div>
          <SelectField k="period" label="Zeit" opts={PERIODS.map((p) => [p, p])} value={f.period} onChange={up("period")} />
          <TextField k="setting" label="Schauplatz" value={f.setting} onChange={up("setting")} />
          <TextField k="pov" label="Erzählperspektive" ph="Double POV, 1P" value={f.pov} onChange={up("pov")} />
          <TextField k="main_characters" label="Hauptfiguren" ph="Mit Komma trennen" value={f.main_characters} onChange={up("main_characters")} />
          <TextField k="tropes" label="Tropes" span ph="Enemies to Lovers, Found Family" value={f.tropes} onChange={up("tropes")} />
          <TextField k="trigger_warnings" label="Triggerwarnungen" span value={f.trigger_warnings} onChange={up("trigger_warnings")} />
        </div>
      )}

      <div className="actions" style={{ justifyContent: "flex-end" }}>
        <button type="submit" className="btn primary" disabled={save.isPending}>Speichern</button>
      </div>
    </form>
  );
}
