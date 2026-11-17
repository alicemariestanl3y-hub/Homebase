import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEMO_HOUSEHOLD_ID,
  SampleInventoryRepository,
} from "./repository";
import { performAddInventoryItem } from "./perform-mutations";
import { getInventoryRepository } from "./get-repository";

describe("manual inventory creation", () => {
  it("rejects invalid quantity before any write", async () => {
    const result = await performAddInventoryItem({
      name: "Milk",
      quantity: "0",
      unit: "L",
      locationType: "fridge",
    });
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /positive/i);
  });

  it("adds an item through the shared repository boundary (demo mode)", async () => {
    // Without Supabase secrets this process uses the sample repository —
    // same addItem contract the live Supabase repo implements.
    const marker = `Test Milk ${Date.now()}`;
    const result = await performAddInventoryItem({
      name: marker,
      quantity: "2",
      unit: "L",
      locationType: "fridge",
      expiresOn: "2030-01-15",
      notes: "automated test",
    });
    assert.equal(result.ok, true, result.error ?? "expected ok");
    assert.equal(result.error, null);

    const repo = getInventoryRepository();
    const fridge = await repo.listItemsByLocation(DEMO_HOUSEHOLD_ID, "fridge");
    const found = fridge.find((item) => item.name === marker);
    assert.ok(found, "saved item should be readable after add (refresh path)");
    assert.equal(found?.quantity, 2);
    assert.equal(found?.unit, "L");
  });

  it("shares the same addItem path used by Smart Capture saves", async () => {
    const repo = new SampleInventoryRepository();
    const created = await repo.addItem({
      householdId: DEMO_HOUSEHOLD_ID,
      locationType: "pantry",
      name: "Capture Pasta",
      quantity: 1,
      unit: "packets",
      expiresOn: null,
      notes: "Added via Smart Capture",
    });
    const pantry = await repo.listItemsByLocation(DEMO_HOUSEHOLD_ID, "pantry");
    assert.ok(pantry.some((item) => item.id === created.id));
  });
});
