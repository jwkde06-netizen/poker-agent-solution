-- Failed Telegram sends can be retried while successful sends remain deduplicated.
create or replace function public.claim_poker_telegram_notification(p_token uuid)
returns table(reservation_id uuid,game_title text,table_no text,game_no text,player_name text,member_number text,arrival_at timestamptz,guest_note text)
language plpgsql security definer set search_path=public as $$
declare found public.reservations%rowtype;
begin
 select * into found from public.reservations where lookup_token=p_token
 and status='pending' and created_at>now()-interval '2 hours' for update;
 if not found or (found.telegram_notification_claimed_at is not null
 and found.telegram_notification_claimed_at>now()-interval '90 seconds') then return; end if;
 update public.reservations set telegram_notification_claimed_at=now() where id=found.id;
 return query select found.id,g.title,g.table_no,g.game_no,found.player_name,found.member_number,found.arrival_at,found.guest_note
 from public.reservation_games g where g.id=found.game_id;
end $$;
-- Explicit success receipt prevents replay after a completed Telegram delivery.
alter table public.reservations add column if not exists telegram_notified_at timestamptz;
create or replace function public.claim_poker_telegram_notification(p_token uuid)
returns table(reservation_id uuid,game_title text,table_no text,game_no text,player_name text,member_number text,arrival_at timestamptz,guest_note text)
language plpgsql security definer set search_path=public as $$
declare found public.reservations%rowtype;
begin
 select * into found from public.reservations where lookup_token=p_token
 and status='pending' and created_at>now()-interval '2 hours' for update;
 if not found or found.telegram_notified_at is not null
 or (found.telegram_notification_claimed_at is not null and found.telegram_notification_claimed_at>now()-interval '90 seconds') then return; end if;
 update public.reservations set telegram_notification_claimed_at=now() where id=found.id;
 return query select found.id,g.title,g.table_no,g.game_no,found.player_name,found.member_number,found.arrival_at,found.guest_note
 from public.reservation_games g where g.id=found.game_id;
end $$;
create or replace function public.confirm_poker_telegram_notification(p_token uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update public.reservations set telegram_notified_at=now()
 where lookup_token=p_token and telegram_notification_claimed_at is not null
 and telegram_notified_at is null;
 return found;
end $$;
revoke all on function public.confirm_poker_telegram_notification(uuid) from public;
grant execute on function public.confirm_poker_telegram_notification(uuid) to anon,authenticated;
