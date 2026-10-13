import type { DataProvider } from "./provider";
import { newId, slugify } from "./provider";
import type { Book, Goal, Library, Profile, Reading, UserBook, WishlistItem } from "./types";

const KEY = "booktracker-demo-v2";
const DEMO_USER: Profile = { id: "demo", display_name: "Larissa" };

/**
 * Demo-Modus: Grunddaten aus public/demo/data.json, eigene Änderungen im Browser (localStorage).
 * Damit lässt sich die App ohne Konto ausprobieren.
 */
export class LocalProvider implements DataProvider {
  readonly mode = "demo" as const;
  private lib: Library | null = null;
  private listeners = new Set<() => void>();

  async currentUser() {
    return DEMO_USER;
  }
  async signInWithEmail() {}
  async signInWithProvider() {}
  async signOut() {}
  onAuthChange(cb: () => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async loadLibrary(): Promise<Library> {
    if (this.lib) return this.lib;
    let saved: Library | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) saved = JSON.parse(raw);
    } catch {
      saved = null;
    }
    if (saved) {
      this.lib = saved;
      return saved;
    }
    const res = await fetch(import.meta.env.BASE_URL + "demo/data.json");
    const d = await res.json();
    this.lib = {
      authors: d.authors ?? [],
      series: d.series ?? [],
      books: d.books ?? [],
      user_books: d.user_books ?? [],
      readings: d.readings ?? [],
      wishlist_items: d.wishlist_items ?? [],
      goals: d.goals ?? [{ user_id: "demo", year: new Date().getFullYear(), books_goal: 52 }]
    };
    return this.lib;
  }

  private persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.lib));
    } catch {
      // Speicher voll oder gesperrt: Änderungen bleiben für diese Sitzung
    }
  }

  async saveBook(book: Partial<Book> & { id?: string }, authorNames: string[], seriesName?: string | null) {
    const lib = await this.loadLibrary();
    const author_ids = authorNames.filter(Boolean).map((name) => {
      const slug = slugify(name);
      let a = lib.authors.find((x) => x.slug === slug);
      if (!a) {
        a = { id: newId(), name, slug };
        lib.authors.push(a);
      }
      return a.id;
    });
    let series_id: string | null = null;
    if (seriesName) {
      const slug = slugify(seriesName);
      let s = lib.series.find((x) => x.slug === slug);
      if (!s) {
        s = { id: newId(), name: seriesName, slug };
        lib.series.push(s);
      }
      series_id = s.id;
    }
    const existing = book.id ? lib.books.find((b) => b.id === book.id) : undefined;
    const merged: Book = { ...(existing ?? { id: newId(), title: "" }), ...book, author_ids, series_id } as Book;
    if (existing) Object.assign(existing, merged);
    else lib.books.push(merged);
    this.persist();
    return merged;
  }

  async saveUserBook(ub: Partial<UserBook> & { book_id: string }) {
    const lib = await this.loadLibrary();
    const existing = lib.user_books.find((x) => x.id === ub.id || x.book_id === ub.book_id);
    const now = new Date().toISOString();
    const merged: UserBook = {
      ...(existing ?? { id: newId(), user_id: "demo", status: "ungelesen", created_at: now }),
      ...ub,
      updated_at: now
    } as UserBook;
    if (existing) Object.assign(existing, merged);
    else lib.user_books.push(merged);
    this.persist();
    return merged;
  }

  async deleteUserBook(id: string) {
    const lib = await this.loadLibrary();
    lib.user_books = lib.user_books.filter((x) => x.id !== id);
    lib.readings = lib.readings.filter((x) => x.user_book_id !== id);
    this.persist();
  }

  async saveReading(r: Partial<Reading> & { user_book_id: string }) {
    const lib = await this.loadLibrary();
    const existing = r.id ? lib.readings.find((x) => x.id === r.id) : undefined;
    const merged: Reading = { ...(existing ?? { id: newId(), user_id: "demo", read_number: 1 }), ...r } as Reading;
    if (existing) Object.assign(existing, merged);
    else lib.readings.push(merged);
    this.persist();
    return merged;
  }

  async deleteReading(id: string) {
    const lib = await this.loadLibrary();
    lib.readings = lib.readings.filter((x) => x.id !== id);
    this.persist();
  }

  async saveWishlistItem(w: Partial<WishlistItem> & { title: string }) {
    const lib = await this.loadLibrary();
    const existing = w.id ? lib.wishlist_items.find((x) => x.id === w.id) : undefined;
    const merged: WishlistItem = { ...(existing ?? { id: newId(), user_id: "demo", priority: "mittel" }), ...w } as WishlistItem;
    if (existing) Object.assign(existing, merged);
    else lib.wishlist_items.push(merged);
    this.persist();
    return merged;
  }

  async deleteWishlistItem(id: string) {
    const lib = await this.loadLibrary();
    lib.wishlist_items = lib.wishlist_items.filter((x) => x.id !== id);
    this.persist();
  }

  async saveGoal(g: Goal) {
    const lib = await this.loadLibrary();
    const existing = lib.goals.find((x) => x.year === g.year);
    if (existing) Object.assign(existing, g);
    else lib.goals.push(g);
    this.persist();
    return g;
  }

  /** Demo-Daten zurücksetzen (Einstellungen) */
  reset() {
    localStorage.removeItem(KEY);
    this.lib = null;
  }
}
