-- One shared operating day for all logged-in Dream Poker devices.
create table if not exists public.poker_operating_day(
 id integer primary key check(id=1),
 business_date date not null,
 updated_at timestamptz not null default now(),
 closed_by uuid
);
insert into public.poker_operating_day(id,business_date)
select 1,coalesce((select max(played_on) from public.game_sessions),((now() at time zone 'Asia/Ho_Chi_Minh')::date))
on conflict(id) do nothing;
alter table public.poker_operating_day enable row level security;
create policy "ops day read" on public.poker_operating_day for select to authenticated
 using(public.current_app_role() in ('admin','staff'));
-- Atomic end-of-day transition, only when every game has been closed.
create or replace function public.close_poker_operating_day()
returns date language plpgsql security definer set search_path=public as $$
declare old_date date; new_date date;
begin
 if public.current_app_role()<>'admin' then raise exception '관리자만 영업 마감할 수 있습니다.'; end if;
 select business_date into old_date from public.poker_operating_day where id=1 for update;
 if old_date is null then raise exception '영업일 설정을 찾을 수 없습니다.'; end if;
 if exists(select 1 from public.game_sessions where status='active') then
   raise exception '진행 중인 게임을 모두 종료한 후 영업 마감해주세요.';
 end if;
 new_date:=old_date+1;
 update public.poker_operating_day set business_date=new_date,updated_at=now(),closed_by=auth.uid() where id=1;
 return new_date;
end $$;
revoke all on function public.close_poker_operating_day() from public;
grant execute on function public.close_poker_operating_day() to authenticated;
