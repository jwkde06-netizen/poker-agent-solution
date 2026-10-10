create table if not exists public.reservation_brand_settings (
 id boolean primary key default true check(id=true),
 room_name text not null default 'Dream Poker',
 subtitle text not null default 'DA NANG · RESERVATIONS',
 logo_url text not null default '/dream-poker-logo.svg',
 default_theme text not null default 'dark' check(default_theme in ('dark','light')),
 updated_at timestamptz not null default now()
);
insert into public.reservation_brand_settings(id) values(true) on conflict do nothing;
alter table public.reservation_brand_settings enable row level security;
drop policy if exists "brand public read" on public.reservation_brand_settings;
create policy "brand public read" on public.reservation_brand_settings for select to anon,authenticated using(true);
create or replace function public.update_reservation_brand(p_name text,p_subtitle text,p_logo text,p_theme text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if public.current_app_role() <> 'admin' then raise exception 'Admin only'; end if;
 if length(btrim(coalesce(p_name,''))) not between 2 and 70 then raise exception 'Invalid room name'; end if;
 if length(coalesce(p_subtitle,''))>120 then raise exception 'Subtitle too long'; end if;
 if length(coalesce(p_logo,''))>500 or not (p_logo like 'https://%' or p_logo like '/%') then raise exception 'Logo requires HTTPS URL or local asset path'; end if;
 if p_theme not in ('dark','light') then raise exception 'Invalid theme'; end if;
 insert into public.reservation_brand_settings(id,room_name,subtitle,logo_url,default_theme,updated_at)
 values(true,btrim(p_name),p_subtitle,p_logo,p_theme,now())
 on conflict(id) do update set room_name=excluded.room_name,subtitle=excluded.subtitle,logo_url=excluded.logo_url,default_theme=excluded.default_theme,updated_at=now();
 return true;
end $$;
revoke all on function public.update_reservation_brand(text,text,text,text) from public;
grant execute on function public.update_reservation_brand(text,text,text,text) to authenticated;
