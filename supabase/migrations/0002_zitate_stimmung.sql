-- Lieblingszitate und Stimmung je Buch (persönlich, gehört zur Person)
alter table public.user_books
  add column if not exists quotes text[] not null default '{}',
  add column if not exists moods  text[] not null default '{}';
