import type { DataProvider, ImportBundle } from "./provider";
import { newId, slugify } from "./provider";
import type { Adaptation, Book, Challenge, ChallengeEntry, Favorite, Goal, Library, Profile, Reading, UserBook, WishlistItem } from "./types";

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
  async signInWithPassword() {}
  async setPassword() {}
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
      saved.challenges ??= [];
      saved.challenge_entries ??= [];
      saved.favorites ??= [];
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
      goals: d.goals ?? [{ user_id: "demo", year: new Date().getFullYear(), books_goal: 52 }],
      challenges: d.challenges ?? [],
      challenge_entries: d.challenge_entries ?? [],
      favorites: d.favorites ?? []
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

  async saveAdaptation(a: Partial<Adaptation> & { book_id: string; kind: string }) {
    const lib = await this.loadLibrary();
    const b = lib.books.find((x) => x.id === a.book_id);
    if (!b) throw new Error("Buch nicht gefunden");
    const rows = b.adaptation_rows ?? (b.adaptations ?? []).map((kind) => ({ id: `${b.id}|${kind}`, book_id: b.id, kind }));
    const row: Adaptation = { ...(rows.find((x) => x.id === a.id) ?? { id: newId() }), ...a } as Adaptation;
    b.adaptation_rows = [...rows.filter((x) => x.id !== row.id), row];
    b.adaptations = b.adaptation_rows.map((x) => x.kind);
    this.persist();
    return row;
  }

  async deleteAdaptation(id: string) {
    const lib = await this.loadLibrary();
    for (const b of lib.books) {
      const rows = b.adaptation_rows ?? (b.adaptations ?? []).map((kind) => ({ id: `${b.id}|${kind}`, book_id: b.id, kind }));
      if (!rows.some((x) => x.id === id)) continue;
      b.adaptation_rows = rows.filter((x) => x.id !== id);
      b.adaptations = b.adaptation_rows.map((x) => x.kind);
    }
    this.persist();
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

  async saveChallenge(c: Partial<Challenge> & { name: string }) {
    const lib = await this.loadLibrary();
    const existing = c.id ? lib.challenges.find((x) => x.id === c.id) : undefined;
    const merged: Challenge = { ...(existing ?? { id: newId(), user_id: "demo", kind: "liste" }), ...c } as Challenge;
    if (existing) Object.assign(existing, merged); else lib.challenges.push(merged);
    this.persist();
    return merged;
  }
  async deleteChallenge(id: string) {
    const lib = await this.loadLibrary();
    lib.challenges = lib.challenges.filter((x) => x.id !== id);
    lib.challenge_entries = lib.challenge_entries.filter((x) => x.challenge_id !== id);
    this.persist();
  }
  async saveChallengeEntry(e: Partial<ChallengeEntry> & { challenge_id: string }) {
    const lib = await this.loadLibrary();
    const existing = e.id ? lib.challenge_entries.find((x) => x.id === e.id) : undefined;
    const merged: ChallengeEntry = { ...(existing ?? { id: newId() }), ...e } as ChallengeEntry;
    if (existing) Object.assign(existing, merged); else lib.challenge_entries.push(merged);
    this.persist();
    return merged;
  }
  async deleteChallengeEntry(id: string) {
    const lib = await this.loadLibrary();
    lib.challenge_entries = lib.challenge_entries.filter((x) => x.id !== id);
    this.persist();
  }
  async saveFavorites(kind: Favorite["kind"], items: Partial<Favorite>[]) {
    const lib = await this.loadLibrary();
    lib.favorites = lib.favorites.filter((f) => f.kind !== kind).concat(items.map((f, i) => ({ id: newId(), user_id: "demo", kind, rank: i + 1, ...f } as Favorite)));
    this.persist();
  }
  async saveCovers(list: { id: string; url: string | null }[], onProgress?: (done: number) => void) {
    const lib = await this.loadLibrary();
    const byId = new Map(lib.books.map((b) => [b.id, b]));
    for (const j of list) { const b = byId.get(j.id); if (b) b.cover_url = j.url; }
    this.persist();
    onProgress?.(list.length);
    return 0;
  }
  async saveCover(bookId: string, url: string | null) {
    const lib = await this.loadLibrary();
    const b = lib.books.find((x) => x.id === bookId);
    if (b) { b.cover_url = url; this.persist(); }
  }

  async saveAuthor(authorId: string, fields: { gender?: string | null; country?: string | null }) {
    const lib = await this.loadLibrary();
    const a = lib.authors.find((x) => x.id === authorId);
    if (a) { Object.assign(a, fields); this.persist(); }
  }

  async saveAuthorPhotos(list: { id: string; url: string }[], onProgress?: (done: number) => void) {
    const lib = await this.loadLibrary();
    const byId = new Map(lib.authors.map((a) => [a.id, a]));
    for (const j of list) { const a = byId.get(j.id); if (a) a.photo_url = j.url; }
    this.persist();
    onProgress?.(list.length);
    return 0;
  }
  async saveAuthorPhoto(authorId: string, url: string) {
    const lib = await this.loadLibrary();
    const a = lib.authors.find((x) => x.id === authorId);
    if (a) { a.photo_url = url; this.persist(); }
  }

  async importLibrary(src: ImportBundle) {
    const lib = await this.loadLibrary();
    for (const k of ["authors", "series", "books", "user_books", "readings", "wishlist_items", "goals", "challenges", "challenge_entries", "favorites"] as const) {
      const incoming = (src[k] ?? []) as any[];
      const have = new Set((lib[k] as any[]).map((x) => x.id ?? `${x.user_id}-${x.year}`));
      for (const row of incoming) if (!have.has(row.id ?? `${row.user_id}-${row.year}`)) (lib[k] as any[]).push(row);
    }
    this.persist();
    return { books: lib.books.length };
  }

  /** Demo-Daten zurücksetzen (Einstellungen) */
  reset() {
    localStorage.removeItem(KEY);
    this.lib = null;
  }
}
