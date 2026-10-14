import { useNavigate, useSearchParams } from "react-router-dom";

/** Ab dieser Breite öffnen sich Bücher als Fenster über der Seite, darunter als eigene Seite. */
const DESKTOP = "(min-width: 900px)";

export const isDesktop = () => typeof window !== "undefined" && window.matchMedia(DESKTOP).matches;

/**
 * Buch öffnen: am Computer als Fenster (Merker ?buch=<id> in der Adresse, damit „Zurück“ es schließt),
 * am Handy als eigene Seite.
 */
export function useOpenBook() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  return (id: string) => {
    if (!isDesktop()) { nav(`/buch/${id}`); return; }
    const p = new URLSearchParams(params);
    p.set("buch", id);
    setParams(p, { state: { bookModal: true } });
  };
}
