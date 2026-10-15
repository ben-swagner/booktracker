import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { data } from "../data";
import { toast } from "../App";
import { clearLibraryCache, useEntries, useUser } from "../data/hooks";
import { LocalProvider } from "../data/local";
import { STATUS, fmtDate } from "../lib/labels";
import { authorNames } from "../components/ui";
import { isSheetPhoto, loadSheetPhotos, sheetPhotoFor, type SheetPhoto } from "../lib/authorPhotos";
import { NO_COVER, coverRun, isGuessedCover, isSheetCover, loadSheetCovers, sheetCoverFor, type SheetCover } from "../lib/covers";

// Der Sheet-Import gehört nur zum Konto, aus dem das Sheet stammt.
const OWNER_ID = "12804274-56db-41a9-a074-6318d4a7f463";

function download(name: string, content: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function Einstellungen() {
  const { data: user } = useUser();
  const { entries, lib } = useEntries();
  const qc = useQueryClient();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [coverMsg, setCoverMsg] = useState<string | null>(null);
  const [coverRunning, setCoverRunning] = useState(false);
  const stopRef = useRef(false);

  const missing = entries.filter((e) => !e.book.cover_url);
  const guessed = entries.filter((e) => isGuessedCover(e.book.cover_url));
  const [sheetList, setSheetList] = useState<SheetCover[] | null>(null);
  useEffect(() => { loadSheetCovers().then(setSheetList); }, []);
  // Bücher, für die es ein Cover aus der alten Tabelle gibt und die es noch nicht haben (eigene Uploads bleiben unangetastet)
  const sheetJobs = !sheetList ? [] : entries.flatMap((e) => {
    const url = sheetCoverFor(sheetList, e.book.title, authorNames(e));
    if (!url || e.book.cover_url === url || e.book.cover_url?.startsWith("data:")) return [];
    return [{ id: e.book.id, url }];
  });
  const sheetDone = entries.filter((e) => isSheetCover(e.book.cover_url)).length;

  async function applySheetCovers() {
    const jobs = sheetJobs.filter((j, i, a) => a.findIndex((x) => x.id === j.id) === i);
    if (!jobs.length) return;
    setCoverRunning(true); stopRef.current = false;
    setCoverMsg(`Starte: ${jobs.length} Cover…`);
    const errors = await data.saveCovers(jobs, (n) => setCoverMsg(`${n} von ${jobs.length} Covern aus der Tabelle übernommen…`));
    setCoverMsg(errors ? `Fertig, aber ${errors} Cover konnten nicht gespeichert werden. Einfach noch einmal tippen.` : `Fertig: ${jobs.length} Cover aus deiner alten Tabelle übernommen.`);
    setCoverRunning(false);
    await qc.invalidateQueries({ queryKey: ["library"] });
  }
  // Autor:innen-Fotos aus der alten Tabelle
  const [photoList, setPhotoList] = useState<SheetPhoto[] | null>(null);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  useEffect(() => { loadSheetPhotos().then(setPhotoList); }, []);
  const allAuthors = [...new Map(entries.flatMap((e) => e.authors).map((a) => [a.id, a])).values()];
  const photoJobs = !photoList ? [] : allAuthors.flatMap((a) => {
    const url = sheetPhotoFor(photoList, a.name);
    return url && a.photo_url !== url ? [{ id: a.id, url }] : [];
  });
  const photoDone = allAuthors.filter((a) => isSheetPhoto(a.photo_url)).length;
  async function applySheetPhotos() {
    if (!photoJobs.length) return;
    setCoverRunning(true);
    setPhotoMsg(`Starte: ${photoJobs.length} Fotos…`);
    const errors = await data.saveAuthorPhotos(photoJobs, (n) => setPhotoMsg(`${n} von ${photoJobs.length} Fotos übernommen…`));
    setPhotoMsg(errors ? `Fertig, aber ${errors} Fotos konnten nicht gespeichert werden. Einfach noch einmal tippen.` : `Fertig: ${photoJobs.length} Fotos aus deiner alten Tabelle übernommen.`);
    setCoverRunning(false);
    await qc.invalidateQueries({ queryKey: ["library"] });
  }
  const toJob = (list: typeof entries) => list.map((e) => ({ id: e.book.id, isbn13: e.book.isbn13, title: e.book.title, author: authorNames(e) }));

  async function runCovers(mode: "fehlend" | "geraten") {
    const jobs = toJob(mode === "fehlend" ? missing : guessed);
    if (!jobs.length) { setCoverMsg(mode === "fehlend" ? "Alle Bücher haben schon ein Cover." : "Es gibt keine geratenen Cover mehr."); return; }
    setCoverRunning(true); stopRef.current = false;
    setCoverMsg(`Starte: ${jobs.length} Bücher…`);
    const res = await coverRun(
      jobs,
      (id, url) => data.saveCover(id, url),
      (d, t, f) => setCoverMsg(`${d} von ${t} geprüft, ${f} sichere Cover gefunden…`),
      () => stopRef.current,
      mode === "geraten"
    );
    setCoverMsg(mode === "fehlend"
      ? `Fertig: ${res.found} neue Cover bei ${res.done} geprüften Büchern. Für den Rest gibt es keinen sicheren Treffer; im Buch unter „Cover suchen“ kannst du selbst aus Vorschlägen wählen.`
      : `Fertig: ${res.done} geratene Cover geprüft, ${res.found} davon sicher ersetzt oder bestätigt. ${res.done - res.found} wurden entfernt, weil nichts eindeutig passte; dort zeigt die App wieder den farbigen Einband.`);
    setCoverRunning(false);
    await qc.invalidateQueries({ queryKey: ["library"] });
  }


  async function savePassword(ev: React.FormEvent) {
    ev.preventDefault();
    if (pw.length < 8) { toast("Das Passwort braucht mindestens 8 Zeichen."); return; }
    if (pw !== pw2) { toast("Die beiden Passwörter sind nicht gleich."); return; }
    try {
      await data.setPassword(pw);
      setPw(""); setPw2("");
      toast("Passwort gespeichert. Damit kannst du dich ab jetzt überall anmelden.");
    } catch (x: any) {
      toast(x.message ?? "Das hat nicht geklappt.");
    }
  }

  async function importSheet() {
    if (!confirm("Alle Bücher, Wunschliste, Verkäufe und Tops aus dem Sheet (Stand 13.10.2026) in dein Konto übernehmen? Was schon da ist, bleibt unverändert.")) return;
    setImporting(true);
    setProgress("Lade die Daten…");
    try {
      const res = await fetch(import.meta.env.BASE_URL + "demo/data.json");
      const bundle = await res.json();
      const summary = await data.importLibrary(bundle, (step, done, total) => setProgress(`${step}: ${done} von ${total}`));
      setProgress(`Fertig: ${summary.books ?? 0} Bücher, ${summary.user_books ?? 0} Regaleinträge, ${summary.readings ?? 0} Lesevorgänge, ${summary.wishlist_items ?? 0} Wünsche.`);
      await qc.invalidateQueries({ queryKey: ["library"] });
      toast("Import abgeschlossen.");
    } catch (x: any) {
      setProgress("Fehler: " + (x.message ?? String(x)));
    } finally {
      setImporting(false);
    }
  }

  function exportJson() {
    if (!lib) return;
    download(`booktracker-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(lib, null, 1), "application/json");
  }
  function exportCsv() {
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["Titel", "Autor:in", "ISBN", "Reihe", "Band", "Status", "Sterne", "Genre", "Seiten", "Beendet"]];
    for (const e of entries) {
      const last = [...e.readings].reverse()[0];
      rows.push([e.book.title, authorNames(e), e.book.isbn13 ?? "", e.series?.name ?? "", e.book.series_number ?? "", STATUS[e.mine.status], e.mine.rating ?? "", e.book.genre ?? "", e.book.pages ?? "", last ? fmtDate(last.finished_on, last.finished_text) : ""].map(String));
    }
    download(`booktracker-${new Date().toISOString().slice(0, 10)}.csv`, "﻿" + rows.map((r) => r.map(esc).join(";")).join("\n"), "text/csv");
  }
  const [theme, setThemeState] = useState(() => { try { return localStorage.getItem("bt-theme") ?? ""; } catch { return ""; } });
  function setTheme(t: string) {
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    localStorage.setItem("bt-theme", t);
    setThemeState(t);
  }

  return (
    <>
      <div className="mast"><h1>Einstellungen</h1></div>
      <div className="panel section">
        <h3>Konto</h3>
        <p style={{ margin: 0 }}>Angemeldet als <strong>{user?.display_name}</strong>{data.mode === "demo" ? " (Demo, ohne Konto)" : ""}.</p>
        {data.mode === "supabase" && <div className="actions"><button className="btn" onClick={async () => { await clearLibraryCache(); await data.signOut(); }}>Abmelden</button></div>}
      </div>
      {data.mode === "supabase" && (
        <form className="panel section" onSubmit={savePassword}>
          <h3>Passwort festlegen</h3>
          <p className="muted" style={{ margin: 0 }}>Mit einem Passwort meldest du dich auf jedem Gerät ohne Mail-Link an. Mindestens 8 Zeichen.</p>
          <div className="form-grid">
            <div className="field"><label htmlFor="pw">Neues Passwort</label><input id="pw" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
            <div className="field"><label htmlFor="pw2">Noch einmal</label><input id="pw2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
          </div>
          <div className="actions"><button className="btn primary" type="submit">Passwort speichern</button></div>
        </form>
      )}
      {data.mode === "supabase" && user?.id === OWNER_ID && new URLSearchParams(location.search).get("import") === "1" && (
        <div className="panel section">
          <h3>Bücher aus dem Sheet übernehmen</h3>
          <p className="muted" style={{ margin: 0 }}>Holt alle 1.551 Bücher samt Wunschliste, Reihen, Rereads, Verkäufen und Tops aus dem Google Sheet (Stand 13.10.2026) in dein Konto. Dauert etwa eine Minute. Mehrfach ausführen ist ungefährlich, es wird nichts doppelt angelegt.</p>
          {progress && <p className="mono" style={{ margin: 0 }}>{progress}</p>}
          <div className="actions"><button className="btn primary" onClick={importSheet} disabled={importing}>{importing ? "Läuft…" : entries.length ? "Noch einmal abgleichen" : "Jetzt übernehmen"}</button></div>
        </div>
      )}
      <div className="panel section">
        <h3>Cover</h3>
        <p className="muted" style={{ margin: 0 }}>
          Die App holt Bilder von Open Library und Google Books. Sicher sind Bilder, die direkt zur ISBN gehören. Bei Büchern ohne ISBN oder ohne Bild zur ISBN sucht sie nach Titel und Autor:in und nimmt nur noch Treffer, bei denen beides passt.
          Ohne Cover: <strong>{missing.filter((e) => e.book.cover_url !== NO_COVER).length}</strong>, aus der alten lockeren Suche geraten: <strong>{guessed.length}</strong> von {entries.length}.
        </p>
        {coverMsg && <p className="mono" style={{ margin: 0, fontSize: 13 }}>{coverMsg}</p>}
        {(sheetJobs.length > 0 || sheetDone > 0) && (
          <div className="sheet-covers">
            <p style={{ margin: 0 }}><strong>Cover aus deiner alten Tabelle:</strong> {sheetDone} übernommen{sheetJobs.length ? <>, <strong>{sheetJobs.length}</strong> können noch übernommen werden. Sie ersetzen die Cover, die die App selbst gefunden hat. Selbst hochgeladene Bilder bleiben.</> : ", alles erledigt."}</p>
            {sheetJobs.length > 0 && <div className="actions"><button className="btn primary" onClick={applySheetCovers} disabled={coverRunning}>{coverRunning ? "Läuft…" : `${sheetJobs.length} Cover übernehmen`}</button></div>}
          </div>
        )}
        <div className="actions">
          <button className="btn" onClick={() => runCovers("geraten")} disabled={coverRunning || !guessed.length}>{coverRunning ? "Läuft…" : "Geratene Cover prüfen"}</button>
          <button className="btn" onClick={() => runCovers("fehlend")} disabled={coverRunning}>Fehlende Cover suchen</button>
          {coverRunning && <button className="btn" onClick={() => { stopRef.current = true; }}>Anhalten</button>}
        </div>
        {(photoJobs.length > 0 || photoDone > 0) && (
          <div className="sheet-covers">
            <p style={{ margin: 0 }}><strong>Fotos der Autor:innen aus deiner alten Tabelle:</strong> {photoDone} übernommen{photoJobs.length ? <>, <strong>{photoJobs.length}</strong> können noch übernommen werden. Sie ersetzen die Fotos, die die App selbst gesucht hat.</> : ", alles erledigt."}</p>
            {photoMsg && <p className="mono" style={{ margin: 0, fontSize: 13 }}>{photoMsg}</p>}
            {photoJobs.length > 0 && <div className="actions"><button className="btn primary" onClick={applySheetPhotos} disabled={coverRunning}>{coverRunning ? "Läuft…" : `${photoJobs.length} Fotos übernehmen`}</button></div>}
          </div>
        )}
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Einzelne Bücher: im Buch auf „Cover ändern“ tippen. Dort kannst du ein eigenes Foto oder Bild hochladen, aus Vorschlägen wählen oder einen Bild-Link eintragen. Neue Bücher holen sich ihr Cover weiterhin automatisch über die ISBN.</p>
      </div>
      <div className="panel section">
        <h3>Darstellung</h3>
        <div className="actions">
          <button className={"btn" + (theme === "" ? " primary" : "")} aria-pressed={theme === ""} onClick={() => setTheme("")}>Wie das Gerät</button>
          <button className={"btn" + (theme === "light" ? " primary" : "")} aria-pressed={theme === "light"} onClick={() => setTheme("light")}>Hell</button>
          <button className={"btn" + (theme === "dark" ? " primary" : "")} aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>Dunkel</button>
        </div>
      </div>
      <div className="panel section">
        <h3>Deine Daten</h3>
        <p className="muted" style={{ margin: 0 }}>Alles gehört dir. Du kannst jederzeit eine Kopie herunterladen.</p>
        <div className="actions">
          <button className="btn" onClick={exportCsv}>Als CSV (für Excel)</button>
          <button className="btn" onClick={exportJson}>Als JSON (Komplett-Sicherung)</button>
        </div>
      </div>
      {data.mode === "demo" && (
        <div className="panel section">
          <h3>Demo zurücksetzen</h3>
          <p className="muted" style={{ margin: 0 }}>Löscht deine Änderungen in diesem Browser und lädt die Daten aus dem Sheet neu.</p>
          <div className="actions"><button className="btn danger" onClick={() => { if (confirm("Wirklich zurücksetzen?")) { (data as LocalProvider).reset(); location.reload(); } }}>Zurücksetzen</button></div>
        </div>
      )}
      <div className="panel section">
        <h3>Als App installieren</h3>
        <p style={{ margin: 0 }}>Auf dem iPhone: Teilen-Symbol, dann „Zum Home-Bildschirm“. Auf Android und am Computer: In der Adressleiste auf „Installieren“ tippen. Danach öffnet sich der Booktracker wie eine normale App.</p>
      </div>
    </>
  );
}
