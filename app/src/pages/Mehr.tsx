import { Link } from "../components/Link";
import { useEntries } from "../data/hooks";

/** Das Menü hinter „Mehr“: alle Seiten, die auf dem Handy nicht in die untere Leiste passen. */
export default function Mehr() {
  const { entries, lib } = useEntries();
  const series = new Set(entries.map((e) => e.series?.id).filter(Boolean)).size;
  const authors = new Set(entries.flatMap((e) => e.authors.map((a) => a.id))).size;
  return (
    <>
      <div className="mast"><h1>Mehr</h1></div>
      <div className="menu">
        <Link to="/wunschliste"><strong>Wunschliste</strong><span>{lib?.wishlist_items.length ?? 0} Bücher, auf die du dich freust</span></Link>
        <Link to="/reihen"><strong>Reihen</strong><span>{series} Reihen mit Fortschritt und Lücken</span></Link>
        <Link to="/autorinnen"><strong>Autor:innen</strong><span>{authors} Namen in deinem Regal</span></Link>
        <Link to="/ziele"><strong>Ziele und Challenges</strong><span>Jahresziel, SuB-Ziel, Bingo</span></Link>
        <Link to="/statistik"><strong>Statistik</strong><span>Lesejahr, Genres, Monate, Bewertungen</span></Link>
        <Link to="/einstellungen"><strong>Einstellungen</strong><span>Konto, Passwort, Darstellung, Export</span></Link>
      </div>
    </>
  );
}
