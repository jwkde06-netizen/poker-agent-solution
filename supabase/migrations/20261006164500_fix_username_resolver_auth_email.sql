-- Fix username resolver to return the actual Supabase Auth email,
-- not the profile's display/internal email.
create or replace function public.resolve_login_email(p_username text)
returns text
language sql
security definer
stable
set search_path=public,auth
as $$
  select u.email
  from public.user_profiles p
  join auth.users u on u.id=p.user_id
  where lower(p.username)=lower(trim(p_username))
    and p.active=true
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;
