import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useEntries } from "../data/hooks";
import type { Entry, Reading } from "../data/types";
import { GENRE_FAMILY, VERDICT, euro } from "../lib/labels";
import { readEvents } from "../lib/stats";
import { Link } from "../components/Link";
import { Cover } from "../components/ui";
import { useOpenBook } from "../components/openBook";
import { AuthorPhoto, GENDER_COLOR, useOpenAuthor } from "../components/Authors";
import { BarList, Card, Columns, Donut, Fact, Heatmap, Kpi, Lines, StackBar, fmtN } from "../components/Charts";
import { Icon } from "../components/Icon";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const MONTHS_LONG = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const FAMILY_COLOR: Record<string, string> = { lila: "var(--c1)", rosa: "var(--c2)", blau: "var(--c3)", gruen: "var(--c4)", gelb: "var(--c5)", petrol: "var(--c6)", rot: "var(--c7)", sand: "var(--c8)" };
const genreColor = (g: string) => FAMILY_COLOR[GENRE_FAMILY[g] ?? "sand"];

// Annahmen für die Bild-Vergleiche (bewusst einfach gehalten)
const MIN_PER_PAGE = 1.5;          // Lesezeit pro Seite
const MM_PER_PAGE = 0.075;         // Buchdicke pro Seite, dazu 4 mm Einband
const G_PER_PAGE = 0.85;           // Gewicht pro Seite, dazu 30 g Einband
const M_PER_PAGE = 0.19;           // Seitenhöhe, wenn man alle Seiten aneinanderlegt
const CAPPUCCINO = 360;            // Cent
const LANDMARKS: [string, number][] = [["ein Gartenzwerg", 0.4], ["ein Kühlschrank", 1.8], ["eine Giraffe", 5.5], ["ein Einfamilienhaus", 10], ["das Brandenburger Tor", 26], ["der Schiefe Turm von Pisa", 56], ["die Freiheitsstatue", 93], ["der Kölner Dom", 157], ["der Eiffelturm", 330]];
const WEIGHTS: [string, number][] = [["eine Katze", 4.5], ["ein Mops", 8], ["ein Beagle", 12], ["ein Labrador", 30], ["ein Bernhardiner", 70], ["ein Pandabär", 100], ["ein Klavier", 250], ["ein Pferd", 500], ["ein Kleinwagen", 900]];

type Tab = "ueberblick" | "lesen" | "inhalte" | "autoren" | "geld";
const TABS: [Tab, string, Parameters<typeof Icon>[0]["name"]][] = [
  ["ueberblick", "Überblick", "sparkle"], ["lesen", "Lesen", "clock"], ["inhalte", "Inhalte", "layers"], ["autoren", "Autor:innen", "user"], ["geld", "Geld", "coffee"]
];

