import { Link } from "../components/Link";
import { useEntries, useUser } from "../data/hooks";
import { Avatar } from "../components/Avatar";

/** Das Menü hinter „Mehr“: alle Seiten, die auf dem Handy nicht in die untere Leiste passen. */
export default function Mehr() {
  const { entries, lib } = useEntries();
  const { data: user } = useUser();
  const series = new Set(entries.map((e) => e.series?.id).filter(Boolean)).size;
  const authors = new Set(entries.flatMap((e) => e.authors.map((a) => a.id))).size;
  return (
    <>
      <div className="mast"><h1>Mehr</h1></div>
      <Link to="/profil" className="panel mehr-profile"><Avatar p={user} size={52} /><span><strong>{user?.display_name || "Mein Profil"}</strong><span>{user?.handle ? `@${user.handle} · ` : ""}Profil ansehen und bearbeiten</span></span></Link>
      <div className="menu">
        <Link to="/wunschliste"><strong>Wunschliste</strong><span>{lib?.wishlist_items.length ?? 0} Bücher, auf die du dich freust</span></Link>
        <Link to="/reihen"><strong>Reihen</strong><span>{series} Reihen mit Fortschritt und Lücken</span></Link>
        <Link to="/autorinnen"><strong>Autor:innen</strong><span>{authors} Namen in deinem Regal</span></Link>
        <Link to="/tops"><strong>Tops</strong><span>Deine Lieblingsbücher, Graphics und Autor:innen</span></Link>
        <Link to="/ziele"><strong>Ziele und Challenges</strong><span>Jahresziel, SuB-Ziel, Bingo, Patches</span></Link>
        <Link to="/statistik"><strong>Statistik</strong><span>Lesejahr, Genres, Monate, Bewertungen</span></Link>
        <Link to="/einstellungen"><strong>Einstellungen</strong><span>Konto, Passwort, Darstellung, Export</span></Link>
      </div>
    </>
  );
}
