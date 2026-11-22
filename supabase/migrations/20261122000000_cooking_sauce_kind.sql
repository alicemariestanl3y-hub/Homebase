-- Extend catalog product kinds with cooking_sauce (additive; no data wiped).
-- Safe: only relaxes CHECKs and leaves existing rows unchanged.

alter table public.catalog_products
  drop constraint if exists catalog_products_product_kind_check;

alter table public.catalog_products
  add constraint catalog_products_product_kind_check
  check (
    product_kind in (
      'standard',
      'recipe_base',
      'meal_kit',
      'cooking_sauce',
      'unclassified'
    )
  );

alter table public.catalog_products
  drop constraint if exists catalog_products_kind_suggested_check;

alter table public.catalog_products
  add constraint catalog_products_kind_suggested_check
  check (
    kind_suggested is null
    or kind_suggested in (
      'standard',
      'recipe_base',
      'meal_kit',
      'cooking_sauce',
      'unclassified'
    )
  );
