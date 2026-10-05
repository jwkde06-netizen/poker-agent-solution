-- Role-based access for Dream Poker accounts

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'pending' check (role in ('admin','staff','agent','pending')),
  agency_id uuid references public.agencies(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_role on public.user_profiles(role);
create index if not exists idx_user_profiles_agency_id on public.user_profiles(agency_id);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles(user_id,email,display_name,role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name',''),
    'pending'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

insert into public.user_profiles(user_id,email,display_name,role)
select id,email,'','pending'
from auth.users
on conflict (user_id) do nothing;

update public.user_profiles
set role='admin', active=true, updated_at=now()
where user_id = (
  select id from auth.users order by created_at asc limit 1
);

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.user_profiles where user_id=auth.uid() and active=true),'pending');
$$;

create or replace function public.current_agency_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id from public.user_profiles where user_id=auth.uid() and active=true;
$$;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_agency_id() to authenticated;

alter table public.user_profiles enable row level security;

drop policy if exists "profiles own or admin read" on public.user_profiles;
create policy "profiles own or admin read"
on public.user_profiles for select to authenticated
using (user_id=auth.uid() or public.current_app_role()='admin');

drop policy if exists "profiles admin update" on public.user_profiles;
create policy "profiles admin update"
on public.user_profiles for update to authenticated
using (public.current_app_role()='admin')
with check (public.current_app_role()='admin');

drop policy if exists "profiles admin insert" on public.user_profiles;
create policy "profiles admin insert"
on public.user_profiles for insert to authenticated
with check (public.current_app_role()='admin');

drop policy if exists "profiles admin delete" on public.user_profiles;
create policy "profiles admin delete"
on public.user_profiles for delete to authenticated
using (public.current_app_role()='admin');

-- Replace broad authenticated policies with role-aware policies.
drop policy if exists "authenticated agencies all" on public.agencies;
drop policy if exists "role agencies read" on public.agencies;
create policy "role agencies read"
on public.agencies for select to authenticated
using (
  public.current_app_role() in ('admin','staff')
  or (public.current_app_role()='agent' and id=public.current_agency_id())
);
drop policy if exists "admin agencies write" on public.agencies;
create policy "admin agencies write"
on public.agencies for all to authenticated
using (public.current_app_role()='admin')
with check (public.current_app_role()='admin');

drop policy if exists "authenticated players all" on public.players;
drop policy if exists "role players read" on public.players;
create policy "role players read"
on public.players for select to authenticated
using (
  public.current_app_role() in ('admin','staff')
  or (public.current_app_role()='agent' and agency_id=public.current_agency_id())
);
drop policy if exists "ops players write" on public.players;
create policy "ops players write"
on public.players for all to authenticated
using (public.current_app_role() in ('admin','staff'))
with check (public.current_app_role() in ('admin','staff'));

drop policy if exists "authenticated game entries all" on public.game_entries;
drop policy if exists "role game entries read" on public.game_entries;
create policy "role game entries read"
on public.game_entries for select to authenticated
using (
  public.current_app_role() in ('admin','staff')
  or (public.current_app_role()='agent' and agency_id=public.current_agency_id())
);
drop policy if exists "ops game entries write" on public.game_entries;
create policy "ops game entries write"
on public.game_entries for all to authenticated
using (public.current_app_role() in ('admin','staff'))
with check (public.current_app_role() in ('admin','staff'));

drop policy if exists "authenticated game sessions all" on public.game_sessions;
drop policy if exists "role game sessions read" on public.game_sessions;
create policy "role game sessions read"
on public.game_sessions for select to authenticated
using (
  public.current_app_role() in ('admin','staff')
  or (
    public.current_app_role()='agent'
    and exists (
      select 1 from public.game_entries ge
      where ge.session_id=game_sessions.id
        and ge.agency_id=public.current_agency_id()
    )
  )
);
drop policy if exists "ops game sessions write" on public.game_sessions;
create policy "ops game sessions write"
on public.game_sessions for all to authenticated
using (public.current_app_role() in ('admin','staff'))
with check (public.current_app_role() in ('admin','staff'));

drop policy if exists "Authenticated users can read FNB" on public.fnb_entries;
drop policy if exists "Authenticated users can insert FNB" on public.fnb_entries;
drop policy if exists "Authenticated users can update FNB" on public.fnb_entries;
drop policy if exists "Authenticated users can delete FNB" on public.fnb_entries;
drop policy if exists "ops fnb read" on public.fnb_entries;
create policy "ops fnb read"
on public.fnb_entries for select to authenticated
using (public.current_app_role() in ('admin','staff'));
drop policy if exists "ops fnb write" on public.fnb_entries;
create policy "ops fnb write"
on public.fnb_entries for all to authenticated
using (public.current_app_role() in ('admin','staff'))
with check (public.current_app_role() in ('admin','staff'));
