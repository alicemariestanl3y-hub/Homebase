-- Idempotent household bootstrap for signed-in users.
-- Covers accounts created when the auth.users trigger was missing/failed,
-- and can be called safely after every sign-in.

create or replace function public.ensure_my_household(
  desired_name text default 'My Kitchen'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  profile_name text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select hm.household_id
    into hid
  from public.household_members hm
  where hm.user_id = uid
  order by hm.created_at asc
  limit 1;

  if hid is not null then
    return hid;
  end if;

  profile_name := split_part(
    coalesce(auth.jwt() ->> 'email', 'member'),
    '@',
    1
  );

  insert into public.profiles (id, display_name)
  values (uid, profile_name)
  on conflict (id) do nothing;

  insert into public.households (name)
  values (coalesce(nullif(trim(desired_name), ''), 'My Kitchen'))
  returning id into hid;

  insert into public.household_members (household_id, user_id, role)
  values (hid, uid, 'owner');

  insert into public.locations (household_id, type, name)
  values
    (hid, 'pantry', 'Pantry'),
    (hid, 'fridge', 'Fridge'),
    (hid, 'freezer', 'Freezer')
  on conflict (household_id, type) do nothing;

  return hid;
end;
$$;

revoke all on function public.ensure_my_household(text) from public;
grant execute on function public.ensure_my_household(text) to authenticated;
