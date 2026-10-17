import type { Profile } from "../data/types";
import { initials } from "../lib/profile";

/** Rundes Profilbild; ohne Bild die Initialen auf einem warmen Farbverlauf. */
export function Avatar({ p, size = 40 }: { p?: Profile | null; size?: number }) {
  const name = p?.display_name || p?.handle || "?";
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden="true">
      {p?.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{initials(name)}</span>}
    </span>
  );
}
