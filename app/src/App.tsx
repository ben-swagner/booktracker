import { Route, Routes, useLocation } from "react-router-dom";
import { NavLink } from "./components/Link";
import { useEffect, useState } from "react";
import { data } from "./data";
import { useUser } from "./data/hooks";
import Start from "./pages/Start";
import Bibliothek from "./pages/Bibliothek";
import BookDetail from "./pages/BookDetail";
import BookForm from "./pages/BookForm";
import Wunschliste from "./pages/Wunschliste";
import Statistik from "./pages/Statistik";
import Einstellungen from "./pages/Einstellungen";
import Login from "./pages/Login";
import SuB from "./pages/SuB";
import Regal from "./pages/Regal";
import Reihen from "./pages/Reihen";
import Autorinnen from "./pages/Autorinnen";
import Ziele from "./pages/Ziele";
import Mehr from "./pages/Mehr";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Untere Leiste auf dem Handy (fünf Plätze), oben am Computer stehen alle Seiten
const ICONS = {
  home: "M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  books: "M4 4h4v16H4zM10 4h4v16h-4zM16 5l4-1 1 16-4 1z",
  shelf: "M3 20h18M4 20V9h4v11M10 20V5h4v15M16 20v-8h4v8",
  dice: "M4 4h16v16H4zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01",
  more: "M5 12h.01M12 12h.01M19 12h.01"
};
const TABS = [
  { to: "/", label: "Start", icon: ICONS.home },
  { to: "/bibliothek", label: "Bibliothek", icon: ICONS.books },
  { to: "/regal", label: "Regal", icon: ICONS.shelf },
  { to: "/sub", label: "SuB", icon: ICONS.dice },
  { to: "/mehr", label: "Mehr", icon: ICONS.more }
];
const LINKS = [
  { to: "/", label: "Start" },
  { to: "/bibliothek", label: "Bibliothek" },
  { to: "/regal", label: "Regal" },
  { to: "/sub", label: "SuB" },
  { to: "/reihen", label: "Reihen" },
  { to: "/autorinnen", label: "Autor:innen" },
  { to: "/ziele", label: "Ziele" },
  { to: "/wunschliste", label: "Wunschliste" },
  { to: "/statistik", label: "Statistik" },
  { to: "/einstellungen", label: "Mehr" }
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function App() {
  const { data: user, isLoading, refetch } = useUser();
  const loc = useLocation();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => data.onAuthChange(() => refetch()), [refetch]);
  useEffect(() => {
    const h = (ev: Event) => {
      setToast((ev as CustomEvent<string>).detail);
      setTimeout(() => setToast(null), 2600);
    };
    window.addEventListener("toast", h);
    return () => window.removeEventListener("toast", h);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  if (isLoading) return <div className="wrap"><p className="muted">Lade…</p></div>;
  if (!user) return <Login />;

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <NavLink to="/" className="brand"><span className="brand-dot" />Booktracker</NavLink>
          <nav className="nav-links">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === "/"}>{l.label}</NavLink>
            ))}
          </nav>
          <span className="nav-spacer" />
          <NavLink to="/neu" className="btn primary small">+ Buch</NavLink>
        </div>
      </header>
      <main className="wrap">
        {data.mode === "demo" && (
          <div className="banner">Demo-Modus: Die Daten stammen aus deinem Sheet, Änderungen bleiben nur in diesem Browser. Die echte App mit Konto läuft unter booktracker.pages.dev.</div>
        )}
        <ErrorBoundary key={loc.pathname}>
        <Routes>
          <Route path="/" element={<Start />} />
          <Route path="/bibliothek" element={<Bibliothek />} />
          <Route path="/buch/:id" element={<BookDetail />} />
          <Route path="/buch/:id/bearbeiten" element={<BookForm />} />
          <Route path="/neu" element={<BookForm />} />
          <Route path="/wunschliste" element={<Wunschliste />} />
          <Route path="/statistik" element={<Statistik />} />
          <Route path="/einstellungen" element={<Einstellungen />} />
          <Route path="/sub" element={<SuB />} />
          <Route path="/regal" element={<Regal />} />
          <Route path="/reihen" element={<Reihen />} />
          <Route path="/autorinnen" element={<Autorinnen />} />
          <Route path="/autorinnen/:slug" element={<Autorinnen />} />
          <Route path="/ziele" element={<Ziele />} />
          <Route path="/mehr" element={<Mehr />} />
          <Route path="*" element={<Start />} />
        </Routes>
        </ErrorBoundary>
      </main>
      <nav className="tabbar">
        {TABS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === "/"}><Icon d={l.icon} />{l.label}</NavLink>
        ))}
      </nav>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

export function toast(msg: string) {
  window.dispatchEvent(new CustomEvent("toast", { detail: msg }));
}
