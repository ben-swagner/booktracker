-- Adaptionen: eigene Meinung je Person und Adaption, dazu Löschen von Adaptionen erlauben
alter table public.user_books
  add column if not exists adaptation_reviews jsonb not null default '{}'::jsonb;

-- Adaptionen sind gemeinsame Buchdaten; angemeldete Personen dürfen falsche Einträge auch wieder entfernen
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'adaptations' and policyname = 'adaptations: löschen') then
    create policy "adaptations: löschen" on public.adaptations for delete to authenticated using (true);
  end if;
end $$;
