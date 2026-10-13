import type { Book, Goal, Library, Profile, Reading, UserBook, WishlistItem } from "./types";

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
