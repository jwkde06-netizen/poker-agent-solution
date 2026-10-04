create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  played_on date not null default current_date,
  table_no text not null,
  game_name text not null,
  status text not null default 'active' check (status in ('active','closed')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

alter table public.game_entries
  add column if not exists session_id uuid references public.game_sessions(id) on delete set null;

create index if not exists idx_game_sessions_active
  on public.game_sessions(status, played_on desc);

create index if not exists idx_game_entries_session_id
  on public.game_entries(session_id);

alter table public.game_sessions enable row level security;

drop policy if exists "authenticated game sessions all" on public.game_sessions;
create policy "authenticated game sessions all"
  on public.game_sessions for all
  to authenticated
  using (true)
  with check (true);
