create extension if not exists pgcrypto;

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  rate numeric(5,2) not null default 0 check (rate >= 0 and rate <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  card_no text,
  agency_id uuid not null references public.agencies(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_entries (
  id uuid primary key default gen_random_uuid(),
  played_on date not null,
  game_name text not null,
  player_id uuid not null references public.players(id),
  buy_in numeric(14,2) not null default 0,
  rake numeric(14,2) not null default 0,
  agency_id uuid not null references public.agencies(id),
  agency_code_snapshot text not null,
  rate_snapshot numeric(5,2) not null,
  rakeback numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_players_agency_id
  on public.players(agency_id);

create index if not exists idx_game_entries_played_on
  on public.game_entries(played_on);

create index if not exists idx_game_entries_player_id
  on public.game_entries(player_id);

create index if not exists idx_game_entries_agency_id
  on public.game_entries(agency_id);

alter table public.agencies enable row level security;
alter table public.players enable row level security;
alter table public.game_entries enable row level security;

drop policy if exists "authenticated agencies all" on public.agencies;
create policy "authenticated agencies all"
  on public.agencies for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated players all" on public.players;
create policy "authenticated players all"
  on public.players for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated game entries all" on public.game_entries;
create policy "authenticated game entries all"
  on public.game_entries for all
  to authenticated
  using (true)
  with check (true);

insert into public.agencies (code, rate, active)
values
  ('KOREA', 0, true),
  ('MONGOL', 30, true),
  ('JAPAN', 35, true),
  ('CHINA (AK)', 40, true),
  ('HOUSE', 50, true),
  ('KOREA2', 25, true)
on conflict (code) do nothing;
