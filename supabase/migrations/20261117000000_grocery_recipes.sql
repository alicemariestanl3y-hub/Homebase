-- HomeBase: grocery import + family recipe library (+ meal-planning schema stubs)
-- All rows are household-scoped via is_household_member() RLS.

-- ---------------------------------------------------------------------------
-- Ingredient matching (shared vocabulary across grocery, recipes, inventory)
-- ---------------------------------------------------------------------------

create table public.ingredient_keys (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  -- null household_id = global alias; non-null = household override
  canonical_key text not null,
  display_name text not null,
  default_unit text check (
    default_unit is null
    or default_unit in ('g', 'kg', 'ml', 'L', 'pieces', 'packets', 'bottles', 'cans')
  ),
  created_at timestamptz not null default now(),
  unique (household_id, canonical_key)
);

create index ingredient_keys_household_idx
  on public.ingredient_keys (household_id);

create table public.ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  alias text not null,
  canonical_key text not null,
  created_at timestamptz not null default now()
);

create unique index ingredient_aliases_unique_alias
  on public.ingredient_aliases (coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid), alias);

create index ingredient_aliases_key_idx
  on public.ingredient_aliases (canonical_key);

-- ---------------------------------------------------------------------------
-- Grocery imports (designed so email ingestion can attach later)
-- ---------------------------------------------------------------------------

create table public.grocery_imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  source_type text not null check (
    source_type in ('screenshot', 'image', 'pdf', 'pasted_list', 'email')
  ),
  source_label text,
  -- Stable fingerprint to prevent accidental double-import of the same order.
  content_hash text not null,
  status text not null default 'draft' check (
    status in ('draft', 'reviewed', 'imported', 'cancelled')
  ),
  fulfillment text not null default 'unknown' check (
    fulfillment in ('ordered', 'delivered', 'mixed', 'unknown')
  ),
  retailer text,
  order_reference text,
  notes text,
  actor_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  imported_at timestamptz,
  unique (household_id, content_hash)
);

create index grocery_imports_household_created_idx
  on public.grocery_imports (household_id, created_at desc);

create table public.grocery_import_lines (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.grocery_imports (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  brand text,
  package_size text,
  quantity numeric not null check (quantity >= 0),
  unit text not null check (
    unit in ('g', 'kg', 'ml', 'L', 'pieces', 'packets', 'bottles', 'cans')
  ),
  suggested_location text not null check (
    suggested_location in ('pantry', 'fridge', 'freezer')
  ),
  line_fulfillment text not null default 'delivered' check (
    line_fulfillment in ('ordered', 'delivered')
  ),
  confidence text not null default 'medium' check (
    confidence in ('high', 'medium', 'low')
  ),
  needs_review boolean not null default false,
  selected boolean not null default true,
  merge_with_item_id uuid references public.inventory_items (id) on delete set null,
  ingredient_key text,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index grocery_import_lines_import_idx
  on public.grocery_import_lines (import_id, sort_order);

-- ---------------------------------------------------------------------------
-- Family recipe library
-- ---------------------------------------------------------------------------

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null,
  source_url text,
  source_name text,
  attribution text,
  servings numeric not null default 4 check (servings > 0),
  prep_minutes int check (prep_minutes is null or prep_minutes >= 0),
  cook_minutes int check (cook_minutes is null or cook_minutes >= 0),
  cuisine text,
  cooking_method text,
  instructions text,
  notes text,
  is_favourite boolean not null default false,
  freezer_suitable boolean not null default false,
  leftover_friendly boolean not null default false,
  dietary_tags text[] not null default '{}',
  -- Personal variation of another household recipe
  variation_of_recipe_id uuid references public.recipes (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_household_title_idx
  on public.recipes (household_id, title);

create index recipes_household_favourite_idx
  on public.recipes (household_id, is_favourite);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  quantity numeric check (quantity is null or quantity >= 0),
  unit text check (
    unit is null
    or unit in ('g', 'kg', 'ml', 'L', 'pieces', 'packets', 'bottles', 'cans')
  ),
  ingredient_key text,
  notes text,
  optional boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index recipe_ingredients_recipe_idx
  on public.recipe_ingredients (recipe_id, sort_order);

create index recipe_ingredients_key_idx
  on public.recipe_ingredients (household_id, ingredient_key);

create trigger recipes_set_updated_at
before update on public.recipes
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Future meal planning (schema only — no app UI in this increment)
-- ---------------------------------------------------------------------------

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  week_start_date date not null,
  title text,
  notes text,
  created_at timestamptz not null default now(),
  unique (household_id, week_start_date)
);

create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_id uuid references public.recipes (id) on delete set null,
  planned_date date not null,
  meal_slot text not null default 'dinner' check (
    meal_slot in ('breakfast', 'lunch', 'dinner', 'snack', 'other')
  ),
  servings numeric check (servings is null or servings > 0),
  status text not null default 'planned' check (
    status in ('planned', 'cooked', 'skipped')
  ),
  notes text,
  created_at timestamptz not null default now()
);

create index meal_plan_entries_plan_date_idx
  on public.meal_plan_entries (meal_plan_id, planned_date);

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null default 'Shopping list',
  meal_plan_id uuid references public.meal_plans (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'completed', 'archived')),
  created_at timestamptz not null default now()
);

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references public.shopping_lists (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  ingredient_key text,
  is_checked boolean not null default false,
  from_recipe_id uuid references public.recipes (id) on delete set null,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.leftovers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  quantity numeric not null check (quantity > 0),
  unit text not null check (
    unit in ('g', 'kg', 'ml', 'L', 'pieces', 'packets', 'bottles', 'cans')
  ),
  from_recipe_id uuid references public.recipes (id) on delete set null,
  from_meal_plan_entry_id uuid references public.meal_plan_entries (id) on delete set null,
  location_id uuid references public.locations (id) on delete set null,
  expires_on date,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.ingredient_keys enable row level security;
alter table public.ingredient_aliases enable row level security;
alter table public.grocery_imports enable row level security;
alter table public.grocery_import_lines enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_entries enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.leftovers enable row level security;

-- Global ingredient keys/aliases (household_id is null) are readable by all
-- authenticated users; household rows stay member-scoped.

create policy "ingredient_keys_select"
  on public.ingredient_keys for select
  to authenticated
  using (
    household_id is null
    or public.is_household_member(household_id)
  );

create policy "ingredient_keys_write_member"
  on public.ingredient_keys for insert
  to authenticated
  with check (
    household_id is not null
    and public.is_household_member(household_id)
  );

create policy "ingredient_keys_update_member"
  on public.ingredient_keys for update
  to authenticated
  using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));

