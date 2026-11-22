import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CapturedCandidate } from "./types";
import { performSaveCapturedItems } from "./perform-save";
import { DEMO_HOUSEHOLD_ID } from "@/lib/inventory/repository";
import { getInventoryRepository } from "@/lib/inventory/get-repository";

function candidate(
  patch: Partial<CapturedCandidate> & Pick<CapturedCandidate, "name">,
): CapturedCandidate {
  return {
    id: `cand_${Math.random().toString(16).slice(2)}`,
    brand: null,
    packageSize: null,
    quantity: 1,
    unit: "pieces",
    expiresOn: null,
    suggestedLocation: "pantry",
    confidence: "high",
    needsReview: false,
    notes: null,
    sourceImageIndex: 0,
    selected: true,
    mergeWithItemId: null,
    ...patch,
  };
}

describe("saving AI-recognised products", () => {
  it("requires at least one selected candidate", async () => {
    const result = await performSaveCapturedItems([
      candidate({ name: "Skip me", selected: false }),
    ]);
    assert.equal(result.savedCount, 0);
    assert.match(result.error ?? "", /select at least one/i);
  });

  it("saves approved candidates through the shared inventory add path", async () => {
    const marker = `AI Beans ${Date.now()}`;
    const result = await performSaveCapturedItems([
      candidate({
        name: marker,
        quantity: 3,
        unit: "cans",
        suggestedLocation: "pantry",
        brand: "TestCo",
        expiresOn: "2031-06-01",
      }),
    ]);

    assert.equal(result.error, null, result.error ?? "expected success");
    assert.equal(result.savedCount, 1);

    const repo = getInventoryRepository();
    const pantry = await repo.listItemsByLocation(DEMO_HOUSEHOLD_ID, "pantry");
    const found = pantry.find((item) => item.name === marker);
    assert.ok(found, "AI-saved item should remain readable after save");
    assert.equal(found?.quantity, 3);
    assert.equal(found?.unit, "cans");
    assert.equal(found?.expiresOn, "2031-06-01");
    assert.match(found?.notes ?? "", /Smart Capture/);
  });

  it("reports a clear error when every selected row is invalid", async () => {
    const result = await performSaveCapturedItems([
      candidate({
        name: "Bad unit item",
        // @ts-expect-error intentional invalid unit for runtime guard
        unit: "boxes",
      }),
    ]);
    assert.equal(result.savedCount, 0);
    assert.match(result.error ?? "", /none of the selected items/i);
  });

  it("stocks Mingle Satay Recipe Base as one packet, linked to catalog", async () => {
    const marker = `Mingle Satay Recipe Base ${Date.now()}`;
    const result = await performSaveCapturedItems([
      candidate({
        name: marker,
        brand: "Mingle",
        quantity: 30,
        unit: "g",
        packageSize: "30g",
        suggestedLocation: "pantry",
      }),
    ]);

    assert.equal(result.error, null, result.error ?? "expected success");
    assert.equal(result.savedCount, 1);
    assert.equal(result.savedItems.length, 1);
    assert.equal(result.savedItems[0]?.isPackagedMealProduct, true);
    assert.equal(result.savedItems[0]?.productKind, "recipe_base");
    assert.ok(result.savedItems[0]?.catalogProductId);

    const repo = getInventoryRepository();
    const pantry = await repo.listItemsByLocation(DEMO_HOUSEHOLD_ID, "pantry");
    const found = pantry.find((item) => item.name === marker);
    assert.ok(found);
    assert.equal(found?.quantity, 1);
    assert.equal(found?.unit, "packets");
    assert.equal(found?.catalogProductId, result.savedItems[0]?.catalogProductId);
  });
});
