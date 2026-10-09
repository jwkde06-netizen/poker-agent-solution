-- Link reservation games to actual Dream Poker game sessions, never invent live tables.
alter table public.reservation_games add column if not exists session_id uuid;
alter table public.reservation_games add column if not exists schedule_kind text not null default 'manual'
check(schedule_kind in ('manual','live'));
create unique index if not exists reservation_games_session_unique on public.reservation_games(session_id) where session_id is not null;
create or replace function public.sync_live_reservation_games()
returns integer language plpgsql security definer set search_path=public as $$
declare n integer:=0;
begin
 if public.current_app_role() not in ('admin','staff') then raise exception 'Staff authorization required'; end if;
 -- Link active 5M sessions to their real table and operating-day records.
 insert into public.reservation_games(title,starts_at,capacity,is_open,table_no,description,session_id,schedule_kind)
 select '5M TIME ATTACK · No.'||coalesce(s.game_no,'1'),
 greatest(now(),(s.played_on::timestamp + interval '14 hours') at time zone 'Asia/Ho_Chi_Minh'),
 9,true,s.table_no,'현재 진행 중 · 다음 게임 예약은 캐셔 확인 후 확정',s.id,'live'
 from public.game_sessions s
 where s.status='active' and upper(s.game_name) like '5M%'
 and s.played_on >= (now() at time zone 'Asia/Ho_Chi_Minh')::date - 1
 on conflict (session_id) where session_id is not null do update
 set table_no=excluded.table_no,title=excluded.title;
 get diagnostics n=row_count;
 update public.reservation_games g set is_open=false
 where g.schedule_kind='live' and g.session_id is not null
 and not exists (select 1 from public.game_sessions s where s.id=g.session_id and s.status='active');
 return n;
end $$;
revoke all on function public.sync_live_reservation_games() from public;
grant execute on function public.sync_live_reservation_games() to authenticated;
-- Read-only status summaries are based on real session state, not a fabricated schedule.
create or replace function public.reservation_live_room_status()
returns table(running_5m bigint,running_tables text[])
language sql stable security definer set search_path=public as $$
select count(*)::bigint,coalesce(array_agg(s.table_no order by s.table_no),array[]::text[])
from public.game_sessions s
where s.status='active' and upper(s.game_name) like '5M%'
and s.played_on >= (now() at time zone 'Asia/Ho_Chi_Minh')::date - 1;
$$;
revoke all on function public.reservation_live_room_status() from public;
grant execute on function public.reservation_live_room_status() to anon,authenticated;
