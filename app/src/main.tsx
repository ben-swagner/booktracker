import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";

// Zeichen für die Selbstheilung in index.html: Die App ist gestartet.
(window as any).__btBooted = true;
try { sessionStorage.removeItem("bt-heal"); } catch { /* egal */ }

// In der Artifact-Vorschau (eingebettete Seite) darf die Adresse nicht verändert werden, deshalb MemoryRouter.
const Router = import.meta.env.VITE_ROUTER === "hash" ? MemoryRouter : BrowserRouter;
if (import.meta.env.VITE_ROUTER !== "hash") {
  // Nach neuer Version schauen: beim Start, wenn die App wieder in den Vordergrund kommt, und jede halbe Stunde.
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
      check();
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    }
  });
  // Absicherung: Liegt auf dem Gerät schon eine neuere Version als die gerade laufende, einmal neu laden.
  // (Die neue Version kommt manchmal an, während die Seite noch lädt; dann wird das Umschalt-Signal verpasst.)
  const running = (document.querySelector('script[type="module"][src*="/assets/index-"]') as HTMLScriptElement | null)?.src.split("/assets/")[1];
  const checkFresh = async () => {
    if (!running) return;
    try {
      const html = await fetch("/index.html", { cache: "no-cache" }).then((r) => r.text());
      const latest = html.match(/assets\/(index-[^"']+\.js)/)?.[1];
      if (!latest || latest === running) return;
      if (sessionStorage.getItem("bt-fresh") === latest) return; // schon einmal versucht, keine Endlosschleife
      sessionStorage.setItem("bt-fresh", latest);
      location.reload();
    } catch { /* offline: egal */ }
  };
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => { checkFresh(); });
    navigator.serviceWorker.ready.then(() => setTimeout(checkFresh, 1500));
  }
  setInterval(checkFresh, 10 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(checkFresh, 1500); });
}

// gespeicherte Darstellung (hell/dunkel) wiederherstellen
const theme = localStorage.getItem("bt-theme");
if (theme) document.documentElement.dataset.theme = theme;

// Fehler sichtbar machen, auch wenn die App komplett verschwindet (nur in der Vorschau)
if (import.meta.env.VITE_ROUTER === "hash") {
  const show = (msg: string) => {
    const d = document.createElement("pre");
    d.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;max-height:40vh;overflow:auto;background:#300;color:#fdd;padding:10px;font:12px monospace;z-index:9999;white-space:pre-wrap";
    d.textContent = msg;
    document.body.appendChild(d);
  };
  window.addEventListener("error", (e) => show("error: " + (e.error?.stack ?? e.message)));
  window.addEventListener("unhandledrejection", (e) => show("promise: " + ((e.reason && e.reason.stack) || String(e.reason))));
}

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <Router>
        <App />
      </Router>
    </QueryClientProvider>
  </React.StrictMode>
);
