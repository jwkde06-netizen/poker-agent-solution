-- Each new game has its own independently controlled booking queue.
alter table public.reservation_games add column if not exists game_no text not null default '';
alter table public.reservation_games add column if not exists booking_state text not null default 'open'
  check (booking_state in ('open','closed'));
create index if not exists reservation_games_table_game on public.reservation_games(table_no,game_no,starts_at);
-- Reservation queue opening never starts/closes an accounting session.
create or replace function public.manage_reservation_game(
 p_id uuid,p_title text,p_table_no text,p_game_no text,p_starts_at timestamptz,p_capacity integer,p_open boolean
) returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid; t text; gn text;
begin
 if public.current_app_role() not in ('admin','staff') then raise exception 'Staff access required'; end if;
 t:=btrim(coalesce(p_table_no,'')); gn:=btrim(coalesce(p_game_no,''));
 if t='' or length(t)>12 or gn='' or length(gn)>15 then raise exception 'Table and game number required'; end if;
 if p_capacity not between 1 and 30 then raise exception 'Invalid capacity'; end if;
 if length(btrim(coalesce(p_title,'')))<2 or length(p_title)>100 then raise exception 'Invalid game title'; end if;
 if p_starts_at is null then raise exception 'Estimated start required'; end if;
 -- Serialized per table; allows multiple future queues with distinct game numbers.
 perform pg_advisory_xact_lock(hashtext('reservation-table:'||t));
 if exists(select 1 from public.reservation_games g
 where g.id is distinct from p_id and g.table_no=t and g.game_no=gn and g.starts_at >= now()-interval '36 hours')
 then raise exception 'This table and game number already has a reservation queue'; end if;
 if p_id is null then
  insert into public.reservation_games(title,table_no,game_no,starts_at,capacity,is_open,description,booking_state)
  values(btrim(p_title),t,gn,p_starts_at,p_capacity,p_open,'예상 시작 시간 · 현장 상황에 따라 변경 가능',case when p_open then 'open' else 'closed' end)
  returning id into rid;
 else
  update public.reservation_games set title=btrim(p_title),table_no=t,game_no=gn,
  starts_at=p_starts_at,capacity=p_capacity,is_open=p_open,
  booking_state=case when p_open then 'open' else 'closed' end
  where id=p_id returning id into rid;
  if rid is null then raise exception 'Queue not found'; end if;
  if (select count(*) from public.reservations where game_id=rid and status in ('confirmed','checked_in'))>p_capacity
  then raise exception 'Capacity is less than confirmed bookings'; end if;
 end if;
 return rid;
end $$;
revoke all on function public.manage_reservation_game(uuid,text,text,text,timestamptz,integer,boolean) from public;
grant execute on function public.manage_reservation_game(uuid,text,text,text,timestamptz,integer,boolean) to authenticated;
