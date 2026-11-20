/** Demo-mode shopping lines when Supabase is not configured. */

export type DemoShoppingLine = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string;
  fromRecipeId: string;
};

const demoShopping = new Map<string, DemoShoppingLine[]>();

export function appendDemoShoppingLines(
  householdId: string,
  lines: Omit<DemoShoppingLine, "id">[],
): void {
  const existing = demoShopping.get(householdId) ?? [];
  for (const line of lines) {
    existing.push({ ...line, id: crypto.randomUUID() });
  }
  demoShopping.set(householdId, existing);
}

export function getDemoShoppingLines(householdId: string): DemoShoppingLine[] {
  return demoShopping.get(householdId) ?? [];
}
