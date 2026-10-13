import { data } from "../data";
import { useEntries, useUser } from "../data/hooks";
import { LocalProvider } from "../data/local";
import { STATUS, fmtDate } from "../lib/labels";
import { authorNames } from "../components/ui";

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
      <div className="mast"><h1>Mehr</h1></div>
      <div className="panel section">
        <h3>Konto</h3>
        <p style={{ margin: 0 }}>Angemeldet als <strong>{user?.display_name}</strong>{data.mode === "demo" ? " (Demo, ohne Konto)" : ""}.</p>
        {data.mode === "supabase" && <div className="actions"><button className="btn" onClick={() => data.signOut()}>Abmelden</button></div>}
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
