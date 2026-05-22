-- Tansiyon Kilo Takibi - Supabase Kurulum SQL
-- Supabase panelinde SQL Editor içine yapıştırıp çalıştırın.
-- Bu yapı GitHub Pages + Google giriş için uygundur.

create table if not exists public.people (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.health_records (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  person_id text not null references public.people(id) on delete cascade,
  type text not null check (type in ('bp', 'weight', 'walk', 'meal')),
  date_time timestamptz not null,
  note text,
  data jsonb not null default '{}',
  created_at timestamptz default now()
);

create index if not exists people_user_id_idx on public.people(user_id);
create index if not exists health_records_user_id_idx on public.health_records(user_id);
create index if not exists health_records_person_id_idx on public.health_records(person_id);
create index if not exists health_records_date_time_idx on public.health_records(date_time desc);

alter table public.people enable row level security;
alter table public.health_records enable row level security;

-- Eski policy varsa temizle
DROP POLICY IF EXISTS "people_select_own" ON public.people;
DROP POLICY IF EXISTS "people_insert_own" ON public.people;
DROP POLICY IF EXISTS "people_update_own" ON public.people;
DROP POLICY IF EXISTS "people_delete_own" ON public.people;
DROP POLICY IF EXISTS "health_records_select_own" ON public.health_records;
DROP POLICY IF EXISTS "health_records_insert_own" ON public.health_records;
DROP POLICY IF EXISTS "health_records_update_own" ON public.health_records;
DROP POLICY IF EXISTS "health_records_delete_own" ON public.health_records;

create policy "people_select_own" on public.people
for select using (auth.uid() = user_id);

create policy "people_insert_own" on public.people
for insert with check (auth.uid() = user_id);

create policy "people_update_own" on public.people
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "people_delete_own" on public.people
for delete using (auth.uid() = user_id);

create policy "health_records_select_own" on public.health_records
for select using (auth.uid() = user_id);

create policy "health_records_insert_own" on public.health_records
for insert with check (auth.uid() = user_id);

create policy "health_records_update_own" on public.health_records
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "health_records_delete_own" on public.health_records
for delete using (auth.uid() = user_id);
