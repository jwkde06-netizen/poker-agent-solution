-- Restore the admin username mapping without changing credentials or roles.
-- Use the actual Supabase Auth email, not user_profiles.email.
create or replace function public.resolve_login_email(p_username text)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select u.email::text
  from public.user_profiles as p
  inner join auth.users as u on u.id = p.user_id
  where lower(p.username) = lower(btrim(p_username))
    and p.active = true
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

-- Repair only an existing admin profile without a username. Do not
-- create a new privileged user, change the password, or overwrite a mapping.
update public.user_profiles as p
set username = 'admin', updated_at = now()
where p.role = 'admin'
  and p.active = true
  and p.username is null
  and not exists (
    select 1 from public.user_profiles where lower(username) = 'admin'
  )
  and p.user_id = (
    select p2.user_id
    from public.user_profiles p2
    where p2.role = 'admin' and p2.active = true
    order by p2.created_at asc
    limit 1
  );
