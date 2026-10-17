import { useEffect, useMemo, useRef, useState } from "react";
import { useEntries, useSaveProfile, useUser } from "../data/hooks";
import type { Entry, Profile } from "../data/types";
import { data } from "../data";
import { Link } from "../components/Link";
import { Avatar } from "../components/Avatar";
import { AuthorPhoto, useOpenAuthor } from "../components/Authors";
import { Cover, Stars, authorNames } from "../components/ui";
import { Columns, Kpi } from "../components/Charts";
import { Icon } from "../components/Icon";
import { goalStats } from "../components/GoalCards";
import { parseKaufstopp } from "../components/Kaufstopp";
import { useOpenBook } from "../components/openBook";
import { readEvents } from "../lib/stats";
import { fmtDate, today } from "../lib/labels";
import { handleProblem, normalizeHandle, readerProfile, suggestHandle } from "../lib/profile";
import { shrinkPhotoFile } from "../lib/authorPhotos";
import { toast } from "../App";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const fmtN = (n: number) => n.toLocaleString("de-DE");

/** Eigenes Profil: wer du bist, was du liest, und was später Freund:innen sehen können. */
export default function Profil() {
  const { data: user } = useUser();
  const { entries, lib, isLoading } = useEntries();
  const [editing, setEditing] = useState(false);
  const openBook = useOpenBook();
  const openAuthor = useOpenAuthor();
  const year = new Date().getFullYear();

  const v = useMemo(() => {
    if (!lib) return null;
    const ev = readEvents(entries);
    const evYear = ev.filter((x) => x.year === year);
    const months = MONTHS.map((_, i) => evYear.filter((x) => Number((x.r.finished_on ?? "").slice(5, 7)) === i + 1).length);
    // Zuletzt gelesen: neueste beendete Durchgänge, jedes Buch nur einmal
    const seen = new Set<string>();
    const recent = [...ev]
      .sort((a, b) => (b.r.finished_on ?? b.r.finished_text ?? "").localeCompare(a.r.finished_on ?? a.r.finished_text ?? ""))
      .filter((x) => (seen.has(x.e.mine.id) ? false : (seen.add(x.e.mine.id), true)));
    const gs = goalStats(entries, year);
    const goal = lib.goals.find((g) => g.year === year)?.books_goal ?? null;
    const persona = readerProfile(entries);

    // Laufende Challenges
    const now = today();
    const challenges = lib.challenges
      .filter((c) => !c.ends_on || c.ends_on >= now)
      .map((c) => {
        const es = lib.challenge_entries.filter((e) => e.challenge_id === c.id);
        if (c.kind === "kaufstopp") {
          const k = parseKaufstopp(c, es, entries);
          return { id: c.id, name: c.name, icon: "coin" as const, value: `${k.current} ${k.current === 1 ? "Tag" : "Tage"}`, sub: "ohne Buchkauf", pct: k.best ? Math.min(100, (k.current / k.best) * 100) : 100 };
        }
        const done = es.filter((e) => e.done).length;
        const total = c.kind === "bingo" ? es.length || 25 : c.target ?? 0;
        return { id: c.id, name: c.name, icon: (c.kind === "bingo" ? "grid" : "list") as "grid" | "list", value: total ? `${done} von ${total}` : `${done}`, sub: c.kind === "bingo" ? "Bingo-Feldern" : "geschafft", pct: total ? Math.min(100, (done / total) * 100) : 0 };
      });

    // Tops: deine Favoriten in ihrer Reihenfolge
    const byBook = new Map(entries.map((e) => [e.book.id, e]));
    const favs = [...lib.favorites].sort((a, b) => a.rank - b.rank);
    const favBooks = favs.filter((f) => (f.kind === "book" || f.kind === "graphic") && f.book_id).map((f) => byBook.get(f.book_id!)).filter(Boolean) as Entry[];
    const topBooks = favBooks.length ? favBooks : entries.filter((e) => e.mine.rating != null).sort((a, b) => b.mine.rating! - a.mine.rating!).slice(0, 8);
    const authors = new Map(lib.authors.map((a) => [a.id, a]));
    const topAuthors = favs.filter((f) => f.kind === "author" && f.author_id).map((f) => authors.get(f.author_id!)).filter(Boolean).slice(0, 8) as NonNullable<ReturnType<typeof authors.get>>[];
    const seriesById = new Map(lib.series.map((s) => [s.id, s]));
    const topSeries = favs.filter((f) => f.series_id).map((f) => {
      const s = seriesById.get(f.series_id!);
      const first = entries.filter((e) => e.series?.id === f.series_id).sort((a, b) => (a.book.series_number ?? "").localeCompare(b.book.series_number ?? "", "de", { numeric: true }))[0];
      return s ? { s, first } : null;
    }).filter(Boolean).slice(0, 6) as { s: NonNullable<ReturnType<typeof seriesById.get>>; first?: Entry }[];

    // Wunschliste ohne Preise: zuerst hohe Priorität, dann was bald erscheint
    const prio = { hoch: 0, mittel: 1, niedrig: 2, gekauft: 3 } as const;
    const wishes = lib.wishlist_items
      .filter((w) => !w.owned && w.priority !== "gekauft")
      .sort((a, b) => prio[a.priority] - prio[b.priority] || (a.release_date ?? "9999").localeCompare(b.release_date ?? "9999"));

    return {
      reading: entries.filter((e) => e.mine.status === "lese"),
      recent, months, gs, goal, persona, challenges, topBooks, favBooksUsed: favBooks.length > 0, topAuthors, topSeries, wishes,
      readTotal: entries.filter((e) => e.mine.status === "gelesen").length,
      topGenreYear: [...evYear.reduce((m, x) => (x.e.book.genre ? m.set(x.e.book.genre, (m.get(x.e.book.genre) ?? 0) + 1) : m), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0]?.[0]
    };
  }, [entries, lib, year]);

  if (isLoading || !v || !user) return <p className="muted">Lade dein Profil…</p>;

  return (
    <div className="pf">
      {editing ? (
        <ProfileEditor user={user} onDone={() => setEditing(false)} />
      ) : (
        <section className="panel pf-hero">
          <Avatar p={user} size={112} />
          <div className="pf-id">
            <h1>{user.display_name || "Dein Name"}</h1>
            {user.handle ? <p className="pf-handle">@{user.handle}</p> : <button type="button" className="pf-handle pf-handle-missing" onClick={() => setEditing(true)}>Benutzernamen aussuchen</button>}
            {user.bio && <p className="pf-bio">{user.bio}</p>}
            {v.persona.sentence && <p className="pf-persona"><Icon name="sparkle" size={15} /> {v.persona.sentence}</p>}
            {(v.persona.topGenres.length > 0 || v.persona.topTropes.length > 0) && (
              <div className="pf-tags">
                {v.persona.topGenres.map((g) => <span key={g} className="pf-tag genre">{g}</span>)}
                {v.persona.topTropes.map((t) => <span key={t} className="pf-tag">{t}</span>)}
              </div>
            )}
          </div>
          <button type="button" className="btn small pf-edit" onClick={() => setEditing(true)}><Icon name="pencil" size={14} /> Profil bearbeiten</button>
        </section>
      )}

      {user.quote && !editing && (
        <figure className="panel pf-quote">
          <Icon name="quote" size={22} />
          <blockquote>{user.quote}</blockquote>
          {user.quote_source && <figcaption>{user.quote_source}</figcaption>}
        </figure>
      )}

      <div className="kpis">
        <Kpi icon="book" tone="blue" label={`Bücher ${year}`} value={<>{v.gs.read}{v.goal ? <small> / {v.goal}</small> : null}</>} sub={v.goal ? `${Math.round((v.gs.read / v.goal) * 100)} % vom Jahresziel` : "Noch kein Jahresziel"}>
          {v.goal ? <div className="goalbar"><div style={{ width: `${Math.min(100, (v.gs.read / v.goal) * 100)}%` }} /></div> : null}
        </Kpi>
        <Kpi icon="pages" tone="green" label={`Seiten ${year}`} value={fmtN(v.gs.pages)} sub={v.gs.read ? `etwa ${fmtN(Math.round(v.gs.pages / v.gs.read))} pro Buch` : undefined} />
        <Kpi icon="check" tone="lilac" label="Gelesen insgesamt" value={fmtN(v.readTotal)} sub={`${v.gs.completedSeries} Reihen beendet`} />
        <Kpi icon="heart" tone="pink" label={`Lieblingsgenre ${year}`} value={v.topGenreYear ?? v.persona.topGenres[0] ?? "Noch offen"} sub={v.topGenreYear ? undefined : "über alle Jahre"} />
      </div>

      <section className="panel pf-sec">
        <div className="section-head"><h2>Dein Lesejahr {year}</h2><span className="muted">{v.gs.read} Bücher</span></div>
        <Columns data={MONTHS.map((m, i) => ({ label: m, value: v.months[i] }))} unit=" Bücher" height={120} />
      </section>

      <div className="pf-two">
        <section className="panel pf-sec">
          <div className="section-head"><h2>Gerade am Lesen</h2></div>
          {v.reading.length ? v.reading.map((e) => (
            <button key={e.mine.id} type="button" className="pf-book" onClick={() => openBook(e.mine.id)}>
              <span className="pf-cover"><Cover title={e.book.title} url={e.book.cover_url} isbn={e.book.isbn13} bookId={e.book.id} genre={e.book.genre} /></span>
              <span className="pf-book-txt"><strong>{e.book.title}</strong><span>{authorNames(e)}</span></span>
            </button>
          )) : <p className="meta" style={{ margin: 0 }}>Gerade liest du kein Buch.</p>}
        </section>
        <section className="panel pf-sec">
          <div className="section-head"><h2>Zuletzt gelesen</h2></div>
          {v.recent.slice(0, 4).map(({ e, r }) => (
            <button key={e.mine.id} type="button" className="pf-book" onClick={() => openBook(e.mine.id)}>
              <span className="pf-cover"><Cover title={e.book.title} url={e.book.cover_url} isbn={e.book.isbn13} bookId={e.book.id} genre={e.book.genre} /></span>
              <span className="pf-book-txt"><strong>{e.book.title}</strong><span>{authorNames(e)}</span><span className="pf-book-meta"><Stars value={e.mine.rating} /> {fmtDate(r.finished_on, r.finished_text)}</span></span>
            </button>
          ))}
        </section>
      </div>

      {v.recent.length > 0 && (
        <section className="panel pf-sec">
          <div className="section-head"><h2>Shelfie</h2><span className="muted">Deine letzten {Math.min(30, v.recent.length)} Bücher</span></div>
          <div className="pf-shelfie">
            {v.recent.slice(0, 30).map(({ e }) => (
              <button key={e.mine.id} type="button" className="pf-shelfie-c" title={e.book.title} onClick={() => openBook(e.mine.id)}>
                <Cover title={e.book.title} url={e.book.cover_url} isbn={e.book.isbn13} bookId={e.book.id} genre={e.book.genre} />
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="pf-two">
        <section className="panel pf-sec">
          <div className="section-head"><h2>Reihen, an denen du dran bist</h2><Link to="/reihen" className="muted">Alle Reihen →</Link></div>
          {v.gs.almost.length ? v.gs.almost.slice(0, 5).map((s) => (
            <div key={s.id} className="pf-series">
              <div className="pf-series-top"><strong>{s.name}</strong><span className="muted">{s.read} von {s.total}</span></div>
              <div className="pf-dots" aria-label={`${s.read} von ${s.total} gelesen`}>
                {Array.from({ length: Math.min(s.total, 30) }, (_, i) => <span key={i} className={i < s.read ? "on" : ""} />)}
              </div>
            </div>
          )) : <p className="meta" style={{ margin: 0 }}>Gerade hast du keine angefangene Reihe.</p>}
        </section>
        <section className="panel pf-sec">
          <div className="section-head"><h2>Gerade dabei</h2><Link to="/ziele" className="muted">Ziele →</Link></div>
          {v.challenges.length ? v.challenges.map((c) => (
            <div key={c.id} className="pf-ch">
              <span className="pf-ch-ico"><Icon name={c.icon} size={17} /></span>
              <div className="pf-ch-txt"><strong>{c.name}</strong><span>{c.value} {c.sub}</span><div className="goalbar"><div style={{ width: `${c.pct}%` }} /></div></div>
            </div>
          )) : <p className="meta" style={{ margin: 0 }}>Keine laufende Challenge. <Link to="/ziele">Eine starten</Link></p>}
        </section>
      </div>

      <section className="panel pf-sec">
        <div className="section-head"><h2>Tops</h2><Link to="/tops" className="muted">Bearbeiten →</Link></div>
        <h3 className="pf-h3">{v.favBooksUsed ? "Lieblingsbücher" : "Am besten bewertet"}</h3>
        <div className="pf-row">
          {v.topBooks.slice(0, 8).map((e) => (
            <button key={e.mine.id} type="button" className="pf-tile" onClick={() => openBook(e.mine.id)}>
              <span className="pf-tile-c"><Cover title={e.book.title} url={e.book.cover_url} isbn={e.book.isbn13} bookId={e.book.id} genre={e.book.genre} /></span>
              <span className="pf-tile-t">{e.book.title}</span>
            </button>
          ))}
        </div>
        {v.topAuthors.length > 0 && <>
          <h3 className="pf-h3">Lieblingsautor:innen</h3>
          <div className="pf-row">
            {v.topAuthors.map((a) => (
              <button key={a.id} type="button" className="pf-person" onClick={() => openAuthor(a.slug)}><AuthorPhoto author={a} size={64} /><span>{a.name}</span></button>
            ))}
          </div>
        </>}
        {v.topSeries.length > 0 && <>
          <h3 className="pf-h3">Lieblingsreihen</h3>
          <div className="pf-row">
            {v.topSeries.map(({ s, first }) => (
              <div key={s.id} className="pf-tile">
                <span className="pf-tile-c">{first ? <Cover title={first.book.title} url={first.book.cover_url} isbn={first.book.isbn13} bookId={first.book.id} genre={first.book.genre} /> : null}</span>
                <span className="pf-tile-t">{s.name}</span>
              </div>
            ))}
          </div>
        </>}
      </section>

      <section className="panel pf-sec">
        <div className="section-head"><h2>Wunschliste</h2><Link to="/wunschliste" className="muted">{v.wishes.length} Wünsche →</Link></div>
        {v.wishes.length ? (
          <div className="pf-row">
            {v.wishes.slice(0, 10).map((w) => (
              <div key={w.id} className="pf-tile">
                <span className="pf-tile-c"><Cover title={w.title} author={w.author ?? undefined} isbn={w.isbn} genre={w.genre} /></span>
                <span className="pf-tile-t">{w.title}</span>
                {w.priority === "hoch" && <span className="pf-tile-s">Großer Wunsch</span>}
              </div>
            ))}
          </div>
        ) : <p className="meta" style={{ margin: 0 }}>Deine Wunschliste ist leer.</p>}
      </section>

      <section className="panel pf-sec pf-private">
        <div className="section-head"><h2><Icon name="eye" size={18} /> Wer was sieht</h2></div>
        <p style={{ margin: 0 }}>Im Moment siehst nur du dein Profil. Wenn Freund:innen dazukommen, sehen nur Personen, die du angenommen hast, diese Seite. Immer privat bleiben deine Kaufpreise und Ausgaben, Verkäufe, Notizen und deine Meinung zu einzelnen Büchern. Die Wunschliste erscheint ohne Preise.</p>
      </section>
    </div>
  );
}

/** Profil bearbeiten: Bild, Name, Benutzername (einmalig), kurzer Text, Lieblingszitat. */
function ProfileEditor({ user, onDone }: { user: Profile; onDone: () => void }) {
  const save = useSaveProfile();
  const [f, setF] = useState({
    display_name: user.display_name ?? "",
    handle: user.handle ?? suggestHandle(user.display_name ?? ""),
    bio: user.bio ?? "",
    quote: user.quote ?? "",
    quote_source: user.quote_source ?? "",
    avatar_url: user.avatar_url ?? null as string | null
  });
  const [free, setFree] = useState<null | "checking" | "free" | "taken">(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const problem = handleProblem(f.handle);
  const own = f.handle === (user.handle ?? "");

  // Benutzername prüfen, kurz nachdem man aufgehört hat zu tippen
  useEffect(() => {
    if (problem || own) { setFree(null); return; }
    setFree("checking");
    let alive = true;
    const t = setTimeout(() => {
      data.isHandleFree(f.handle).then((ok) => alive && setFree(ok ? "free" : "taken")).catch(() => alive && setFree(null));
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [f.handle, problem, own]);

  async function pickFile(file?: File | null) {
    if (!file) return;
    try { setF((x) => ({ ...x, avatar_url: null })); const url = await shrinkPhotoFile(file, 320); setF((x) => ({ ...x, avatar_url: url })); }
    catch { toast("Das Bild konnte nicht gelesen werden."); }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f.display_name.trim()) { toast("Bitte gib einen Namen ein."); return; }
    if (problem) { toast(problem); return; }
    if (!own && !(await data.isHandleFree(f.handle).catch(() => true))) { setFree("taken"); toast(`@${f.handle} ist schon vergeben.`); return; }
    const base = { display_name: f.display_name.trim(), handle: f.handle, bio: f.bio.trim() || null, avatar_url: f.avatar_url };
    const quote = { quote: f.quote.trim() || null, quote_source: f.quote_source.trim() || null };
    const quoteChanged = (quote.quote ?? null) !== (user.quote ?? null) || (quote.quote_source ?? null) !== (user.quote_source ?? null);
    try {
      await save.mutateAsync(quoteChanged ? { ...base, ...quote } : base);
      toast("Profil gespeichert.");
      onDone();
    } catch (x: any) {
      const msg = String(x?.message ?? x);
      if (msg === "HANDLE_TAKEN") { setFree("taken"); toast(`@${f.handle} ist schon vergeben.`); return; }
      if (/quote/.test(msg)) {
        // Datenbank kennt das Zitat noch nicht: den Rest trotzdem speichern
        try { await save.mutateAsync(base); onDone(); toast("Profil gespeichert. Für das Zitat fehlt noch eine kleine Ergänzung der Datenbank (0004_profil.sql)."); }
        catch { toast("Speichern hat nicht geklappt."); }
        return;
      }
      toast("Speichern hat nicht geklappt.");
    }
  }

  const preview: Profile = { ...user, display_name: f.display_name, avatar_url: f.avatar_url };
  return (
    <form className="panel pf-editor" onSubmit={submit}>
      <div className="pf-editor-photo">
        <Avatar p={preview} size={112} />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
        <button type="button" className="btn small" onClick={() => fileRef.current?.click()}><Icon name="camera" size={14} /> {f.avatar_url ? "Bild ändern" : "Bild hochladen"}</button>
        {f.avatar_url && <button type="button" className="btn small ghost" onClick={() => setF({ ...f, avatar_url: null })}>Bild entfernen</button>}
      </div>
      <div className="pf-editor-fields">
        <div className="field">
          <label htmlFor="pf-name">Name</label>
          <input id="pf-name" className="input" maxLength={40} value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="pf-handle">Benutzername</label>
          <div className="pf-handle-input">
            <span>@</span>
            <input id="pf-handle" className="input" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={20} value={f.handle} onChange={(e) => setF({ ...f, handle: normalizeHandle(e.target.value) })} aria-describedby="pf-handle-hint" />
          </div>
          <p id="pf-handle-hint" className={"pf-hint" + (problem || free === "taken" ? " bad" : free === "free" ? " good" : "")}>
            {problem ?? (own ? "Das ist dein aktueller Benutzername." : free === "checking" ? "Wird geprüft…" : free === "taken" ? `@${f.handle} ist leider schon vergeben.` : free === "free" ? `@${f.handle} ist frei.` : " ")}
          </p>
          <p className="meta" style={{ margin: 0 }}>Darüber finden dich Freund:innen später. Jeden Namen gibt es nur einmal. Erlaubt sind Buchstaben, Zahlen, Punkt und Unterstrich.</p>
        </div>
        <div className="field">
          <label htmlFor="pf-bio">Über dich <span className="pf-count">{f.bio.length}/160</span></label>
          <textarea id="pf-bio" className="input" rows={2} maxLength={160} placeholder="Ein Satz über dich und deine Bücher" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="pf-quote">Lieblingszitat <span className="pf-count">{f.quote.length}/300</span></label>
          <textarea id="pf-quote" className="input" rows={3} maxLength={300} value={f.quote} onChange={(e) => setF({ ...f, quote: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="pf-qs">Aus welchem Buch oder von wem?</label>
          <input id="pf-qs" className="input" maxLength={120} value={f.quote_source} onChange={(e) => setF({ ...f, quote_source: e.target.value })} />
        </div>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onDone}>Abbrechen</button>
          <button type="submit" className="btn primary" disabled={save.isPending || !!problem || free === "taken" || free === "checking"}>{save.isPending ? "Speichert…" : "Speichern"}</button>
        </div>
      </div>
    </form>
  );
}
