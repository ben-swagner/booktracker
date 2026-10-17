import type { Company, Entry, Reading } from "../data/types";

export const COMPANY_OPTS: [Company, string][] = [["solo", "Solo"], ["buddy", "Buddy Read"], ["group", "Gruppe"]];

/** Mit wem ein Lesevorgang gelesen wurde. Alte Einträge ohne Angabe übernehmen die Angabe am Buch. */
export function readingCompany(e: Entry, r: Reading): Company | null {
  if (r.company) return r.company;
  return e.readings.length <= 1 ? e.mine.company ?? null : null;
}

/** Wurde das Buch (irgendwann) gemeinsam gelesen? Liefert Art und Namen des letzten gemeinsamen Durchgangs. */
export function buddyInfo(e: Entry): { kind: "buddy" | "group"; partners: string | null } | null {
  const shared = [...e.readings].sort((a, b) => b.read_number - a.read_number).find((r) => !r.abandoned && (r.company === "buddy" || r.company === "group"));
  if (shared) return { kind: shared.company as "buddy" | "group", partners: shared.partners?.trim() || null };
  if (e.mine.company === "buddy" || e.mine.company === "group") return { kind: e.mine.company, partners: null };
  return null;
}

export function buddyLabel(b: { kind: "buddy" | "group"; partners: string | null }) {
  return (b.kind === "buddy" ? "Buddy Read" : "Gruppe") + (b.partners ? ` mit ${b.partners}` : "");
}
