import type { Book, Challenge, ChallengeEntry, Favorite, Goal, Library, Profile, Reading, UserBook, WishlistItem } from "./types";

export interface ImportBundle extends Partial<Library> {
  sales?: any[];
  favorites?: any[];
  challenges?: any[];
  challenge_entries?: any[];
}
export type ImportSummary = Record<string, number>;

/**
 * Der Datenzugriff hat zwei Ausführungen:
 *  - Demo (ohne Supabase): liest public/demo/data.json, Änderungen bleiben im Browser.
 *  - Supabase: echte Datenbank mit Konten.
 * Die Seiten der App reden nur mit dieser Schnittstelle.
 */
export interface DataProvider {
  readonly mode: "demo" | "supabase";
  currentUser(): Promise<Profile | null>;
  signInWithEmail(email: string): Promise<void>;
  signInWithPassword(email: string, password: string): Promise<void>;
  setPassword(password: string): Promise<void>;
  signInWithProvider(provider: "google" | "apple"): Promise<void>;
  signOut(): Promise<void>;
  onAuthChange(cb: () => void): () => void;

  loadLibrary(): Promise<Library>;

  saveBook(book: Partial<Book> & { id?: string }, authorNames: string[], seriesName?: string | null): Promise<Book>;
  saveUserBook(ub: Partial<UserBook> & { book_id: string }): Promise<UserBook>;
  deleteUserBook(id: string): Promise<void>;
  saveReading(r: Partial<Reading> & { user_book_id: string }): Promise<Reading>;
  deleteReading(id: string): Promise<void>;
  saveWishlistItem(w: Partial<WishlistItem> & { title: string }): Promise<WishlistItem>;
  deleteWishlistItem(id: string): Promise<void>;
  saveGoal(g: Goal): Promise<Goal>;
  saveChallenge(c: Partial<Challenge> & { name: string }): Promise<Challenge>;
  deleteChallenge(id: string): Promise<void>;
  saveChallengeEntry(e: Partial<ChallengeEntry> & { challenge_id: string }): Promise<ChallengeEntry>;
  deleteChallengeEntry(id: string): Promise<void>;
  /** Favoritenliste einer Art komplett ersetzen (Reihenfolge = Rang). */
  saveFavorites(kind: Favorite["kind"], items: Partial<Favorite>[]): Promise<void>;
  /** Cover-Adresse an einem Buch merken (gemeinsame Buchdaten). */
  saveCover(bookId: string, url: string | null): Promise<void>;
  /** Viele Cover auf einmal speichern; meldet Fortschritt und gibt die Zahl der Fehler zurück. */
  saveCovers(list: { id: string; url: string | null }[], onProgress?: (done: number) => void): Promise<number>;
  /** Foto-Adresse an einer Autor:in merken (gemeinsame Buchdaten). */
  saveAuthorPhoto(authorId: string, url: string): Promise<void>;
  /** Viele Autor:innen-Fotos auf einmal speichern; gibt die Zahl der Fehler zurück. */
  saveAuthorPhotos(list: { id: string; url: string }[], onProgress?: (done: number) => void): Promise<number>;
  /** Angaben einer Autor:in ändern (z. B. Geschlecht, Land). */
  saveAuthor(authorId: string, fields: { gender?: string | null; country?: string | null }): Promise<void>;
  /** Übernimmt einen kompletten Datenbestand (z. B. aus dem Sheet) in das Konto der Person. */
  importLibrary(src: ImportBundle, onProgress?: (step: string, done: number, total: number) => void): Promise<ImportSummary>;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "x";
}
