-- Buddy Reads: pro Lesevorgang festhalten, ob allein, zu zweit oder in einer Gruppe gelesen wurde, und mit wem
alter table public.readings add column if not exists company company_kind;
alter table public.readings add column if not exists partners text;
-- Bisherige Angabe am Buch für den ersten Lesevorgang übernehmen
update public.readings r set company = ub.company
  from public.user_books ub
  where r.user_book_id = ub.id and r.company is null and ub.company is not null and r.read_number = 1;
