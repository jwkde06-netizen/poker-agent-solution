-- Resolve app username to the actual Supabase Auth email.
-- Existing admin accounts may keep their original Auth email while using username='admin'.
create or replace function public.resolve_login_email(p_username text)
returns text
language sql
security definer
stable
set search_path=public
as $$
  select email
  from public.user_profiles
  where lower(username)=lower(trim(p_username))
    and active=true
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;
