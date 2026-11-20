-- HomeBase: packaged recipe bases, meal kits, catalog products, allergens
-- Product identity is separate from inventory quantities.
-- Never invent packet instructions — only user/trusted verified content.

-- ---------------------------------------------------------------------------
-- Catalog products (reusable identity across purchases)
-- ---------------------------------------------------------------------------

create table public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  brand text,
  display_name text not null,
  variant text,
  pack_size text,
  -- Exact retailer / packet wording preserved for matching.
  original_name text,
  product_kind text not null default 'unclassified' check (
    product_kind in ('standard', 'recipe_base', 'meal_kit', 'unclassified')
  ),
  -- Classification confidence from heuristics; user can override kind.
  kind_suggested text check (
    kind_suggested is null
    or kind_suggested in ('standard', 'recipe_base', 'meal_kit', 'unclassified')
  ),
  kind_confirmed boolean not null default false,
  ingredient_key text,
  identity_key text not null,
  allergen_status text not null default 'unverified' check (
    allergen_status in (
      'unverified',
      'verified_clear',
      'contains_restricted',
      'may_contain'
    )
  ),
  allergens text[] not null default '{}',
  allergen_notes text,
  allergen_verified_at timestamptz,
  allergen_source text,
  source_type text check (
    source_type is null
    or source_type in ('user_packet', 'trusted', 'manual', 'import', 'capture')
  ),
  source_url text,
  source_captured_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, identity_key)
);

create index catalog_products_household_kind_idx
  on public.catalog_products (household_id, product_kind);

create index catalog_products_household_key_idx
  on public.catalog_products (household_id, ingredient_key);

create trigger catalog_products_set_updated_at
before update on public.catalog_products
for each row
execute function public.set_updated_at();

-- Link inventory stock rows to catalog identity (nullable for legacy rows).
alter table public.inventory_items
  add column if not exists catalog_product_id uuid
    references public.catalog_products (id) on delete set null;

create index if not exists inventory_items_catalog_product_idx
  on public.inventory_items (catalog_product_id);

-- ---------------------------------------------------------------------------
-- Recipe type (traditional / recipe_base / meal_kit)
-- ---------------------------------------------------------------------------

alter table public.recipes
  add column if not exists recipe_type text not null default 'traditional'
    check (recipe_type in ('traditional', 'recipe_base', 'meal_kit'));

alter table public.recipes
  add column if not exists catalog_product_id uuid
    references public.catalog_products (id) on delete set null;

create index if not exists recipes_household_type_idx
  on public.recipes (household_id, recipe_type);

-- ---------------------------------------------------------------------------
-- Verified packaged-meal definitions (product → meal, instructions once)
-- ---------------------------------------------------------------------------

create table public.packaged_meal_defs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  catalog_product_id uuid not null references public.catalog_products (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  servings_per_packet numeric not null default 4 check (servings_per_packet > 0),
  packets_required numeric not null default 1 check (packets_required > 0),
  -- Packet cooking instructions — only stored when user/trusted source provides them.
  instructions text,
  instructions_verified boolean not null default false,
  instructions_source text check (
    instructions_source is null
    or instructions_source in ('user_packet_photo', 'user_typed', 'trusted', 'manual')
  ),
  instructions_captured_at timestamptz,
  source_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, catalog_product_id, recipe_id)
);

create index packaged_meal_defs_product_idx
  on public.packaged_meal_defs (catalog_product_id);

create index packaged_meal_defs_recipe_idx
  on public.packaged_meal_defs (recipe_id);

create trigger packaged_meal_defs_set_updated_at
before update on public.packaged_meal_defs
for each row
execute function public.set_updated_at();

-- Ingredients already inside the packet/kit (do not shop or double-deduct).
create table public.packaged_meal_included (
  id uuid primary key default gen_random_uuid(),
  packaged_meal_def_id uuid not null references public.packaged_meal_defs (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  quantity numeric check (quantity is null or quantity >= 0),
  unit text check (
    unit is null
    or unit in ('g', 'kg', 'ml', 'L', 'pieces', 'packets', 'bottles', 'cans')
  ),
  ingredient_key text,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index packaged_meal_included_def_idx
  on public.packaged_meal_included (packaged_meal_def_id, sort_order);

-- Household restricted allergens (defaults seeded in app: garlic, cashew, pistachio).
create table public.household_allergens (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  allergen_key text not null,
  display_name text not null,
  severity text not null default 'avoid' check (
    severity in ('avoid', 'caution')
  ),
  created_at timestamptz not null default now(),
  unique (household_id, allergen_key)
);

-- Cook confirmations (prevent duplicate deductions).
create table public.meal_cook_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_id uuid references public.recipes (id) on delete set null,
  meal_plan_entry_id uuid references public.meal_plan_entries (id) on delete set null,
  packaged_meal_def_id uuid references public.packaged_meal_defs (id) on delete set null,
  packets_used numeric not null default 1 check (packets_used > 0),
  servings numeric,
  deducted boolean not null default false,
  confirmation_payload jsonb,
  created_at timestamptz not null default now()
);

create index meal_cook_events_household_created_idx
  on public.meal_cook_events (household_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.catalog_products enable row level security;
alter table public.packaged_meal_defs enable row level security;
alter table public.packaged_meal_included enable row level security;
alter table public.household_allergens enable row level security;
alter table public.meal_cook_events enable row level security;

create policy "catalog_products_member_all"
  on public.catalog_products for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "packaged_meal_defs_member_all"
  on public.packaged_meal_defs for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "packaged_meal_included_member_all"
  on public.packaged_meal_included for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "household_allergens_member_all"
  on public.household_allergens for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "meal_cook_events_member_all"
  on public.meal_cook_events for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
