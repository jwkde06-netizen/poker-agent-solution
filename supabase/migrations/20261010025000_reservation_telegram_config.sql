-- Store Telegram target using an admin-only setter; allow reservation alerts to read its destination without privileged DB credentials.
create table if not exists public.reservation_telegram_config(
 singleton boolean primary key default true check(singleton),
 chat_id text not null,
 title text not null default '',
 updated_by uuid,
 updated_at timestamptz not null default now()
);
alter table public.reservation_telegram_config enable row level security;
create or replace function public.set_reservation_telegram_target(p_chat_id text,p_title text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if public.current_app_role() <> 'admin' then raise exception 'Admin only'; end if;
 if p_chat_id !~ '^-[0-9]{5,22}$' then raise exception 'Invalid Telegram group ID'; end if;
 insert into public.reservation_telegram_config(singleton,chat_id,title,updated_by,updated_at)
 values(true,p_chat_id,left(coalesce(p_title,''),100),auth.uid(),now())
 on conflict(singleton) do update set chat_id=excluded.chat_id,title=excluded.title,updated_by=auth.uid(),updated_at=now();
 return true;
end $$;
create or replace function public.reservation_telegram_target()
returns text language sql stable security definer set search_path=public as $$
select chat_id from public.reservation_telegram_config where singleton=true;
$$;
revoke all on function public.set_reservation_telegram_target(text,text) from public;
revoke all on function public.reservation_telegram_target() from public;
grant execute on function public.set_reservation_telegram_target(text,text) to authenticated;
grant execute on function public.reservation_telegram_target() to anon,authenticated;
