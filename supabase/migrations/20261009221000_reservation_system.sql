-- Dream Poker reservation service; shared with the standalone booking webapp.
create extension if not exists pgcrypto;
create table if not exists public.reservation_games (
 id uuid primary key default gen_random_uuid(), title text not null,
 starts_at timestamptz not null, capacity integer not null default 9 check(capacity between 1 and 30),
 is_open boolean not null default true, table_no text not null default '',
 description text not null default '', created_at timestamptz not null default now()
);
create index if not exists reservation_games_schedule on public.reservation_games(starts_at);
create table if not exists public.reservations (
 id uuid primary key default gen_random_uuid(),
 game_id uuid not null references public.reservation_games(id),
 player_name text not null check(char_length(player_name) between 2 and 80),
 arrival_at timestamptz not null,
 lookup_token uuid not null unique default gen_random_uuid(),
 status text not null default 'pending' check(status in ('pending','confirmed','waitlisted','rejected','cancelled','checked_in','no_show')),
 note text not null default '',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid, reviewed_at timestamptz
);
create index if not exists reservations_game_status on public.reservations(game_id,status,created_at);
create table if not exists public.reservation_audit (
 id bigint generated always as identity primary key, reservation_id uuid not null references public.reservations(id),
 previous_status text, new_status text not null, actor uuid, created_at timestamptz not null default now()
);
alter table public.reservation_games enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_audit enable row level security;
drop policy if exists "reservation games public read" on public.reservation_games;
create policy "reservation games public read" on public.reservation_games for select to anon,authenticated using (true);
drop policy if exists "reservation games admin write" on public.reservation_games;
create policy "reservation games admin write" on public.reservation_games for all to authenticated using(public.current_app_role()='admin') with check(public.current_app_role()='admin');
drop policy if exists "reservation cashier read" on public.reservations;
create policy "reservation cashier read" on public.reservations for select to authenticated using(public.current_app_role() in ('admin','staff'));
drop policy if exists "reservation audit manager read" on public.reservation_audit;
create policy "reservation audit manager read" on public.reservation_audit for select to authenticated using(public.current_app_role() in ('admin','staff'));
create or replace function public.reservation_public_stats()
returns table(game_id uuid, confirmed_count bigint, pending_count bigint, waiting_count bigint)
language sql stable security definer set search_path=public as $$
 select g.id,
 (select count(*) from public.reservations r where r.game_id=g.id and r.status in ('confirmed','checked_in')),
 (select count(*) from public.reservations r where r.game_id=g.id and r.status='pending'),
 (select count(*) from public.reservations r where r.game_id=g.id and r.status='waitlisted')
 from public.reservation_games g where g.is_open and g.starts_at>now()-interval '12 hours';
$$;
create or replace function public.request_poker_reservation(p_game uuid,p_name text,p_arrival timestamptz)
returns table(reservation_id uuid, reservation_token uuid) language plpgsql security definer set search_path=public as $$
declare g public.reservation_games%rowtype; n text; inserted public.reservations%rowtype;
begin
 select * into g from public.reservation_games where id=p_game and is_open for update;
 if not found or g.starts_at<now()-interval '12 hours' then raise exception '예약 접수가 종료된 게임입니다.'; end if;
 n=trim(coalesce(p_name,''));
 if char_length(n)<2 or char_length(n)>80 then raise exception '이름은 2~80자로 입력해주세요.'; end if;
 if p_arrival is null or p_arrival<now()-interval '2 hours' or p_arrival>g.starts_at+interval '18 hours' then raise exception '도착 시간이 올바르지 않습니다.'; end if;
 -- Small per-name/game throttle. Public requests always require cashier approval.
 if exists(select 1 from public.reservations where game_id=p_game and lower(player_name)=lower(n)
 and status in ('pending','confirmed','waitlisted','checked_in')) then
 raise exception '해당 게임에 같은 이름의 예약이 이미 있습니다.';
 end if;
 insert into public.reservations(game_id,player_name,arrival_at) values(p_game,n,p_arrival) returning * into inserted;
 insert into public.reservation_audit(reservation_id,new_status) values(inserted.id,'pending');
 return query select inserted.id,inserted.lookup_token;
end $$;
create or replace function public.lookup_poker_reservation(p_token uuid)
returns table(reservation_id uuid,game_id uuid,game_title text,player_name text,arrival_at timestamptz,status text,created_at timestamptz)
language sql stable security definer set search_path=public as $$
 select r.id,r.game_id,g.title,r.player_name,r.arrival_at,r.status,r.created_at
 from public.reservations r join public.reservation_games g on g.id=r.game_id where r.lookup_token=p_token;
$$;
create or replace function public.cancel_poker_reservation(p_token uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare rid uuid; old text;
begin
 select id,status into rid,old from public.reservations where lookup_token=p_token for update;
 if rid is null or old not in ('pending','confirmed','waitlisted') then return false; end if;
 update public.reservations set status='cancelled',updated_at=now() where id=rid;
 insert into public.reservation_audit(reservation_id,previous_status,new_status) values(rid,old,'cancelled');
 return true;
end $$;
create or replace function public.manage_poker_reservation(p_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.reservations%rowtype; g public.reservation_games%rowtype; occupied bigint;
begin
 if public.current_app_role() not in ('admin','staff') then raise exception '직원 권한이 필요합니다.'; end if;
 if p_status not in ('confirmed','waitlisted','rejected','cancelled','checked_in','no_show') then raise exception '잘못된 상태입니다.'; end if;
 select * into r from public.reservations where id=p_id for update;
 if not found then return false; end if;
 select * into g from public.reservation_games where id=r.game_id for update;
 if p_status in ('confirmed','checked_in') then
 select count(*) into occupied from public.reservations where game_id=g.id and id<>p_id and status in ('confirmed','checked_in');
 if occupied>=g.capacity then raise exception '예약 가능한 좌석이 없습니다. 대기로 전환해주세요.'; end if;
 end if;
 update public.reservations set status=p_status,updated_at=now(),reviewed_at=now(),reviewed_by=auth.uid() where id=p_id;
 insert into public.reservation_audit(reservation_id,previous_status,new_status,actor) values(p_id,r.status,p_status,auth.uid());
 return true;
end $$;
revoke all on function public.request_poker_reservation(uuid,text,timestamptz) from public;
revoke all on function public.lookup_poker_reservation(uuid) from public;
revoke all on function public.cancel_poker_reservation(uuid) from public;
revoke all on function public.reservation_public_stats() from public;
revoke all on function public.manage_poker_reservation(uuid,text) from public;
grant execute on function public.request_poker_reservation(uuid,text,timestamptz),public.lookup_poker_reservation(uuid),public.cancel_poker_reservation(uuid),public.reservation_public_stats() to anon,authenticated;
grant execute on function public.manage_poker_reservation(uuid,text) to authenticated;
