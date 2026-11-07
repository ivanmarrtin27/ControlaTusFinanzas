-- Service-role-only password check used by the auth-email Edge Function
-- when the Email provider is disabled in Auth settings.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.verify_user_password(p_email text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = auth, extensions, public
as $$
declare
  uid uuid;
begin
  if p_email is null or length(trim(p_email)) = 0 or p_password is null then
    return null;
  end if;

  select u.id into uid
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
    and u.encrypted_password = extensions.crypt(p_password, u.encrypted_password)
    and u.deleted_at is null
  limit 1;

  return uid;
end;
$$;

revoke all on function public.verify_user_password(text, text) from public;
revoke all on function public.verify_user_password(text, text) from anon;
revoke all on function public.verify_user_password(text, text) from authenticated;
grant execute on function public.verify_user_password(text, text) to service_role;
