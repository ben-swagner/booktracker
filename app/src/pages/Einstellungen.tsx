import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { data } from "../data";
import { toast } from "../App";
import { clearLibraryCache, useEntries, useUser } from "../data/hooks";
import { LocalProvider } from "../data/local";
import { STATUS, fmtDate } from "../lib/labels";
import { authorNames } from "../components/ui";
import { coverRun } from "../lib/covers";

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

  async function runCovers() {
    const missing = entries.filter((e) => !e.book.cover_url).map((e) => ({ id: e.book.id, isbn13: e.book.isbn13, title: e.book.title, author: authorNames(e) }));
    if (!missing.length) { setCoverMsg("Alle Bücher haben schon ein Cover."); return; }
    setCoverRunning(true); stopRef.current = false;
    setCoverMsg(`Starte: ${missing.length} Bücher ohne Cover…`);
    const res = await coverRun(missing, (id, url) => data.saveCover(id, url), (d, t, f) => setCoverMsg(`${d} von ${t} geprüft, ${f} Cover gefunden…`), () => stopRef.current);
    setCoverMsg(`Fertig: ${res.found} neue Cover bei ${res.done} geprüften Büchern. Der Rest hat bei keiner Quelle ein Bild; dort hilft „Cover suchen“ im Buch oder ein eigener Bild-Link.`);
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
  function setTheme(t: string) {
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    localStorage.setItem("bt-theme", t);
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
        <h3>Cover nachladen</h3>
        <p className="muted" style={{ margin: 0 }}>Sucht für alle Bücher ohne Bild bei Open Library und Google Books nach einem Cover und speichert die Treffer. Dauert je nach Anzahl einige Minuten, die Seite dabei offen lassen. Bisher ohne Cover: <strong>{entries.filter((e) => !e.book.cover_url).length}</strong> von {entries.length}.</p>
        {coverMsg && <p className="mono" style={{ margin: 0, fontSize: 13 }}>{coverMsg}</p>}
        <div className="actions">
          <button className="btn primary" onClick={runCovers} disabled={coverRunning}>{coverRunning ? "Läuft…" : "Cover suchen"}</button>
          {coverRunning && <button className="btn" onClick={() => { stopRef.current = true; }}>Anhalten</button>}
        </div>
      </div>
      <div className="panel section">
        <h3>Darstellung</h3>
        <div className="actions">
          <button className="btn" onClick={() => setTheme("")}>Wie das Gerät</button>
          <button className="btn" onClick={() => setTheme("light")}>Hell</button>
          <button className="btn" onClick={() => setTheme("dark")}>Dunkel</button>
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
