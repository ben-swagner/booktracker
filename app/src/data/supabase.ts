import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DataProvider, ImportBundle, ImportSummary } from "./provider";
import { slugify } from "./provider";
import type { Book, Challenge, ChallengeEntry, Favorite, Goal, Library, Profile, Reading, UserBook, WishlistItem } from "./types";

/** Echte Datenbank mit Konten (Supabase). */
export class SupabaseProvider implements DataProvider {
  readonly mode = "supabase" as const;
  private sb: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey);
  }

  async currentUser(): Promise<Profile | null> {
    const { data } = await this.sb.auth.getUser();
    if (!data.user) return null;
    const { data: p } = await this.sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
    return (p as Profile) ?? { id: data.user.id, display_name: data.user.email ?? "" };
  }

  async signInWithEmail(email: string) {
    const { error } = await this.sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) throw error;
  }

  async signInWithPassword(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async setPassword(password: string) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) throw error;
  }

  async signInWithProvider(provider: "google" | "apple") {
    const { error } = await this.sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin }
    });
    if (error) throw error;
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  onAuthChange(cb: () => void) {
    const { data } = this.sb.auth.onAuthStateChange(() => cb());
    return () => data.subscription.unsubscribe();
  }

  private async uid(): Promise<string> {
    const { data } = await this.sb.auth.getUser();
    if (!data.user) throw new Error("Nicht angemeldet");
    return data.user.id;
  }

  /** Holt alle eigenen Zeilen einer Tabelle, seitenweise (Supabase liefert höchstens 1000 pro Anfrage). */
  private async fetchMine(table: string, uid: string, orderBy = "id"): Promise<any[]> {
    const PAGE = 1000;
    const out: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.sb.from(table).select("*").eq("user_id", uid).order(orderBy).range(from, from + PAGE - 1);
      if (error) throw error;
      out.push(...(data as any[]));
      if ((data as any[]).length < PAGE) break;
    }
    return out;
  }

  /** Holt Zeilen nach Kennung in kleinen Häppchen, damit die Anfrage-Adresse nicht zu lang wird. */
  private async fetchIn(table: string, select: string, ids: string[], column = "id"): Promise<any[]> {
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 120) chunks.push(ids.slice(i, i + 120));
    // alle Häppchen gleichzeitig anfordern statt nacheinander
    const results = await Promise.all(chunks.map((c) => this.sb.from(table).select(select).in(column, c)));
    const out: any[] = [];
    for (const r of results) { if (r.error) throw r.error; out.push(...(r.data as any[])); }
    return out;
  }

  async loadLibrary(): Promise<Library> {
    const uid = await this.uid();
    // Nur die Bücher laden, die die Person im Regal hat
    const [ubRows, rdRows, wlRows, glRows, chRows, favRows] = await Promise.all([
      this.fetchMine("user_books", uid),
      this.fetchMine("readings", uid),
      this.fetchMine("wishlist_items", uid),
      this.fetchMine("goals", uid, "year"),
      this.fetchMine("challenges", uid),
      this.fetchMine("favorites", uid)
    ]);
    const ceRows = chRows.length ? await this.fetchIn("challenge_entries", "*", chRows.map((c: any) => c.id), "challenge_id") : [];
    const ub = { data: ubRows }, rd = { data: rdRows }, wl = { data: wlRows }, gl = { data: glRows };
    const bookIds = (ub.data as UserBook[]).map((x) => x.book_id);
    const rawBooks = await this.fetchIn("books", "*, book_authors(author_id, position), adaptations(kind)", bookIds);
    const books: Book[] = rawBooks.map((b: any) => ({
      ...b,
      author_ids: [...(b.book_authors ?? [])].sort((x, y) => x.position - y.position).map((x) => x.author_id),
      adaptations: (b.adaptations ?? []).map((x: any) => x.kind),
      book_authors: undefined
    }));
    const authorIds = [...new Set(books.flatMap((b) => b.author_ids ?? []))];
    const seriesIds = [...new Set(books.map((b) => b.series_id).filter(Boolean))] as string[];
    const [authors, series] = await Promise.all([this.fetchIn("authors", "*", authorIds), this.fetchIn("series", "*", seriesIds)]);
    const au = { data: authors }, se = { data: series };
    return {
      authors: au.data as any,
      series: se.data as any,
      books,
      user_books: ub.data as UserBook[],
      readings: rd.data as Reading[],
      wishlist_items: wl.data as WishlistItem[],
      goals: gl.data as Goal[],
      challenges: chRows as Challenge[],
      challenge_entries: ceRows as ChallengeEntry[],
      favorites: favRows as Favorite[]
    };
  }

  async saveBook(book: Partial<Book> & { id?: string }, authorNames: string[], seriesName?: string | null) {
    const uid = await this.uid();
    const authorIds: string[] = [];
    for (const name of authorNames.filter(Boolean)) {
      const slug = slugify(name);
      const { data: found } = await this.sb.from("authors").select("id").eq("slug", slug).maybeSingle();
      if (found) authorIds.push(found.id);
      else {
        const { data, error } = await this.sb.from("authors").insert({ name, slug, created_by: uid }).select("id").single();
        if (error) throw error;
        authorIds.push(data.id);
      }
    }
    let series_id: string | null = null;
    if (seriesName) {
      const slug = slugify(seriesName);
      const { data: found } = await this.sb.from("series").select("id").eq("slug", slug).maybeSingle();
      if (found) series_id = found.id;
      else {
        const { data, error } = await this.sb.from("series").insert({ name: seriesName, slug, created_by: uid }).select("id").single();
        if (error) throw error;
        series_id = data.id;
      }
    }
    const { author_ids: _a, adaptations: _ad, ...row } = book as any;
    const payload = { ...row, series_id, created_by: book.id ? undefined : uid };
    const { data, error } = await this.sb.from("books").upsert(payload).select("*").single();
    if (error) throw error;
    await this.sb.from("book_authors").delete().eq("book_id", data.id);
    if (authorIds.length) {
      await this.sb.from("book_authors").insert(authorIds.map((author_id, i) => ({ book_id: data.id, author_id, position: i + 1 })));
    }
    return { ...data, author_ids: authorIds } as Book;
  }

  async saveUserBook(ub: Partial<UserBook> & { book_id: string }) {
    const uid = await this.uid();
    const { data, error } = await this.sb
      .from("user_books")
      .upsert({ ...ub, user_id: uid }, { onConflict: "user_id,book_id" })
      .select("*")
      .single();
    if (error) throw error;
    return data as UserBook;
  }

  async deleteUserBook(id: string) {
    const { error } = await this.sb.from("user_books").delete().eq("id", id);
    if (error) throw error;
  }

  async saveReading(r: Partial<Reading> & { user_book_id: string }) {
    const uid = await this.uid();
    const { data, error } = await this.sb.from("readings").upsert({ ...r, user_id: uid }).select("*").single();
    if (error) throw error;
    return data as Reading;
  }

  async deleteReading(id: string) {
    const { error } = await this.sb.from("readings").delete().eq("id", id);
    if (error) throw error;
  }

  async saveWishlistItem(w: Partial<WishlistItem> & { title: string }) {
    const uid = await this.uid();
    const { data, error } = await this.sb.from("wishlist_items").upsert({ ...w, user_id: uid }).select("*").single();
    if (error) throw error;
    return data as WishlistItem;
  }

  async deleteWishlistItem(id: string) {
    const { error } = await this.sb.from("wishlist_items").delete().eq("id", id);
    if (error) throw error;
  }

  async saveGoal(g: Goal) {
    const uid = await this.uid();
    const { data, error } = await this.sb.from("goals").upsert({ ...g, user_id: uid }).select("*").single();
    if (error) throw error;
    return data as Goal;
  }

  async saveChallenge(c: Partial<Challenge> & { name: string }) {
    const uid = await this.uid();
    const { data, error } = await this.sb.from("challenges").upsert({ ...c, user_id: uid }).select("*").single();
    if (error) throw error;
    return data as Challenge;
  }
  async deleteChallenge(id: string) {
    const { error } = await this.sb.from("challenges").delete().eq("id", id);
    if (error) throw error;
  }
  async saveChallengeEntry(e: Partial<ChallengeEntry> & { challenge_id: string }) {
    const { data, error } = await this.sb.from("challenge_entries").upsert(e).select("*").single();
    if (error) throw error;
    return data as ChallengeEntry;
  }
  async deleteChallengeEntry(id: string) {
    const { error } = await this.sb.from("challenge_entries").delete().eq("id", id);
    if (error) throw error;
  }
  async saveFavorites(kind: Favorite["kind"], items: Partial<Favorite>[]) {
    const uid = await this.uid();
    const { error: e1 } = await this.sb.from("favorites").delete().eq("user_id", uid).eq("kind", kind);
    if (e1) throw e1;
    if (items.length) {
      const { error } = await this.sb.from("favorites").insert(items.map((f, i) => ({ user_id: uid, kind, rank: i + 1, book_id: f.book_id ?? null, author_id: f.author_id ?? null, series_id: f.series_id ?? null })));
      if (error) throw error;
    }
  }
  async saveCover(bookId: string, url: string) {
    await this.sb.from("books").update({ cover_url: url }).eq("id", bookId);
  }

  async saveAuthor(authorId: string, fields: { gender?: string | null; country?: string | null }) {
    const { error } = await this.sb.from("authors").update(fields).eq("id", authorId);
    if (error) throw error;
  }

  async saveAuthorPhoto(authorId: string, url: string) {
    await this.sb.from("authors").update({ photo_url: url }).eq("id", authorId);
  }

  /**
   * Übernimmt die Daten aus dem Sheet (public/demo/data.json) in dieses Konto.
   * Gemeinsame Buchdaten werden eingefügt, falls noch nicht vorhanden; persönliche Daten
   * bekommen die Kennung der angemeldeten Person. Mehrfaches Ausführen legt nichts doppelt an.
   */
  async importLibrary(src: ImportBundle, onProgress?: (step: string, done: number, total: number) => void): Promise<ImportSummary> {
    const uid = await this.uid();
    const summary: ImportSummary = {};
    const CHUNK = 400;
    const run = async (label: string, table: string, rows: any[], opts: { onConflict?: string; ignore?: boolean } = {}) => {
      let done = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        // defaultToNull: false = fehlende Felder bekommen den Standardwert der Tabelle (z. B. leere Liste) statt "nichts"
        const q = this.sb.from(table).upsert(chunk, { onConflict: opts.onConflict ?? "id", ignoreDuplicates: opts.ignore ?? true, defaultToNull: false });
        const { error } = await q;
        if (error) throw new Error(`${label}: ${error.message}`);
        done += chunk.length;
        onProgress?.(label, done, rows.length);
      }
      summary[table] = rows.length;
    };
    const clean = (o: any, drop: string[]) => {
      const out: any = {};
      for (const [k, v] of Object.entries(o)) if (!drop.includes(k)) out[k] = v;
      return out;
    };
    const mine = (o: any) => ({ ...o, user_id: uid });

    await run("Autor:innen", "authors", (src.authors ?? []).map((a) => ({ ...clean(a, []), created_by: uid })));
    await run("Reihen", "series", (src.series ?? []).map((s) => ({ ...clean(s, []), created_by: uid })));
    const books = (src.books ?? []) as any[];
    await run("Bücher", "books", books.map((b) => ({ ...clean(b, ["author_ids", "adaptations"]), created_by: uid })));
    const ba: any[] = [];
    for (const b of books) (b.author_ids ?? []).forEach((author_id: string, i: number) => ba.push({ book_id: b.id, author_id, position: i + 1 }));
    await run("Autor:innen-Zuordnung", "book_authors", ba, { onConflict: "book_id,author_id" });
    const ad: any[] = [];
    for (const b of books) for (const kind of b.adaptations ?? []) ad.push({ id: uuid5(`${b.id}|${kind}`), book_id: b.id, kind });
    await run("Adaptionen", "adaptations", ad);

    // Persönliche Daten: die Kennungen aus der Datei bleiben, nur die Person wird ersetzt.
    await run("Mein Regal", "user_books", (src.user_books ?? []).map(mine), { onConflict: "user_id,book_id" });
    await run("Lesevorgänge", "readings", (src.readings ?? []).map(mine));
    await run("Wunschliste", "wishlist_items", (src.wishlist_items ?? []).map(mine));
    await run("Verkauf", "sales", (src.sales ?? []).map(mine));
    await run("Challenges", "challenges", (src.challenges ?? []).map(mine));
    await run("Challenge-Felder", "challenge_entries", src.challenge_entries ?? []);
    await run("Tops", "favorites", (src.favorites ?? []).map(mine), { onConflict: "user_id,kind,rank" });
    await run("Ziele", "goals", (src.goals ?? []).map(mine), { onConflict: "user_id,year" });
    return summary;
  }
}

/** Kleine, feste Kennung aus einem Text (für Zeilen ohne eigene ID). */
function uuid5(text: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    h1 = Math.imul(h1 ^ text.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ text.charCodeAt(i), 0x811c9dc5) >>> 0;
  }
  const hex = (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).repeat(2);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
