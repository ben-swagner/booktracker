-- Profil (Empfehlungsliste Nr. 14)
-- 1. Platz für das Lieblingszitat
alter table public.profiles add column if not exists quote text;
alter table public.profiles add column if not exists quote_source text;

-- 2. Benutzernamen: nur klein geschrieben, 3 bis 20 Zeichen (a-z, 0-9, Punkt, Unterstrich),
--    und jeden Namen nur einmal, auch wenn jemand Groß- und Kleinschreibung mischt.
update public.profiles set handle = null where handle is not null and handle !~ '^[a-z0-9][a-z0-9._]{2,19}$';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_handle_format') then
    alter table public.profiles add constraint profiles_handle_format check (handle is null or handle ~ '^[a-z0-9][a-z0-9._]{2,19}$');
  end if;
end $$;
create unique index if not exists profiles_handle_lower on public.profiles (lower(handle));

-- 3. Eigenes Profil anlegen dürfen (nur für sehr alte Konten ohne Profilzeile)
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles: eigenes anlegen') then
    create policy "profiles: eigenes anlegen" on public.profiles for insert to authenticated with check (id = auth.uid());
  end if;
end $$;