create policy "ingredient_keys_delete_member"
  on public.ingredient_keys for delete
  to authenticated
  using (household_id is not null and public.is_household_member(household_id));

create policy "ingredient_aliases_select"
  on public.ingredient_aliases for select
  to authenticated
  using (
    household_id is null
    or public.is_household_member(household_id)
  );

create policy "ingredient_aliases_write_member"
  on public.ingredient_aliases for insert
  to authenticated
  with check (
    household_id is not null
    and public.is_household_member(household_id)
  );

create policy "ingredient_aliases_update_member"
  on public.ingredient_aliases for update
  to authenticated
  using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));

create policy "ingredient_aliases_delete_member"
  on public.ingredient_aliases for delete
  to authenticated
  using (household_id is not null and public.is_household_member(household_id));

create policy "grocery_imports_select_member"
  on public.grocery_imports for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "grocery_imports_insert_member"
  on public.grocery_imports for insert
  to authenticated
  with check (public.is_household_member(household_id));

create policy "grocery_imports_update_member"
  on public.grocery_imports for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "grocery_imports_delete_member"
  on public.grocery_imports for delete
  to authenticated
  using (public.is_household_member(household_id));

create policy "grocery_import_lines_select_member"
  on public.grocery_import_lines for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "grocery_import_lines_insert_member"
  on public.grocery_import_lines for insert
  to authenticated
  with check (public.is_household_member(household_id));

create policy "grocery_import_lines_update_member"
  on public.grocery_import_lines for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "grocery_import_lines_delete_member"
  on public.grocery_import_lines for delete
  to authenticated
  using (public.is_household_member(household_id));

create policy "recipes_select_member"
  on public.recipes for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "recipes_insert_member"
  on public.recipes for insert
  to authenticated
  with check (public.is_household_member(household_id));

create policy "recipes_update_member"
  on public.recipes for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "recipes_delete_member"
  on public.recipes for delete
  to authenticated
  using (public.is_household_member(household_id));

create policy "recipe_ingredients_select_member"
  on public.recipe_ingredients for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "recipe_ingredients_insert_member"
  on public.recipe_ingredients for insert
  to authenticated
  with check (public.is_household_member(household_id));

create policy "recipe_ingredients_update_member"
  on public.recipe_ingredients for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "recipe_ingredients_delete_member"
  on public.recipe_ingredients for delete
  to authenticated
  using (public.is_household_member(household_id));

create policy "meal_plans_all_member"
  on public.meal_plans for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "meal_plan_entries_all_member"
  on public.meal_plan_entries for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "shopping_lists_all_member"
  on public.shopping_lists for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "shopping_list_items_all_member"
  on public.shopping_list_items for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "leftovers_all_member"
  on public.leftovers for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
