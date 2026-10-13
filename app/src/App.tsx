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
import { ErrorBoundary } from "./components/ErrorBoundary";

const LINKS = [
  { to: "/", label: "Start", icon: "M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { to: "/bibliothek", label: "Bibliothek", icon: "M4 4h4v16H4zM10 4h4v16h-4zM16 5l4-1 1 16-4 1z" },
  { to: "/wunschliste", label: "Wunschliste", icon: "M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z" },
  { to: "/statistik", label: "Statistik", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { to: "/einstellungen", label: "Mehr", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3.9a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 2.5a7 7 0 0 0-1.7 1l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 1.7 1l.4 2.5h5l.4-2.5a7 7 0 0 0 1.7-1l2.3.9 2-3.4-2-1.5a7 7 0 0 0 .1-1z" }
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
          <div className="banner">Demo-Modus: Die Daten stammen aus deinem Sheet, Änderungen bleiben nur in diesem Browser. Mit Supabase-Konto wird daraus die echte App.</div>
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
          <Route path="*" element={<Start />} />
        </Routes>
        </ErrorBoundary>
      </main>
      <nav className="tabbar">
        {LINKS.map((l) => (
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
