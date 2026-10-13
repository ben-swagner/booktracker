import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { data } from "./index";
import type { Book, Entry, Goal, Library, Reading, UserBook, WishlistItem } from "./types";

export function useUser() {
  return useQuery({ queryKey: ["user"], queryFn: () => data.currentUser(), staleTime: Infinity });
}

export function useLibrary() {
  return useQuery({ queryKey: ["library"], queryFn: () => data.loadLibrary(), staleTime: 5 * 60 * 1000 });
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
