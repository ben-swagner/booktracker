import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { data } from "./index";
import type { Book, Challenge, ChallengeEntry, Entry, Favorite, Goal, Library, Reading, UserBook, WishlistItem } from "./types";

export function useUser() {
  return useQuery({ queryKey: ["user"], queryFn: () => data.currentUser(), staleTime: Infinity });
}

// Die lokale Kopie ist pro Konto abgelegt, damit nie das Regal einer anderen Person auftaucht.
async function cacheKey(): Promise<string | null> {
  if (data.mode !== "supabase") return null;
  const u = await data.currentUser();
  return u ? `bt-library-v1:${u.id}` : null;
}

/** Lokale Kopie der Bibliothek: sofort anzeigen, dann frisch laden und die Kopie erneuern. */
async function loadWithCache(): Promise<Library> {
  let fresh = await data.loadLibrary();
  // Demo-Modus ändert die Daten an Ort und Stelle: neue Hülle, damit die Anzeige neu rechnet
  if (data.mode !== "supabase") fresh = Object.fromEntries(Object.entries(fresh).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v])) as Library;
  const key = await cacheKey();
  if (key) idbSet(key, { at: Date.now(), lib: fresh }).catch(() => {});
  return fresh;
}

export async function readLibraryCache(): Promise<Library | undefined> {
  try {
    const key = await cacheKey();
    if (!key) return undefined;
    const c = await idbGet<{ at: number; lib: Library }>(key);
    return c?.lib;
  } catch { return undefined; }
}

export async function clearLibraryCache() {
  try { const key = await cacheKey(); if (key) await idbDel(key); } catch { /* egal */ }
}

export function useLibrary() {
  const qc = useQueryClient();
  // Beim ersten Aufruf die lokale Kopie in den Speicher legen, falls noch nichts da ist
  useEffect(() => {
    if (qc.getQueryData(["library"])) return;
    readLibraryCache().then((lib) => {
      if (lib && !qc.getQueryData(["library"])) qc.setQueryData(["library"], lib, { updatedAt: 0 });
    });
  }, [qc]);
  return useQuery({ queryKey: ["library"], queryFn: loadWithCache, staleTime: 5 * 60 * 1000 });
}

/** Alle Bücher der Person, fertig zusammengebaut für die Anzeige. */
export function useEntries(): { entries: Entry[]; lib: Library | undefined; isLoading: boolean } {
  const { data: lib, isLoading } = useLibrary();
  const entries = useMemo(() => {
    if (!lib) return [];
    const authors = new Map(lib.authors.map((a) => [a.id, a]));
    const series = new Map(lib.series.map((s) => [s.id, s]));
    const books = new Map(lib.books.map((b) => [b.id, b]));
    const readings = new Map<string, Reading[]>();
    for (const r of lib.readings) {
      const list = readings.get(r.user_book_id) ?? [];
      list.push(r);
      readings.set(r.user_book_id, list);
    }
    const out: Entry[] = [];
    for (const mine of lib.user_books) {
      const book = books.get(mine.book_id);
      if (!book) continue;
      out.push({
        book,
        mine,
        authors: (book.author_ids ?? []).map((id) => authors.get(id)).filter(Boolean) as any,
        series: book.series_id ? series.get(book.series_id) : undefined,
        readings: (readings.get(mine.id) ?? []).sort((a, b) => a.read_number - b.read_number)
      });
    }
    return out;
  }, [lib]);
  return { entries, lib, isLoading };
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["library"] });
}

export function useSaveBook() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (p: { book: Partial<Book> & { id?: string }; authors: string[]; series?: string | null; mine?: Partial<UserBook> }) =>
      data.saveBook(p.book, p.authors, p.series).then(async (b) => {
        if (p.mine) await data.saveUserBook({ ...p.mine, book_id: b.id });
        return b;
      }),
    onSuccess: inv
  });
}

export function useSaveUserBook() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (ub: Partial<UserBook> & { book_id: string }) => data.saveUserBook(ub), onSuccess: inv });
}

export function useDeleteUserBook() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (id: string) => data.deleteUserBook(id), onSuccess: inv });
}

export function useSaveReading() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (r: Partial<Reading> & { user_book_id: string }) => data.saveReading(r), onSuccess: inv });
}

export function useDeleteReading() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (id: string) => data.deleteReading(id), onSuccess: inv });
}

export function useSaveWishlistItem() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (w: Partial<WishlistItem> & { title: string }) => data.saveWishlistItem(w), onSuccess: inv });
}

export function useDeleteWishlistItem() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (id: string) => data.deleteWishlistItem(id), onSuccess: inv });
}

export function useSaveGoal() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (g: Goal) => data.saveGoal(g), onSuccess: inv });
}

export function useSaveChallenge() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (c: Partial<Challenge> & { name: string }) => data.saveChallenge(c), onSuccess: inv });
}
export function useDeleteChallenge() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (id: string) => data.deleteChallenge(id), onSuccess: inv });
}
export function useSaveChallengeEntry() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (e: Partial<ChallengeEntry> & { challenge_id: string }) => data.saveChallengeEntry(e), onSuccess: inv });
}
export function useDeleteChallengeEntry() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (id: string) => data.deleteChallengeEntry(id), onSuccess: inv });
}
export function useSaveFavorites() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (p: { kind: Favorite["kind"]; items: Partial<Favorite>[] }) => data.saveFavorites(p.kind, p.items), onSuccess: inv });
}
