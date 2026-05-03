-- Create get_email_by_username function for username-to-email lookup
-- Returns email address for a given username (case-insensitive)
-- Uses security definer to allow unauthenticated lookups without direct table access

create or replace function public.get_email_by_username(
  p_username text
)
returns text
language sql
stable
security definer
as $$
  select email
  from public.users
  where lower(username) = lower(p_username)
  limit 1;
$$;

revoke all on function public.get_email_by_username(text) from public;
grant execute on function public.get_email_by_username(text) to anon, authenticated;
