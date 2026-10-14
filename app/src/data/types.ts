// Datentypen, passend zu supabase/migrations/0001_init.sql

export type ReadingStatus = "lese" | "tbr" | "ungelesen" | "gelesen" | "abgebrochen" | "wunschliste";
export type Verdict = "love" | "like" | "middle" | "dislike" | "hate" | "idk";
export type Expectation = "uebertroffen" | "erfuellt" | "untertroffen";
export type Burn = "no" | "slow" | "fast";
export type Company = "solo" | "buddy" | "group";

export interface Author {
  id: string;
  name: string;
  slug: string;
  sort_name?: string | null;
  country?: string | null;
  gender?: string | null;
  photo_url?: string | null;
}

export interface Series {
  id: string;
  name: string;
  slug: string;
  total_count?: number | null;
  is_complete?: boolean | null;
  kind?: string | null;
}

export interface Book {
  id: string;
  title: string;
  subtitle?: string | null;
  original_title?: string | null;
  isbn13?: string | null;
  blurb?: string | null;
  first_published?: string | null;
  publisher?: string | null;
  language?: string[];
  pages?: number | null;
  chapters?: number | null;
  kind?: string | null;
  category?: string[];
  genre?: string | null;
  subgenres?: string[];
  audience?: string | null;
  period?: string | null;
  setting?: string | null;
  pov?: string[];
  main_characters?: string[];
  tropes?: string[];
  trigger_warnings?: string[];
  cover_url?: string | null;
  series_id?: string | null;
  series_number?: string | null;
  series_roles?: string[];
  author_ids?: string[];
  adaptations?: string[];
}

export interface UserBook {
  id: string;
  user_id: string;
  book_id: string;
  status: ReadingStatus;
  owned?: boolean;
  bought?: boolean | null;
  medium?: string[];
  format?: string[];
  edition?: string | null;
  specials?: string[];
  price_cents?: number | null;
  acquired_on?: string | null;
  condition?: string | null;
  series_following?: boolean | null;
  series_complete_owned?: boolean | null;
  audio_platforms?: string[];
  narrators?: string[];
  duration_min?: number | null;
  audio_verdict?: string | null;
  adaptation_seen?: boolean;
  current_page?: number | null;
  company?: Company | null;
  verdict?: Verdict | null;
  rating?: number | null;
  expectation?: Expectation | null;
  spice?: number | null;
  burn?: Burn | null;
  notes?: string | null;
  review?: string | null;
  quotes?: string[];
  moods?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface Reading {
  id: string;
  user_book_id: string;
  user_id: string;
  read_number: number;
  started_on?: string | null;
  finished_on?: string | null;
  started_text?: string | null;
  finished_text?: string | null;
  days?: number | null;
  mode?: string | null;
  abandoned?: boolean;
  abandoned_page?: number | null;
  abandoned_percent?: number | null;
  abandoned_reasons?: string[];
  abandoned_final?: boolean | null;
  continue_series?: boolean | null;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  book_id?: string | null;
  title: string;
  author?: string | null;
  isbn?: string | null;
  series_name?: string | null;
  series_number?: string | null;
  series_total?: number | null;
  wanted_format?: string | null;
  release_date?: string | null;
  release_text?: string | null;
  genre?: string | null;
  price_cents?: number | null;
  priority: "niedrig" | "mittel" | "hoch" | "gekauft";
  recommended_by?: string | null;
  owned?: boolean;
  purchase_condition?: string | null;
  note?: string | null;
}

export interface Goal {
  user_id: string;
  year: number;
  books_goal?: number | null;
  sub_goal?: number | null;
  series_goal?: number | null;
}

export interface Profile {
  id: string;
  handle?: string | null;
  display_name: string;
  avatar_url?: string | null;
}

export interface Challenge {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  kind: "liste" | "bingo" | "kaufstopp";
  target?: number | null;
  ends_on?: string | null;
  created_at?: string;
}

export interface ChallengeEntry {
  id: string;
  challenge_id: string;
  label?: string | null;
  book_id?: string | null;
  done?: boolean;
  position?: number | null;
}

export interface Favorite {
  id: string;
  user_id: string;
  kind: "book" | "graphic" | "author" | "series";
  rank: number;
  book_id?: string | null;
  author_id?: string | null;
  series_id?: string | null;
}

/** Alles, was die App für eine Person braucht, in einem Rutsch. */
export interface Library {
  authors: Author[];
  series: Series[];
  books: Book[];
  user_books: UserBook[];
  readings: Reading[];
  wishlist_items: WishlistItem[];
  goals: Goal[];
  challenges: Challenge[];
  challenge_entries: ChallengeEntry[];
  favorites: Favorite[];
}

/** Ein Buch zusammen mit allem, was dazugehört (für die Anzeige). */
export interface Entry {
  book: Book;
  mine: UserBook;
  authors: Author[];
  series?: Series;
  readings: Reading[];
}
