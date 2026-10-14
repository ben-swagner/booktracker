import { useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import BookDetail from "../pages/BookDetail";

/** Das Fenster selbst. Liegt einmal in der App und reagiert auf ?buch=<id>. */
export function BookModal() {
  const [params, setParams] = useSearchParams();
  const loc = useLocation();
  const nav = useNavigate();
  const id = params.get("buch");

  const close = () => {
    if ((loc.state as any)?.bookModal) { nav(-1); return; }
    const p = new URLSearchParams(params);
    p.delete("buch");
    setParams(p, { replace: true });
  };

  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!id) return null;
  return (
    <div className="bm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="bm" role="dialog" aria-modal="true" aria-label="Buch">
        <button className="bm-close" onClick={close} aria-label="Schließen" title="Schließen (Esc)">×</button>
        <BookDetail id={id} onClose={close} />
      </div>
    </div>
  );
}
