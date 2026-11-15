-- HomeBase v1: household-scoped pantry / fridge / freezer inventory
-- All access is gated by household membership (RLS). Auth is Supabase Auth.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_id_idx
  on public.household_members (user_id);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  type text not null check (type in ('pantry', 'fridge', 'freezer')),
  name text not null,
  created_at timestamptz not null default now(),
  unique (household_id, type)
);

create index locations_household_id_idx
  on public.locations (household_id);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  name text not null,
  quantity numeric not null check (quantity >= 0),
  unit text not null check (
    unit in ('g', 'kg', 'ml', 'L', 'pieces', 'packets', 'bottles', 'cans')
  ),
  expires_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_items_household_location_idx
  on public.inventory_items (household_id, location_id);

create table public.inventory_activity (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  item_id uuid references public.inventory_items (id) on delete set null,
  item_name text not null,
  location_type text not null check (location_type in ('pantry', 'fridge', 'freezer')),
  action text not null check (action in ('added', 'consumed', 'adjusted')),
  quantity_delta numeric not null,
  unit text not null check (
    unit in ('g', 'kg', 'ml', 'L', 'pieces', 'packets', 'bottles', 'cans')
  ),
  note text,
  actor_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index inventory_activity_household_created_idx
  on public.inventory_activity (household_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Bootstrap: new auth user → profile + household + 3 locations
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );

  insert into public.households (name)
  values (coalesce(new.raw_user_meta_data ->> 'household_name', 'My Kitchen'))
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, new.id, 'owner');

  insert into public.locations (household_id, type, name)
  values
    (new_household_id, 'pantry', 'Pantry'),
    (new_household_id, 'fridge', 'Fridge'),
    (new_household_id, 'freezer', 'Freezer');

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.locations enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_activity enable row level security;

-- profiles: users can read/update themselves
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- households: members can read
create policy "households_select_member"
  on public.households for select
  to authenticated
  using (public.is_household_member(id));

create policy "households_update_member"
  on public.households for update
  to authenticated
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

-- household_members: members can see membership of their households
create policy "household_members_select_same_household"
  on public.household_members for select
  to authenticated
  using (public.is_household_member(household_id));

-- locations
create policy "locations_select_member"
  on public.locations for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "locations_insert_member"
  on public.locations for insert
  to authenticated
  with check (public.is_household_member(household_id));

create policy "locations_update_member"
  on public.locations for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- inventory_items
create policy "inventory_items_select_member"
  on public.inventory_items for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "inventory_items_insert_member"
  on public.inventory_items for insert
  to authenticated
  with check (public.is_household_member(household_id));

create policy "inventory_items_update_member"
  on public.inventory_items for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "inventory_items_delete_member"
  on public.inventory_items for delete
  to authenticated
  using (public.is_household_member(household_id));

-- inventory_activity (append-only for members)
create policy "inventory_activity_select_member"
  on public.inventory_activity for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "inventory_activity_insert_member"
  on public.inventory_activity for insert
  to authenticated
  with check (public.is_household_member(household_id));
