-- Booktracker: Datenmodell, Version 1
-- Zwei Schichten:
--   1. Gemeinsame Buchdaten (authors, series, books): für alle Nutzer:innen gleich.
--   2. Persönliche Daten (user_books, readings, wishlist_items, ...): gehören einer Person.

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Aufzählungen (feste Wertelisten)
-- ---------------------------------------------------------------------------
create type reading_status as enum ('lese', 'tbr', 'ungelesen', 'gelesen', 'abgebrochen', 'wunschliste');
-- lese = Current Read, tbr = SuB (gekauft, bewusst als nächstes), ungelesen = im Regal, aber nicht auf dem SuB
create type book_kind as enum ('Buch', 'Manga', 'Manhwa', 'Kurzgeschichte', 'Graphic Novel', 'Kinderbuch', 'Bildband', 'Comic', 'Magazin', 'Sonstiges');
create type book_category as enum ('Fiction', 'Non-Fiction', 'Fanfiction', 'Lyrik');
create type audience_kind as enum ('Child', 'Teen', 'YA', 'NA', 'Adult');
create type time_period as enum ('Gegenwart', 'Vergangenheit', 'Zukunft', 'Unbestimmt');
create type author_gender as enum ('weiblich', 'maennlich', 'divers', 'mehrere', 'unbekannt');
create type verdict_kind as enum ('love', 'like', 'middle', 'dislike', 'hate', 'idk');
create type expectation_kind as enum ('uebertroffen', 'erfuellt', 'untertroffen');
create type burn_kind as enum ('no', 'slow', 'fast');
create type read_mode as enum ('print', 'ebook', 'audio');
create type company_kind as enum ('solo', 'buddy', 'group');
create type sale_status as enum ('geplant', 'eingestellt', 'verkauft', 'verworfen');
create type wish_priority as enum ('niedrig', 'mittel', 'hoch', 'gekauft');
create type friend_status as enum ('angefragt', 'angenommen', 'blockiert');

-- ---------------------------------------------------------------------------
-- Profile (ein Eintrag pro Konto)
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique,
  display_name text not null default '',
  avatar_url text,
  bio text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Neues Konto -> automatisch ein Profil
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Schicht 1: gemeinsame Buchdaten
-- ---------------------------------------------------------------------------
create table authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_name text,
  slug text not null unique,
  country text,
  gender author_gender not null default 'unbekannt',
  photo_url text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table series (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  total_count integer,             -- geplante/bekannte Anzahl Bände
  is_complete boolean,             -- Reihe abgeschlossen (vom Verlag)
  kind text,                       -- 'Fortlaufende Reihe' | 'Unabhängige Reihe'
  parent_series_id uuid references series (id) on delete set null, -- Spin-Off von
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  original_title text,
  isbn13 text unique,
  isbn10 text,
  blurb text,
  first_published text,            -- Jahr oder Datum als Text, wie im Sheet
  publisher text,
  language text[] not null default '{}',   -- z. B. {Deutsch} oder {Deutsch,Englisch}
  pages integer,
  chapters integer,
  kind book_kind not null default 'Buch',
  category book_category[] not null default '{Fiction}',
  genre text,
  subgenres text[] not null default '{}',
  audience audience_kind,
  period time_period,
  setting text,
  pov text[] not null default '{}',
  main_characters text[] not null default '{}',
  tropes text[] not null default '{}',
  trigger_warnings text[] not null default '{}',
  cover_url text,
  series_id uuid references series (id) on delete set null,
  series_number text,              -- "1", "2.5", "1-3"
  series_roles text[] not null default '{}',   -- Spin Off, Prequel, Sequel, Midquel, Novella
  metadata_source text,            -- 'sheet' | 'openlibrary' | 'googlebooks' | 'dnb' | 'manuell'
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index books_title_trgm on books using gin (title gin_trgm_ops);
create index books_series_idx on books (series_id);

create table book_authors (
  book_id uuid references books (id) on delete cascade,
  author_id uuid references authors (id) on delete cascade,
  position smallint not null default 1,
  primary key (book_id, author_id)
);

create table adaptations (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books (id) on delete cascade,
  kind text not null,              -- Film, Serie, Anime, Game, Musical/Theater
  title text,
  year integer
);

-- ---------------------------------------------------------------------------
-- Schicht 2: persönliche Daten
-- ---------------------------------------------------------------------------
create table user_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  book_id uuid not null references books (id) on delete cascade,
  status reading_status not null default 'ungelesen',
  -- Meine Ausgabe
  owned boolean not null default true,
  bought boolean,
  medium text[] not null default '{}',        -- Print, Digital, Audiobook
  format text[] not null default '{}',        -- Hardcover, Taschenbuch, Paperback, eBook
  edition text,                               -- Normal, Box, Limited, ...
  specials text[] not null default '{}',      -- Map, Sprayed Edges, Playlist, ...
  price_cents integer,
  acquired_on date,
  condition text,
  -- Reihe aus meiner Sicht
  series_following boolean,                   -- Folgebände im Besitz
  series_complete_owned boolean,              -- Reihe vollständig im Besitz
  -- Audio
  audio_platforms text[] not null default '{}',
  narrators text[] not null default '{}',
  duration_min integer,
  audio_verdict text,                         -- 👍🏻 👌🏻 👎🏻
  -- Adaption
  adaptation_seen boolean not null default false,
  -- Lesen und Bewertung (Zusammenfassung; Details in readings)
  current_page integer,
  company company_kind,
  verdict verdict_kind,
  rating numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  expectation expectation_kind,
  spice smallint check (spice is null or (spice >= 0 and spice <= 5)),  -- 0 = 🥛
  burn burn_kind,
  feelings text[] not null default '{}',
  notes text,
  review text,
  quotes text,
  favorite_characters text[] not null default '{}',
  book_crush text[] not null default '{}',
  discovered_via text[] not null default '{}',
  from_wishlist boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);
