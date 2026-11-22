import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeCaptureCandidate } from "./normalize-capture";
import type { CapturedCandidate } from "@/lib/capture/types";

function base(partial: Partial<CapturedCandidate>): CapturedCandidate {
  return {
    id: "cap_1",
    name: "Milk",
    brand: null,
    packageSize: null,
    quantity: 1,
    unit: "L",
    expiresOn: null,
    suggestedLocation: "fridge",
    confidence: "high",
    needsReview: false,
    notes: null,
    sourceImageIndex: 0,
    ...partial,
  };
}

describe("normalizeCaptureCandidate", () => {
  it("treats Mingle Satay Recipe Base 30g as one packet, not 30 grams", () => {
    const result = normalizeCaptureCandidate(
      base({
        name: "Mingle Satay Recipe Base",
        brand: "Mingle",
        quantity: 30,
        unit: "g",
        packageSize: "30g",
        suggestedLocation: "pantry",
      }),
    );
    assert.equal(result.isPackagedMealProduct, true);
    assert.equal(result.suggestedProductKind, "recipe_base");
    assert.equal(result.quantity, 1);
    assert.equal(result.unit, "packets");
    assert.equal(result.packageSize, "30g");
  });

  it("leaves ordinary milk as litres", () => {
    const result = normalizeCaptureCandidate(
      base({ name: "Full cream milk", quantity: 2, unit: "L" }),
    );
    assert.equal(result.isPackagedMealProduct, false);
    assert.equal(result.quantity, 2);
    assert.equal(result.unit, "L");
  });
});