type Ev = { e: Entry; r: Reading; year: number; date: string | null };

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const countMap = <T,>(items: T[], key: (x: T) => (string | null | undefined)[] | string | null | undefined) => {
  const m = new Map<string, number>();
  for (const it of items) { const v = key(it); for (const k of Array.isArray(v) ? v : [v]) if (k) m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const uniqueEntries = (ev: Ev[]) => { const seen = new Map<string, Entry>(); for (const x of ev) seen.set(x.e.mine.id, x.e); return [...seen.values()]; };
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const fmtD = (iso: string) => iso.split("-").reverse().join(".");

export default function Statistik() {
  const { entries, lib, isLoading } = useEntries();
  const [params, setParams] = useSearchParams();
  const openBook = useOpenBook();
  const openAuthor = useOpenAuthor();
  const thisYear = new Date().getFullYear();
  const year = params.get("jahr") ?? String(thisYear);
  const tab = (params.get("t") ?? "ueberblick") as Tab;
  const set = (k: string, v: string, def: string) => { const p = new URLSearchParams(params); if (v === def) p.delete(k); else p.set(k, v); setParams(p, { replace: true }); };
  const all = year === "alle";

  const allEv: Ev[] = useMemo(() => readEvents(entries).map((x) => ({ ...x, date: x.r.finished_on ?? null })), [entries]);
  const years = useMemo(() => [...new Set(allEv.map((x) => x.year))].sort((a, b) => b - a), [allEv]);

  const s = useMemo(() => {
    const ev = all ? allEv : allEv.filter((x) => String(x.year) === year);
    const prev = all ? [] : allEv.filter((x) => x.year === Number(year) - 1);
    const books = uniqueEntries(ev);
    const pages = ev.reduce((n, x) => n + (x.e.book.pages ?? 0), 0);
    const hours = ev.reduce((n, x) => n + (x.r.mode === "audio" && x.e.mine.duration_min ? x.e.mine.duration_min / 60 : ((x.e.book.pages ?? 0) * MIN_PER_PAGE) / 60), 0);
    const rated = books.filter((e) => e.mine.rating != null);
    const dnf = entries.filter((e) => e.readings.some((r) => r.abandoned && (all || (r.finished_on ?? r.started_on ?? "").startsWith(year))));
    const value = books.reduce((n, e) => n + (e.mine.price_cents ?? 0), 0);
    const stackM = ev.reduce((n, x) => n + (x.e.book.pages ?? 300) * MM_PER_PAGE + 4, 0) / 1000;
    const weightKg = ev.reduce((n, x) => n + (x.e.book.pages ?? 300) * G_PER_PAGE + 30, 0) / 1000;
    const lengthKm = (pages * M_PER_PAGE) / 1000;
    const dated = ev.filter((x) => x.date && x.date.length >= 10);

    // Monate (mit Vorjahr) bzw. Jahre
    const monthOf = (list: Ev[], f: (x: Ev) => number) => { const m = Array(12).fill(0); for (const x of list) if (x.date && x.date.length >= 7) m[Number(x.date.slice(5, 7)) - 1] += f(x); return m; };
    const mBooks = monthOf(ev, () => 1), mPages = monthOf(ev, (x) => x.e.book.pages ?? 0);
    const pBooks = monthOf(prev, () => 1), pPages = monthOf(prev, (x) => x.e.book.pages ?? 0);
    const yearRows = (() => {
      const ys = [...new Set(allEv.map((x) => x.year))].sort();
      const early = ys.filter((y) => y < 2019);
      const rows: { label: string; books: number; pages: number }[] = [];
      if (early.length) { const l = allEv.filter((x) => x.year < 2019); rows.push({ label: "früher", books: l.length, pages: l.reduce((n, x) => n + (x.e.book.pages ?? 0), 0) }); }
      for (const y of ys.filter((y) => y >= 2019)) { const l = allEv.filter((x) => x.year === y); rows.push({ label: String(y), books: l.length, pages: l.reduce((n, x) => n + (x.e.book.pages ?? 0), 0) }); }
      return rows;
    })();

    // Wochentage, Tempo, Pausen
    const wd = Array(7).fill(0);
    for (const x of dated) wd[(new Date(x.date!).getDay() + 6) % 7]++;
    const daysList = ev.map((x) => x.r.days).filter((d): d is number => !!d && d > 0);
    const datesSorted = dated.map((x) => x.date!).sort();
    let pause: { days: number; from: string; to: string } | null = null;
    for (let i = 1; i < datesSorted.length; i++) { const d = dayDiff(datesSorted[i - 1], datesSorted[i]); if (!pause || d > pause.days) pause = { days: d, from: datesSorted[i - 1], to: datesSorted[i] }; }
    const tempo = [...new Set(allEv.map((x) => x.year))].sort().filter((y) => y >= 2019).map((y) => {
      const l = allEv.filter((x) => x.year === y && x.r.days && x.r.days > 0 && x.e.book.pages);
      return { label: String(y), ppd: l.length >= 3 ? avg(l.map((x) => x.e.book.pages! / x.r.days!))! : null, n: l.length };
    }).filter((t) => t.ppd != null) as { label: string; ppd: number; n: number }[];

    // Highlights
    const withPages = books.filter((e) => (e.book.pages ?? 0) >= 40); // sehr kleine Seitenzahlen sind meist Tippfehler
    const byDays = ev.filter((x) => x.r.days && x.r.days > 0 && (x.e.book.pages ?? 0) >= 150);
    const hl = {
      best: [...rated].sort((a, b) => (b.mine.rating ?? 0) - (a.mine.rating ?? 0) || (b.book.pages ?? 0) - (a.book.pages ?? 0))[0],
      thick: [...withPages].sort((a, b) => (b.book.pages ?? 0) - (a.book.pages ?? 0))[0],
      thin: [...withPages].sort((a, b) => (a.book.pages ?? 0) - (b.book.pages ?? 0))[0],
      fast: [...byDays].sort((a, b) => a.r.days! - b.r.days!)[0],
      slow: [...byDays].sort((a, b) => b.r.days! - a.r.days!)[0]
    };

    // Inhalte
    const genres = countMap(books, (e) => e.book.genre);
    const subgenres = countMap(books, (e) => e.book.subgenres ?? []).slice(0, 8);
    const tropes = countMap(books, (e) => e.book.tropes ?? []).slice(0, 16);
    const audience = countMap(books, (e) => e.book.audience).slice(0, 6);
    const languages = countMap(books, (e) => e.book.language ?? []).slice(0, 5);
    const buckets: [string, number, number][] = [["< 200", 0, 199], ["200", 200, 299], ["300", 300, 399], ["400", 400, 499], ["500", 500, 699], ["700+", 700, 99999]];
    const pageHist = buckets.map(([label, a, b]) => ({ label, value: withPages.filter((e) => e.book.pages! >= a && e.book.pages! <= b).length, title: `${label === "< 200" ? "unter 200" : label === "700+" ? "ab 700" : `${a} bis ${b}`} Seiten` }));
    const decadeMap = new Map<number, number>();
    for (const e of books) { const m = /(\d{4})/.exec(e.book.first_published ?? ""); if (m) { const d = Math.floor(Number(m[1]) / 10) * 10; decadeMap.set(d, (decadeMap.get(d) ?? 0) + 1); } }
    const decades = [...decadeMap.entries()].sort((a, b) => a[0] - b[0]);
    const stars = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((v) => ({ label: String(v).replace(".", ","), value: rated.filter((e) => e.mine.rating === v).length }));
    const expect = countMap(books, (e) => e.mine.expectation);
    const verdicts = countMap(books, (e) => (e.mine.verdict ? VERDICT[e.mine.verdict] : null)).slice(0, 6);
    const genreStars = genres.map(([g]) => { const l = rated.filter((e) => e.book.genre === g); return { g, n: l.length, a: avg(l.map((e) => e.mine.rating!)) }; }).filter((x) => x.n >= 3 && x.a != null).sort((a, b) => b.a! - a.a!).slice(0, 6);
    const spice = [0, 1, 2, 3, 4, 5].map((v) => ({ label: String(v), value: books.filter((e) => e.mine.spice === v).length }));

    // Medium und Gesellschaft
    const media = countMap(books, (e) => e.mine.medium ?? []);
    const company = countMap(books, (e) => e.mine.company);

    // Autor:innen
    const authorCount = new Map<string, { a: Entry["authors"][number]; n: number }>();
    for (const x of ev) for (const a of x.e.authors) { const c = authorCount.get(a.id) ?? { a, n: 0 }; c.n++; authorCount.set(a.id, c); }
    const topAuthors = [...authorCount.values()].sort((a, b) => b.n - a.n).slice(0, 8);
    const authorsRead = [...authorCount.values()].map((x) => x.a);
    const genderCounts = countMap(authorsRead, (a) => a.gender ?? "unbekannt");
    const countries = countMap(authorsRead, (a) => a.country).slice(0, 10);
    const nCountries = new Set(authorsRead.map((a) => a.country).filter(Boolean)).size;
    const firstYear = new Map<string, number>();
    for (const x of allEv) for (const a of x.e.authors) firstYear.set(a.id, Math.min(firstYear.get(a.id) ?? 9999, x.year));
    const newAuthors = all ? null : authorsRead.filter((a) => firstYear.get(a.id) === Number(year)).length;

    return { ev, prev, books, pages, hours, rated, dnf, value, stackM, weightKg, lengthKm, dated, mBooks, mPages, pBooks, pPages, yearRows, wd, daysList, pause, tempo, hl, genres, subgenres, tropes, audience, languages, pageHist, decades, stars, expect, verdicts, genreStars, spice, media, company, topAuthors, authorsRead, genderCounts, countries, nCountries, newAuthors, rereads: ev.filter((x) => x.r.read_number > 1).length };
  }, [allEv, entries, year, all]);

  // Unabhängig vom Jahr: Geld, SuB, Tendenzen
  const g = useMemo(() => {
    const bought = entries.filter((e) => e.mine.bought && e.mine.price_cents);
    const spent = bought.reduce((n, e) => n + (e.mine.price_cents ?? 0), 0);
    const unreadBought = bought.filter((e) => e.mine.status === "tbr" || e.mine.status === "ungelesen");
    const readBought = entries.filter((e) => e.mine.bought).filter((e) => e.mine.status === "gelesen").length;
    const nBought = entries.filter((e) => e.mine.bought).length;
    const formats = new Map<string, number[]>();
    for (const e of bought) for (const f of e.mine.format ?? []) formats.set(f, [...(formats.get(f) ?? []), e.mine.price_cents! / 100]);
    const perFormat = [...formats.entries()].filter(([, l]) => l.length >= 3).map(([f, l]) => ({ f, a: avg(l)!, n: l.length })).sort((a, b) => b.a - a.a);
    const priciest = [...bought].sort((a, b) => (b.mine.price_cents ?? 0) - (a.mine.price_cents ?? 0)).slice(0, 3);
    const wishOpen = (lib?.wishlist_items ?? []).filter((w) => !w.owned && w.priority !== "gekauft").reduce((n, w) => n + (w.price_cents ?? 0), 0);
    const tbr = entries.filter((e) => e.mine.status === "tbr").length;
    return { bought, spent, unreadBought, readBought, nBought, perFormat, priciest, wishOpen, tbr, notBought: entries.length - nBought };
  }, [entries, lib]);

  const tendencies = useMemo(() => {
    const out: { icon: Parameters<typeof Icon>[0]["name"]; text: string }[] = [];
    const months = Array(12).fill(0);
    for (const x of allEv) if (x.date && x.date.length >= 7) months[Number(x.date.slice(5, 7)) - 1]++;
    const bestM = months.indexOf(Math.max(...months));
    if (months[bestM] > 0) out.push({ icon: "calendar", text: `Dein Lesemonat ist der ${MONTHS_LONG[bestM]}: Da hast du bisher die meisten Bücher beendet (${months[bestM]}).` });
    const rated = uniqueEntries(allEv).filter((e) => e.mine.rating != null);
    const ser = avg(rated.filter((e) => e.series).map((e) => e.mine.rating!)), single = avg(rated.filter((e) => !e.series).map((e) => e.mine.rating!));
    if (ser != null && single != null && rated.filter((e) => !e.series).length >= 5 && Math.abs(ser - single) >= 0.15)
      out.push({ icon: "layers", text: ser > single ? `Reihen liegen dir: Du bewertest sie im Schnitt mit ${fmtN(ser, 1)} Sternen, Einzelbände mit ${fmtN(single, 1)}.` : `Einzelbände überzeugen dich mehr: im Schnitt ${fmtN(single, 1)} Sterne, Reihenbände ${fmtN(ser, 1)}.` });
    const thick = avg(rated.filter((e) => (e.book.pages ?? 0) >= 500).map((e) => e.mine.rating!)), thin = avg(rated.filter((e) => (e.book.pages ?? 999) < 300).map((e) => e.mine.rating!));
    if (thick != null && thin != null && Math.abs(thick - thin) >= 0.15)
      out.push({ icon: "book", text: thick > thin ? `Dicke Bücher ab 500 Seiten gefallen dir besser (${fmtN(thick, 1)} Sterne) als dünne unter 300 Seiten (${fmtN(thin, 1)}).` : `Kürzere Bücher unter 300 Seiten bewertest du besser (${fmtN(thin, 1)} Sterne) als dicke ab 500 Seiten (${fmtN(thick, 1)}).` });
    const now = new Date(); const doy = Math.max(1, Math.floor((now.getTime() - new Date(thisYear, 0, 1).getTime()) / 86400000));
    const perMonth = (allEv.filter((x) => x.year === thisYear).length / doy) * 30.44;
    if (perMonth > 0 && g.tbr > 0) {
      const months2 = g.tbr / perMonth;
      out.push({ icon: "hourglass", text: `Bei deinem Tempo von ${fmtN(perMonth, 1)} Büchern im Monat reicht dein SuB von ${g.tbr} Büchern noch ${months2 >= 24 ? `etwa ${fmtN(months2 / 12, 1)} Jahre` : `etwa ${Math.round(months2)} Monate`}, ohne dass ein neues Buch dazukommt.` });
    }
    return out;
  }, [allEv, g.tbr, thisYear]);

  if (isLoading || !lib) return <p className="muted">Lade…</p>;
  const goal = all ? null : lib.goals.find((x) => x.year === Number(year))?.books_goal ?? null;
  const label = all ? "insgesamt" : year;
  const isCurrent = year === String(thisYear);

  // Bild-Vergleiche
  const lm = [...LANDMARKS].reverse().find(([, h]) => h <= s.stackM);
  const next = LANDMARKS.find(([, h]) => h > s.stackM);
  const wt = [...WEIGHTS].reverse().find(([, w]) => w <= s.weightKg);
  const fields = s.lengthKm * 1000 / 105;

  const bookTile = (e: Entry | undefined, title: string, line: string) => e && (
    <button type="button" className="hl" onClick={() => openBook(e.mine.id)}>
      <Cover title={e.book.title} url={e.book.cover_url} isbn={e.book.isbn13} bookId={e.book.id} genre={e.book.genre} />
      <span className="hl-kicker">{title}</span>
      <span className="hl-title">{e.book.title}</span>
      <span className="hl-line">{line}</span>
    </button>
  );

  return (
    <>
      <div className="mast">
        <div>
          <h1>Statis<em>tik</em></h1>
          <p className="lede">{entries.length.toLocaleString("de-DE")} Bücher im Regal, {s.ev.length} {all ? "Lesevorgänge insgesamt" : `davon ${year} gelesen`}.</p>
        </div>
        <select className="input year-select" value={year} onChange={(e) => set("jahr", e.target.value, String(thisYear))} aria-label="Zeitraum">
          {!years.includes(thisYear) && <option value={String(thisYear)}>{thisYear}</option>}
          {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
          <option value="alle">Alle Jahre</option>
        </select>
      </div>

      <nav className="stat-tabs" role="tablist" aria-label="Bereiche der Statistik">
        {TABS.map(([k, l, ic]) => (
          <button key={k} role="tab" aria-selected={tab === k} className="stat-tab" onClick={() => set("t", k, "ueberblick")}><Icon name={ic} size={17} />{l}</button>
        ))}
      </nav>

      {tab === "ueberblick" && (
        <>
          <div className="kpis">
            <Kpi icon="book" tone="blue" label={`Gelesen ${label}`} value={<>{s.ev.length}{goal ? <small> / {goal}</small> : null}</>} sub={s.rereads ? `davon ${s.rereads} Rereads` : undefined}>
              {goal ? <div className="kpi-bar"><div style={{ width: `${Math.min(100, (s.ev.length / goal) * 100)}%` }} /></div> : null}
            </Kpi>
            <Kpi icon="stack" tone="yellow" label="Seiten" value={fmtN(s.pages)} sub={s.ev.length ? `Ø ${fmtN(s.pages / s.ev.length)} pro Buch` : undefined} />
            <Kpi icon="clock" tone="green" label="Lesezeit, geschätzt" value={<>{fmtN(s.hours)}<small> Std.</small></>} sub={`etwa ${fmtN(s.hours / 24, 1)} Tage am Stück`} />
            <Kpi icon="star" tone="pink" label="Ø Bewertung" value={s.rated.length ? fmtN(avg(s.rated.map((e) => e.mine.rating!))!, 2) : "–"} sub={`${s.rated.length} bewertet`} />
            <Kpi icon="pause" tone="lilac" label="Abgebrochen" value={s.dnf.length} />
          </div>

          {s.ev.length > 0 && (
            <div className="facts">
              <Fact icon="tower" tone="blue" big={`${fmtN(s.stackM, s.stackM < 10 ? 1 : 0)} m`}>
                Übereinander gestapelt wären deine {all ? "" : `${year} `}gelesenen Bücher{lm ? <> höher als <b>{lm[0]}</b></> : " fast so hoch wie ein Gartenzwerg"}.{next ? <> Bis {next[0]} fehlen noch {fmtN(next[1] - s.stackM, 0)} m.</> : null}
              </Fact>
              <Fact icon="weight" tone="lilac" big={`${fmtN(s.weightKg, s.weightKg < 10 ? 1 : 0)} kg`}>
                So viel wiegen sie zusammen, {wt ? <>mehr als <b>{wt[0]}</b></> : "fast so viel wie eine Katze"}.
              </Fact>
              <Fact icon="road" tone="green" big={`${fmtN(s.lengthKm, 1)} km`}>
                Alle Seiten aneinandergelegt ergeben eine Strecke über {s.lengthKm >= 42.195 ? <><b>{fmtN(s.lengthKm / 42.195, 1)} Marathons</b></> : <><b>{fmtN(fields)} Fußballfelder</b></>}.
              </Fact>
              {s.value > 0 && (
                <Fact icon="coffee" tone="yellow" big={`${fmtN(s.value / CAPPUCCINO)} Cappuccino`}>
                  So viele hättest du für die {fmtN(s.value / 100)} € bekommen, die diese Bücher gekostet haben.
                </Fact>
              )}
            </div>
          )}

          <div className="scards">
            {!all ? (
              <Card title={`Bücher pro Monat ${year}`} icon="calendar" wide hint={s.ev.length > s.dated.length ? `${s.ev.length - s.dated.length} Bücher ohne genaues Datum fehlen hier.` : undefined}>
                <Columns data={MONTHS.map((m, i) => ({ label: m, value: s.mBooks[i], ghost: s.prev.length ? s.pBooks[i] : undefined }))} ghostLabel={String(Number(year) - 1)} unit=" Bücher" />
                {s.prev.length > 0 && <ul className="ch-legend row"><li><i style={{ background: "var(--c3)" }} /><span>{year}</span></li><li><i className="ghost" /><span>{Number(year) - 1} zum Vergleich</span></li></ul>}
              </Card>
            ) : (
              <Card title="Bücher pro Jahr" icon="calendar" wide>
                <Columns data={s.yearRows.map((r) => ({ label: r.label, value: r.books }))} unit=" Bücher" />
              </Card>
            )}

            {goal && isCurrent && (() => {
              const m = new Date().getMonth();
              const cum: (number | null)[] = []; let acc = 0;
              for (let i = 0; i < 12; i++) { acc += s.mBooks[i]; cum.push(i <= m ? acc : null); }
              const forecast = Math.round((s.ev.length / Math.max(1, Math.floor((Date.now() - new Date(thisYear, 0, 1).getTime()) / 86400000))) * 365);
              return (
                <Card title="Auf Kurs zum Jahresziel?" icon="target" wide hint={<>Bei deinem Tempo schaffst du etwa <b>{forecast} Bücher</b> bis Silvester{forecast >= goal ? <>, also dein Ziel von {goal}.</> : <>, dein Ziel liegt bei {goal}.</>}</>}>
                  <Lines labels={MONTHS} unit=" Bücher" series={[
                    { name: "Gelesen", values: cum, color: "var(--c3)" },
                    { name: "Plan fürs Ziel", values: MONTHS.map((_, i) => Math.round((goal * (i + 1)) / 12)), color: "var(--c0)", dashed: true }
                  ]} />
                </Card>
              );
            })()}

            {(s.hl.best || s.hl.thick) && (
              <Card title="Highlights" icon="sparkle" wide>
                <div className="hls">
                  {bookTile(s.hl.best, "Bestbewertet", `${fmtN(s.hl.best?.mine.rating ?? 0, 1)} Sterne`)}
                  {bookTile(s.hl.thick, "Dickstes Buch", `${fmtN(s.hl.thick?.book.pages ?? 0)} Seiten`)}
                  {bookTile(s.hl.thin, "Dünnstes Buch", `${fmtN(s.hl.thin?.book.pages ?? 0)} Seiten`)}
                  {s.hl.fast && bookTile(s.hl.fast.e, "Am schnellsten", `in ${s.hl.fast.r.days} ${s.hl.fast.r.days === 1 ? "Tag" : "Tagen"}`)}
                  {s.hl.slow && s.hl.slow !== s.hl.fast && bookTile(s.hl.slow.e, "Am längsten", `${s.hl.slow.r.days} Tage`)}
                </div>
              </Card>
            )}

            {tendencies.length > 0 && (
              <Card title="Deine Tendenzen" icon="trend" wide>
                <ul className="tends">{tendencies.map((t) => <li key={t.text}><span className="tend-icon"><Icon name={t.icon} size={18} /></span>{t.text}</li>)}</ul>
              </Card>
            )}
          </div>
        </>
      )}

      {tab === "lesen" && (
        <div className="scards">
          <div className="kpis wide">
            <Kpi icon="clock" tone="blue" label="Ø Tage pro Buch" value={s.daysList.length ? fmtN(avg(s.daysList)!, 1) : "–"} sub={s.daysList.length ? `aus ${s.daysList.length} Büchern mit Datum` : "Start- und Enddatum fehlen"} />
            <Kpi icon="repeat" tone="lilac" label="Rereads" value={s.rereads} />
            <Kpi icon="pause" tone="pink" label="Längste Lesepause" value={s.pause ? <>{s.pause.days}<small> Tage</small></> : "–"} sub={s.pause ? `${fmtD(s.pause.from)} bis ${fmtD(s.pause.to)}` : undefined} />
            <Kpi icon="bolt" tone="green" label="Seiten pro Lesetag" value={(() => { const l = s.ev.filter((x) => x.r.days && x.e.book.pages); return l.length ? fmtN(avg(l.map((x) => x.e.book.pages! / x.r.days!))!) : "–"; })()} />
          </div>
          <Card title="Bücher pro Jahr" icon="book"><Columns data={s.yearRows.map((r) => ({ label: r.label, value: r.books }))} unit=" Bücher" /></Card>
          <Card title="Seiten pro Jahr" icon="stack"><Columns data={s.yearRows.map((r) => ({ label: r.label, value: r.pages }))} color="var(--c5)" unit=" Seiten" /></Card>
          {(() => {
            const ys = [...new Set(allEv.filter((x) => x.date && x.date.length >= 7).map((x) => x.year))].sort((a, b) => b - a);
            if (!ys.length) return null;
            const vals = ys.map((y) => { const m = Array(12).fill(0); for (const x of allEv) if (x.year === y && x.date && x.date.length >= 7) m[Number(x.date.slice(5, 7)) - 1]++; return m; });
            return <Card title="Lese-Kalender" icon="calendar" wide hint="Jedes Feld zeigt, wie viele Bücher du in diesem Monat beendet hast."><Heatmap rows={ys.map(String)} cols={MONTHS} values={vals} /></Card>;
          })()}
          <Card title="An welchem Tag du Bücher beendest" icon="calendar" hint={s.dated.length ? undefined : "Dafür braucht es Bücher mit genauem Beendet-Datum."}>
            <BarList items={WEEKDAYS.map((d, i) => ({ label: d, value: s.wd[i] }))} color="var(--c4)" />
          </Card>
          {s.tempo.length > 1 && (
            <Card title="Wirst du schneller?" icon="bolt" hint="Seiten pro Lesetag, im Schnitt je Jahr.">
              <Columns data={s.tempo.map((t) => ({ label: t.label, value: Math.round(t.ppd) }))} color="var(--c4)" unit=" Seiten pro Tag" />
            </Card>
          )}
          {s.media.length > 0 && (
            <Card title="Wie du liest" icon="book">
              <StackBar items={s.media.map(([k, n], i) => ({ label: k === "Audiobook" ? "Hörbuch" : k, value: n, color: ["var(--c3)", "var(--c1)", "var(--c5)", "var(--c4)"][i] ?? "var(--c0)" }))} />
              {s.company.length > 0 && <>
                <p className="scard-sub">Mit wem</p>
                <StackBar items={s.company.map(([k, n], i) => ({ label: k === "solo" ? "Allein" : k === "buddy" ? "Buddy Read" : k === "group" ? "Leserunde" : k, value: n, color: ["var(--c4)", "var(--c2)", "var(--c6)"][i] ?? "var(--c0)" }))} />
              </>}
            </Card>
          )}
        </div>
      )}

      {tab === "inhalte" && (
        <div className="scards">
          <Card title="Genres" icon="layers"><Donut items={s.genres.map(([k, n]) => ({ label: k, value: n, color: genreColor(k) }))} center={<strong>{s.books.length}</strong>} sub="Bücher" /></Card>
          <Card title="Untergenres" icon="layers"><BarList items={s.subgenres.map(([k, n]) => ({ label: k, value: n }))} color="var(--c1)" /></Card>
          {s.tropes.length > 0 && (
            <Card title="Lieblingstropes" icon="heart" wide>
              <div className="trope-cloud">{s.tropes.map(([k, n], i) => <Link key={k} to={`/bibliothek?trope=${encodeURIComponent(k)}`} className="trope" style={{ fontSize: `${Math.max(13, 20 - i * 0.5)}px` }}>{k}<b>{n}</b></Link>)}</div>
            </Card>
          )}
          <Card title="Wie dick sind deine Bücher?" icon="book" hint="Anzahl Bücher je Seitenzahl."><Columns data={s.pageHist} color="var(--c5)" unit=" Bücher" /></Card>
          {s.decades.length > 0 && <Card title="Aus welcher Zeit" icon="clock" hint="Erstveröffentlichung, nach Jahrzehnt."><Columns data={s.decades.map(([d, n]) => ({ label: `${d}er`, value: n, title: `${d}er Jahre: ${n} Bücher` }))} color="var(--c6)" unit=" Bücher" /></Card>}
          <Card title="Zielgruppe" icon="user"><BarList items={s.audience.map(([k, n]) => ({ label: k, value: n }))} color="var(--c6)" /></Card>
          <Card title="Sprache" icon="globe"><BarList items={s.languages.map(([k, n]) => ({ label: k, value: n }))} color="var(--c3)" /></Card>
          {s.rated.length > 0 && <Card title="Deine Sterne" icon="star" hint={`${s.rated.length} bewertete Bücher.`}><Columns data={s.stars} color="var(--star)" unit=" Bücher" /></Card>}
          {s.expect.length > 0 && (
            <Card title="Erwartungen" icon="target">
              <StackBar items={[["uebertroffen", "Übertroffen", "var(--c4)"], ["erfuellt", "Erfüllt", "var(--c3)"], ["untertroffen", "Enttäuscht", "var(--c2)"]].map(([k, l, c]) => ({ label: l, value: s.expect.find(([x]) => x === k)?.[1] ?? 0, color: c }))} />
              {s.verdicts.length > 0 && <><p className="scard-sub">Kurzbewertung</p><BarList items={s.verdicts.map(([k, n]) => ({ label: k, value: n }))} color="var(--c2)" /></>}
            </Card>
          )}
          {s.genreStars.length > 0 && <Card title="Ø Sterne pro Genre" icon="star" hint="Nur Genres mit mindestens 3 bewerteten Büchern."><BarList items={s.genreStars.map((x) => ({ label: x.g, value: x.a!, color: genreColor(x.g), sub: `(${x.n})` }))} max={5} /></Card>}
          {s.spice.some((x) => x.value) && <Card title="Spice" icon="heart" hint="0 = keine Szenen, 5 = sehr explizit."><Columns data={s.spice} color="var(--c7)" unit=" Bücher" /></Card>}
        </div>
      )}

      {tab === "autoren" && (
        <div className="scards">
          <div className="kpis wide">
            <Kpi icon="user" tone="blue" label="Autor:innen gelesen" value={s.authorsRead.length} />
            {s.newAuthors != null && <Kpi icon="sparkle" tone="green" label={`Neu entdeckt ${year}`} value={s.newAuthors} sub="zum ersten Mal gelesen" />}
            <Kpi icon="globe" tone="yellow" label="Länder" value={s.nCountries} />
          </div>
          <Card title="Meistgelesen" icon="heart" wide>
            <div className="top-authors">
              {s.topAuthors.map(({ a, n }, i) => (
                <button key={a.id} type="button" className="ta" onClick={() => openAuthor(a.slug)}>
                  <span className="ta-rank">{i + 1}</span>
                  <AuthorPhoto author={a} size={44} />
                  <span className="ta-name">{a.name}</span>
                  <span className="ta-n">{n} {n === 1 ? "Buch" : "Bücher"}</span>
                </button>
              ))}
            </div>
          </Card>
          <Card title="Geschlecht" icon="user" hint={s.genderCounts.some(([k]) => k === "unbekannt") ? "Fehlt eine Angabe, kannst du sie im Pop-up der Autor:in eintragen." : undefined}>
            <Donut items={s.genderCounts.map(([k, n]) => ({ label: k === "unbekannt" ? "Ohne Angabe" : GENDER_COLOR[k]?.label ?? k, value: n, color: GENDER_COLOR[k]?.band ?? "var(--c0)" }))} center={<strong>{s.authorsRead.length}</strong>} sub="Personen" />
          </Card>
          <Card title="Herkunft" icon="globe"><BarList items={s.countries.map(([k, n]) => ({ label: k, value: n }))} color="var(--c6)" /></Card>
        </div>
      )}

      {tab === "geld" && (
        <div className="scards">
          <p className="scard-note wide"><Icon name="clock" size={16} /> Weil kein Kaufdatum gespeichert ist, gelten diese Zahlen für alle Bücher, unabhängig vom gewählten Jahr.</p>
          <div className="kpis wide">
            <Kpi icon="coffee" tone="yellow" label="Ausgegeben" value={euro(g.spent)} sub={`für ${g.bought.length} gekaufte Bücher`} />
            <Kpi icon="book" tone="blue" label="Ø pro Buch" value={g.bought.length ? euro(Math.round(g.spent / g.bought.length)) : "–"} />
            <Kpi icon="books" tone="lilac" label="Ungelesen im Regal" value={euro(g.unreadBought.reduce((n, e) => n + (e.mine.price_cents ?? 0), 0))} sub={`${g.unreadBought.length} gekaufte Bücher warten`} />
            <Kpi icon="gift" tone="pink" label="Wunschliste offen" value={euro(g.wishOpen)} />
          </div>
          <div className="facts wide">
            <Fact icon="coffee" tone="yellow" big={fmtN(g.spent / CAPPUCCINO)}>Cappuccino hättest du für dein Büchergeld kaufen können.</Fact>
            <Fact icon="pizza" tone="pink" big={fmtN(g.spent / 1000)}>Pizzen zu 10 € wären es gewesen.</Fact>
            <Fact icon="ticket" tone="blue" big={fmtN(g.spent / 1200)}>Kinobesuche zu 12 € hätte es dafür gegeben.</Fact>
          </div>
          {g.perFormat.length > 0 && <Card title="Ø Preis nach Format" icon="book"><BarList items={g.perFormat.map((x) => ({ label: x.f, value: x.a, sub: `(${x.n})` }))} color="var(--c5)" unit=" €" /></Card>}
          <Card title="Wie die Bücher zu dir kamen" icon="gift">
            <StackBar items={[{ label: "Gekauft", value: g.nBought, color: "var(--c5)" }, { label: "Nicht gekauft (Geschenk, Tausch …)", value: g.notBought, color: "var(--c2)" }]} />
            <p className="scard-sub">Von deinen gekauften Büchern hast du schon gelesen</p>
            <div className="big-pct"><strong>{g.nBought ? Math.round((g.readBought / g.nBought) * 100) : 0} %</strong><div className="kpi-bar"><div style={{ width: `${g.nBought ? (g.readBought / g.nBought) * 100 : 0}%` }} /></div></div>
          </Card>
          {g.priciest.length > 0 && (
            <Card title="Deine teuersten Bücher" icon="sparkle" wide>
              <div className="hls">{g.priciest.map((e) => bookTile(e, euro(e.mine.price_cents), (e.mine.format ?? []).join(", ")))}</div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
