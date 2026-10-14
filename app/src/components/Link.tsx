import { Link as RLink, NavLink as RNavLink, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * In der eingebetteten Vorschau (Artifact) fängt die umgebende Seite Klicks auf echte Links ab
 * und versucht, eine andere Datei zu öffnen. Deshalb werden Links dort ohne href gezeichnet
 * und der Seitenwechsel läuft nur innerhalb der App.
 */
const EMBEDDED = import.meta.env.VITE_ROUTER === "hash";

type Props = { to: string; className?: string; children?: ReactNode; title?: string; style?: React.CSSProperties; end?: boolean; onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void };

export function Link({ to, className, children, title, style, onClick }: Props) {
  const nav = useNavigate();
  if (!EMBEDDED) return <RLink to={to} className={className} title={title} style={style} onClick={onClick}>{children}</RLink>;
  return (
    <a role="link" tabIndex={0} className={className} title={title} style={{ cursor: "pointer", ...style }}
      onClick={(e) => { onClick?.(e); if (e.defaultPrevented) return; e.preventDefault(); nav(to); }}
      onKeyDown={(e) => { if (e.key === "Enter") nav(to); }}>
      {children}
    </a>
  );
}

export function NavLink({ to, className, children, end }: Props) {
  const nav = useNavigate();
  const loc = useLocation();
  if (!EMBEDDED) return <RNavLink to={to} className={className} end={end}>{children}</RNavLink>;
  const active = end ? loc.pathname === to : loc.pathname === to || loc.pathname.startsWith(to + "/");
  return (
    <a role="link" tabIndex={0} className={[className, active ? "active" : ""].filter(Boolean).join(" ")} style={{ cursor: "pointer" }}
      aria-current={active ? "page" : undefined}
      onClick={(e) => { e.preventDefault(); nav(to); }}
      onKeyDown={(e) => { if (e.key === "Enter") nav(to); }}>
      {children}
    </a>
  );
}
