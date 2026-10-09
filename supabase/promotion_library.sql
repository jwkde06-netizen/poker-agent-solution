-- Dream Poker promotion library: run in Supabase SQL editor before enabling shared storage.
create extension if not exists pgcrypto;
create table if not exists public.promotion_items (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 category text not null check (category in ('poster','notice')),
 body text not null default '',
 image_url text not null default '',
 created_at timestamptz not null default now()
);
alter table public.promotion_items enable row level security;
drop policy if exists "promotion items read" on public.promotion_items;
create policy "promotion items read" on public.promotion_items for select to authenticated
 using (exists(select 1 from public.user_profiles u where u.user_id=auth.uid() and u.active=true and u.role in ('admin','staff')));
drop policy if exists "promotion items admin insert" on public.promotion_items;
create policy "promotion items admin insert" on public.promotion_items for insert to authenticated
 with check (exists(select 1 from public.user_profiles u where u.user_id=auth.uid() and u.active=true and u.role='admin'));
drop policy if exists "promotion items admin update" on public.promotion_items;
create policy "promotion items admin update" on public.promotion_items for update to authenticated
 using (exists(select 1 from public.user_profiles u where u.user_id=auth.uid() and u.active=true and u.role='admin'))
 with check (exists(select 1 from public.user_profiles u where u.user_id=auth.uid() and u.active=true and u.role='admin'));
drop policy if exists "promotion items admin delete" on public.promotion_items;
create policy "promotion items admin delete" on public.promotion_items for delete to authenticated
 using (exists(select 1 from public.user_profiles u where u.user_id=auth.uid() and u.active=true and u.role='admin'));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('promotion-posters','promotion-posters',true,10485760,array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;
drop policy if exists "promotion posters admin upload" on storage.objects;
create policy "promotion posters admin upload" on storage.objects for insert to authenticated
 with check (bucket_id='promotion-posters' and exists(select 1 from public.user_profiles u where u.user_id=auth.uid() and u.active=true and u.role='admin'));
alter publication supabase_realtime add table public.promotion_items;
