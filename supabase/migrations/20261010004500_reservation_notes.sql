-- Reservation notes, no exposure of guest notes in public stats.
alter table public.reservations add column if not exists guest_note text not null default '';
create or replace function public.request_poker_reservation(p_game uuid,p_name text,p_arrival timestamptz,p_note text default '')
returns table(reservation_id uuid, reservation_token uuid) language plpgsql security definer set search_path=public as $$
declare g public.reservation_games%rowtype; n text; inserted public.reservations%rowtype;
begin
 select * into g from public.reservation_games where id=p_game and is_open for update;
 if not found or g.starts_at<now()-interval '12 hours' then raise exception '예약 접수가 종료된 게임입니다.'; end if;
 n=trim(coalesce(p_name,''));
 if char_length(n)<2 or char_length(n)>80 then raise exception '이름은 2~80자로 입력해주세요.'; end if;
 if p_arrival is null or p_arrival<now()-interval '2 hours' or p_arrival>g.starts_at+interval '18 hours' then raise exception '도착 시간이 올바르지 않습니다.'; end if;
 if exists(select 1 from public.reservations where game_id=p_game and lower(player_name)=lower(n)
 and status in ('pending','confirmed','waitlisted','checked_in')) then raise exception '해당 게임에 같은 이름의 예약이 이미 있습니다.'; end if;
 insert into public.reservations(game_id,player_name,arrival_at,guest_note)
 values(p_game,n,p_arrival,left(btrim(coalesce(p_note,'')),500)) returning * into inserted;
 insert into public.reservation_audit(reservation_id,new_status) values(inserted.id,'pending');
 return query select inserted.id,inserted.lookup_token;
end $$;
revoke all on function public.request_poker_reservation(uuid,text,timestamptz,text) from public;
grant execute on function public.request_poker_reservation(uuid,text,timestamptz,text) to anon,authenticated;
create or replace function public.desk_request_poker_reservation(p_game uuid,p_name text,p_arrival timestamptz,p_note text default '')
returns uuid language plpgsql security definer set search_path=public as $$
declare g public.reservation_games%rowtype; n text; rid uuid;
begin
 if public.current_app_role() not in ('admin','staff') then raise exception 'Staff login required'; end if;
 select * into g from public.reservation_games where id=p_game and is_open for update;
 if not found then raise exception 'Reservations are closed'; end if;
 n:=trim(coalesce(p_name,''));
 if length(n)<2 or length(n)>80 then raise exception 'Player name must be 2-80 characters'; end if;
 if p_arrival is null then raise exception 'Arrival time required'; end if;
 if exists(select 1 from public.reservations where game_id=p_game and lower(player_name)=lower(n) and status in ('pending','confirmed','waitlisted','checked_in')) then raise exception 'An active reservation already exists for this player'; end if;
 insert into public.reservations(game_id,player_name,arrival_at,note,guest_note)
 values(p_game,n,p_arrival,'[DESK]',left(btrim(coalesce(p_note,'')),500)) returning id into rid;
 insert into public.reservation_audit(reservation_id,new_status,actor) values(rid,'pending',auth.uid());
 return rid;
end $$;
revoke all on function public.desk_request_poker_reservation(uuid,text,timestamptz,text) from public;
grant execute on function public.desk_request_poker_reservation(uuid,text,timestamptz,text) to authenticated;
create or replace function public.request_member_poker_reservation(p_game uuid,p_arrival timestamptz,p_note text default '')
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
 if exists(select 1 from public.reservations where game_id=p_game and status in ('pending','confirmed','waitlisted','checked_in')
 and (member_user_id=auth.uid() or (member_number=p.member_number and lower(player_name)=lower(p.member_name)))) then raise exception '이미 해당 게임에 활성 예약이 있습니다.'; end if;
 insert into public.reservations(game_id,player_name,arrival_at,member_number,member_user_id,guest_note)
 values(p_game,p.member_name,p_arrival,p.member_number,auth.uid(),left(btrim(coalesce(p_note,'')),500)) returning * into inserted;
 insert into public.reservation_audit(reservation_id,new_status) values(inserted.id,'pending');
 return query select inserted.id,inserted.lookup_token;
end $$;
revoke all on function public.request_member_poker_reservation(uuid,timestamptz,text) from public;
grant execute on function public.request_member_poker_reservation(uuid,timestamptz,text) to authenticated;
