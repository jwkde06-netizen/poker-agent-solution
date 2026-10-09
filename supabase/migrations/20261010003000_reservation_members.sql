-- Optional player account: independently authenticated via Supabase email OTP.
-- Member numbers entered by players are unverified identifiers, not proof of membership.
create table if not exists public.reservation_member_profiles(
 user_id uuid primary key references auth.users(id) on delete cascade,
 member_name text not null check(length(btrim(member_name)) between 2 and 80),
 member_number text not null check(length(btrim(member_number)) between 2 and 40),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.reservation_member_profiles enable row level security;
drop policy if exists "member profile own read" on public.reservation_member_profiles;
create policy "member profile own read" on public.reservation_member_profiles for select to authenticated using(user_id=auth.uid());
drop policy if exists "member profile own insert" on public.reservation_member_profiles;
create policy "member profile own insert" on public.reservation_member_profiles for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "member profile own update" on public.reservation_member_profiles;
create policy "member profile own update" on public.reservation_member_profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.reservations add column if not exists member_number text;
alter table public.reservations add column if not exists member_user_id uuid references auth.users(id) on delete set null;
create index if not exists reservations_member_user on public.reservations(member_user_id);
create or replace function public.request_member_poker_reservation(p_game uuid,p_arrival timestamptz)
returns table(reservation_id uuid,reservation_token uuid)
language plpgsql security definer set search_path=public as $$
declare g public.reservation_games%rowtype; p public.reservation_member_profiles%rowtype; inserted public.reservations%rowtype;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
 select * into p from public.reservation_member_profiles where user_id=auth.uid();
 if not found then raise exception '회원 이름과 번호를 먼저 등록해주세요.'; end if;
 select * into g from public.reservation_games where id=p_game and is_open for update;
 if not found or g.starts_at<now()-interval '12 hours' then raise exception '예약 접수가 종료되었습니다.'; end if;
 if p_arrival is null or p_arrival<now()-interval '2 hours' or p_arrival>g.starts_at+interval '18 hours' then raise exception '도착 시간이 올바르지 않습니다.'; end if;
 if exists (select 1 from public.reservations where game_id=p_game and status in ('pending','confirmed','waitlisted','checked_in')
 and (member_user_id=auth.uid() or (member_number=p.member_number and lower(player_name)=lower(p.member_name)))) then
 raise exception '이미 해당 게임에 활성 예약이 있습니다.';
 end if;
 insert into public.reservations(game_id,player_name,arrival_at,member_number,member_user_id)
 values(p_game,p.member_name,p_arrival,p.member_number,auth.uid()) returning * into inserted;
 insert into public.reservation_audit(reservation_id,new_status) values(inserted.id,'pending');
 return query select inserted.id,inserted.lookup_token;
end $$;
revoke all on function public.request_member_poker_reservation(uuid,timestamptz) from public;
grant execute on function public.request_member_poker_reservation(uuid,timestamptz) to authenticated;
-- Staff can read number snapshots attached to their own authorized reservation access.
