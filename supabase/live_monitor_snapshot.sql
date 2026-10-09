-- Run once in Supabase SQL editor. Monitor data is written by an on-premise bridge.
create table if not exists public.live_monitor_snapshot (
 id integer primary key default 1 check (id=1),
 observed_at timestamptz not null,
 tables jsonb not null default '[]'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.live_monitor_snapshot enable row level security;
drop policy if exists "active staff monitor read" on public.live_monitor_snapshot;
create policy "active staff monitor read" on public.live_monitor_snapshot for select to authenticated
 using (exists(select 1 from public.user_profiles p where p.user_id=auth.uid() and p.active=true and p.role in ('admin','staff')));
-- No insert/update policy: only the on-premise service role may write.
