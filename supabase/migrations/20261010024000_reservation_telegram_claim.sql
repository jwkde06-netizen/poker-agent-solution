-- Atomic single-delivery claim for Telegram booking notifications.
alter table public.reservations add column if not exists telegram_notification_claimed_at timestamptz;
create or replace function public.claim_poker_telegram_notification(p_token uuid)
returns table(reservation_id uuid,game_title text,table_no text,game_no text,player_name text,member_number text,arrival_at timestamptz,guest_note text)
language plpgsql security definer set search_path=public as $$
declare found public.reservations%rowtype;
begin
 select * into found from public.reservations
 where lookup_token=p_token and status='pending' and created_at>now()-interval '30 minutes'
 for update;
 if not found or found.telegram_notification_claimed_at is not null then return; end if;
 update public.reservations set telegram_notification_claimed_at=now() where id=found.id;
 return query select found.id,g.title,g.table_no,g.game_no,found.player_name,found.member_number,found.arrival_at,found.guest_note
 from public.reservation_games g where g.id=found.game_id;
end $$;
revoke all on function public.claim_poker_telegram_notification(uuid) from public;
grant execute on function public.claim_poker_telegram_notification(uuid) to anon,authenticated;