create index user_books_user_status on user_books (user_id, status);

-- Jeder Lesevorgang: Erstlesung, Rereads und Abbrüche
create table readings (
  id uuid primary key default gen_random_uuid(),
  user_book_id uuid not null references user_books (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  read_number smallint not null default 1,
  started_on date,
  finished_on date,
  started_text text,                          -- nur Jahr bekannt ("2019")
  finished_text text,
  days integer,
  mode read_mode,
  abandoned boolean not null default false,
  abandoned_page integer,
  abandoned_percent smallint,
  abandoned_reasons text[] not null default '{}',
  abandoned_final boolean,                    -- "Endgültig" vs "Unschlüssig"
  continue_series boolean,
  created_at timestamptz not null default now()
);
create index readings_user_finished on readings (user_id, finished_on);

create table wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  book_id uuid references books (id) on delete set null,
  title text not null,
  author text,
  isbn text,
  series_name text,
  series_number text,
  series_total integer,
  wanted_format text,
  release_date date,
  release_text text,
  genre text,
  price_cents integer,
  priority wish_priority not null default 'mittel',
  recommended_by text,
  owned boolean not null default false,
  purchase_condition text,                    -- Neu, Gebraucht
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  book_id uuid references books (id) on delete set null,
  title text not null,
  author text,
  isbn text,
  reason text,
  status sale_status not null default 'geplant',
  platform text,
  price_cents integer,
  sold_on date,
  created_at timestamptz not null default now()
);

create table goals (
  user_id uuid not null references profiles (id) on delete cascade,
  year integer not null,
  books_goal integer,
  sub_goal integer,
  series_goal integer,
  min_per_page numeric(4,2),
  primary key (user_id, year)
);

create table challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  description text,
  kind text not null default 'liste',         -- liste | bingo
  target integer,
  ends_on date,
  created_at timestamptz not null default now()
);

create table challenge_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges (id) on delete cascade,
  label text,                                 -- Bingo-Feld, z. B. "Männlicher Autor"
  book_id uuid references books (id) on delete set null,
  done boolean not null default false,
  position smallint
);

create table favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  kind text not null,                         -- book | graphic | author | series
  rank smallint not null,
  book_id uuid references books (id) on delete cascade,
  author_id uuid references authors (id) on delete cascade,
  series_id uuid references series (id) on delete cascade,
  unique (user_id, kind, rank)
);

-- Freundschaften und Freigaben
create table friendships (
  requester_id uuid not null references profiles (id) on delete cascade,
  addressee_id uuid not null references profiles (id) on delete cascade,
  status friend_status not null default 'angefragt',
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id)
);

create table share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  kind text not null,                         -- regal | wunschliste | lesejahr
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at automatisch pflegen
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
do $$ declare t text;
begin
  foreach t in array array['profiles','authors','series','books','user_books','wishlist_items']
  loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Zugriffsrechte (Row Level Security)
-- ---------------------------------------------------------------------------
create or replace function are_friends(a uuid, b uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from friendships
    where status = 'angenommen'
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$;

alter table profiles enable row level security;
create policy "profiles: alle angemeldeten lesen" on profiles for select to authenticated using (true);
create policy "profiles: eigenes bearbeiten" on profiles for update to authenticated using (id = auth.uid());

-- Gemeinsame Buchdaten: alle Angemeldeten lesen und ergänzen
alter table authors enable row level security;
alter table series enable row level security;
alter table books enable row level security;
alter table book_authors enable row level security;
alter table adaptations enable row level security;
do $$ declare t text;
begin
  foreach t in array array['authors','series','books','book_authors','adaptations']
  loop
    execute format('create policy "%1$s: lesen" on %1$I for select to authenticated using (true)', t);
    execute format('create policy "%1$s: anlegen" on %1$I for insert to authenticated with check (true)', t);
    execute format('create policy "%1$s: bearbeiten" on %1$I for update to authenticated using (true)', t);
  end loop;
end $$;

-- Persönliche Daten: nur die Person selbst; Freund:innen dürfen lesen
do $$ declare t text;
begin
  foreach t in array array['user_books','readings','wishlist_items','sales','goals','challenges','favorites','share_links']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "%1$s: eigene" on %1$I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "%1$s: freunde lesen" on %1$I for select to authenticated using (are_friends(auth.uid(), user_id))', t);
  end loop;
end $$;

alter table challenge_entries enable row level security;
create policy "challenge_entries: eigene" on challenge_entries for all to authenticated
  using (exists (select 1 from challenges c where c.id = challenge_id and c.user_id = auth.uid()))
  with check (exists (select 1 from challenges c where c.id = challenge_id and c.user_id = auth.uid()));

alter table friendships enable row level security;
create policy "friendships: beteiligte" on friendships for all to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());
