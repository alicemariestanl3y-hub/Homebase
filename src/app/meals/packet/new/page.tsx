import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PackagedMealVerifyForm } from "@/components/meals/PackagedMealVerifyForm";
import { resolveHouseholdIdForRequest } from "@/lib/household/resolve";
import { getInventoryMode } from "@/lib/inventory/get-repository";
import { listCatalogProducts } from "@/lib/packaged-meals/repository";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function PacketNewContent({ searchParams }: PageProps) {
  await connection();
  const mode = getInventoryMode();
  const params = (await searchParams) ?? {};
  const productId = firstParam(params.productId);
  const household = await resolveHouseholdIdForRequest();

  if (!household.householdId) {
    return (
      <AppShell showSignOut={mode === "live"}>
        <p className="hb-empty">
          {household.error ?? "No household linked to your account yet."}
        </p>
      </AppShell>
    );
  }

  const products = await listCatalogProducts(household.householdId);
  const product = products.find((row) => row.id === productId);

  if (!product) {
    return (
      <AppShell showSignOut={mode === "live"}>
        <p className="hb-empty">
          Pick a recipe base or meal kit from Meals recommendations first.
        </p>
        <Link href="/meals" className="hb-btn" style={{ marginTop: "1rem" }}>
          Back to meals
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell showSignOut={mode === "live"}>
      <PackagedMealVerifyForm product={product} />
    </AppShell>
  );
}

export default function PacketNewPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="hb-empty">Loading packet…</p>
        </AppShell>
      }
    >
      <PacketNewContent searchParams={props.searchParams} />
    </Suspense>
  );
}
