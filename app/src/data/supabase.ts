import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DataProvider } from "./provider";
import { slugify } from "./provider";
import type { Book, Goal, Library, Profile, Reading, UserBook, WishlistItem } from "./types";

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

  async loadLibrary(): Promise<Library> {
    const uid = await this.uid();
    // Nur die Bücher laden, die die Person im Regal hat
    const [ub, rd, wl, gl] = await Promise.all([
      this.sb.from("user_books").select("*").eq("user_id", uid),
      this.sb.from("readings").select("*").eq("user_id", uid),
      this.sb.from("wishlist_items").select("*").eq("user_id", uid),
      this.sb.from("goals").select("*").eq("user_id", uid)
    ]);
    for (const r of [ub, rd, wl, gl]) if (r.error) throw r.error;
    const bookIds = (ub.data as UserBook[]).map((x) => x.book_id);
    const books: Book[] = [];
    // in Häppchen laden, damit die Anfrage nicht zu lang wird
    for (let i = 0; i < bookIds.length; i += 300) {
      const chunk = bookIds.slice(i, i + 300);
      const { data, error } = await this.sb
        .from("books")
        .select("*, book_authors(author_id, position), adaptations(kind)")
        .in("id", chunk);
      if (error) throw error;
      for (const b of data as any[]) {
        books.push({
          ...b,
          author_ids: [...(b.book_authors ?? [])].sort((x, y) => x.position - y.position).map((x) => x.author_id),
          adaptations: (b.adaptations ?? []).map((x: any) => x.kind),
          book_authors: undefined
        });
      }
    }
    const authorIds = [...new Set(books.flatMap((b) => b.author_ids ?? []))];
    const seriesIds = [...new Set(books.map((b) => b.series_id).filter(Boolean))] as string[];
    const [au, se] = await Promise.all([
      authorIds.length ? this.sb.from("authors").select("*").in("id", authorIds) : { data: [], error: null },
      seriesIds.length ? this.sb.from("series").select("*").in("id", seriesIds) : { data: [], error: null }
    ]);
    if (au.error) throw au.error;
    if (se.error) throw se.error;
    return {
      authors: au.data as any,
      series: se.data as any,
      books,
      user_books: ub.data as UserBook[],
      readings: rd.data as Reading[],
      wishlist_items: wl.data as WishlistItem[],
      goals: gl.data as Goal[]
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
}
