alter table public.user_profiles
  add column if not exists username text;

create unique index if not exists idx_user_profiles_username_unique
  on public.user_profiles(lower(username))
  where username is not null;

update public.user_profiles
set username='admin'
where user_id = (
  select user_id from public.user_profiles
  where role='admin'
  order by created_at asc
  limit 1
)
and username is null;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles(user_id,email,display_name,username,role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name',''),
    nullif(new.raw_user_meta_data->>'username',''),
    'pending'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
