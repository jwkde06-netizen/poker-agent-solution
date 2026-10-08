-- Apply in Supabase SQL editor BEFORE deploying the matching UI.
-- Business day changes only when an administrator closes the venue shift.
create table if not exists public.operating_state (
  id integer primary key check(id=1),
  business_date date not null,
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.operating_state(id,business_date)
select 1, coalesce(
  (select min(played_on) from public.game_sessions where status='active'),
  (select max(played_on) from public.game_sessions),
  (now() at time zone 'Asia/Ho_Chi_Minh')::date
)
on conflict (id) do nothing;
alter table public.operating_state enable row level security;
drop policy if exists "operating_state_read" on public.operating_state;
create policy "operating_state_read" on public.operating_state for select to authenticated using(true);
-- No direct write policy: only the authenticated admin can execute the RPC.
create or replace function public.close_operating_business_day()
returns date language plpgsql security definer set search_path = public as $$
declare
  result_date date;
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_profiles where user_id=auth.uid() and role='admin'
  ) then
    raise exception 'Admin permissions required';
  end if;
  perform 1 from public.operating_state where id=1 for update;
  if exists(select 1 from public.game_sessions where status='active') then
    raise exception 'Finish all running games before closing the business day';
  end if;
  update public.operating_state
  set business_date=business_date+1,
      closed_at=now(), updated_at=now()
  where id=1 returning business_date into result_date;
  if result_date is null then raise exception 'Business day is not initialized'; end if;
  return result_date;
end $$;
revoke all on function public.close_operating_business_day() from public;
grant execute on function public.close_operating_business_day() to authenticated;

-- Lock the same row when starting a game, making the business date and
-- one-active-game-per-table check atomic against concurrent venue close.
create or replace function public.start_operating_game(
  p_table_no text,
  p_game_name text,
  p_game_no text default null
)
returns public.game_sessions
language plpgsql security definer set search_path = public as $$
declare
  shift_date date;
  new_game public.game_sessions;
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_profiles
    where user_id=auth.uid() and role in ('admin','staff')
  ) then
    raise exception 'Game operation permissions required';
  end if;
  if nullif(btrim(p_table_no),'') is null then
    raise exception 'Table number is required';
  end if;
  select business_date into shift_date from public.operating_state where id=1 for update;
  if shift_date is null then raise exception 'Business day is not initialized'; end if;
  if exists(
    select 1 from public.game_sessions
    where status='active' and btrim(table_no)=btrim(p_table_no)
  ) then raise exception 'A game is already running at this table'; end if;
  insert into public.game_sessions(played_on,table_no,game_no,game_name,status)
  values (shift_date,btrim(p_table_no),nullif(btrim(p_game_no),''),p_game_name,'active')
  returning * into new_game;
  return new_game;
end $$;
revoke all on function public.start_operating_game(text,text,text) from public;
grant execute on function public.start_operating_game(text,text,text) to authenticated;
