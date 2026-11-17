import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectWoolworthsContent,
  extractPackSizeFromDescription,
  isLikelyNonFood,
  parseWoolworthsEmail,
  standardizeWoolworthsName,
} from "./woolworths";
import { previewInboundGroceryEmail } from "../email-pipeline";

const SAMPLE_HTML = `
<html><body>
  <p>Thanks for shopping at Woolworths</p>
  <p>Order number: W12345678</p>
  <p>Your order has been delivered</p>
  <table>
    <tr>
      <th>Item description</th><th>Unit price</th><th>Qty</th><th>Price</th>
    </tr>
    <tr>
      <td>Woolworths Full Cream Milk<br>2L</td>
      <td>$3.10</td>
      <td>2</td>
      <td>$6.20</td>
    </tr>
    <tr>
      <td>Banana Cavendish<br>Approx 1kg</td>
      <td>$4.90</td>
      <td>1</td>
      <td>$4.90</td>
    </tr>
    <tr>
      <td>Earth Choice Laundry Liquid<br>1L</td>
      <td>$6.00</td>
      <td>1</td>
      <td>$6.00</td>
    </tr>
  </table>
</body></html>
`;

describe("Woolworths AU grocery email parser", () => {
  it("detects Woolworths content", () => {
    assert.equal(detectWoolworthsContent(SAMPLE_HTML), true);
  });

  it("joins multi-line descriptions and extracts qty/prices", () => {
    const parsed = parseWoolworthsEmail(SAMPLE_HTML);
    assert.equal(parsed.retailerCode, "woolworths_au");
    assert.equal(parsed.orderReference, "W12345678");
    assert.equal(parsed.fulfillment, "delivered");
    assert.equal(parsed.candidates.length, 3);

    const milk = parsed.candidates[0];
    assert.match(milk?.originalName ?? "", /Full Cream Milk/i);
    assert.match(milk?.originalName ?? "", /2L/i);
    assert.equal(milk?.quantity, 2);
    assert.equal(milk?.unitPrice, 3.1);
    assert.equal(milk?.linePrice, 6.2);
    assert.equal(milk?.suggestedLocation, "fridge");
    assert.equal(milk?.isFood, true);
    assert.equal(milk?.selected, true);
    assert.equal(milk?.packageSize, "2L");
    assert.equal(milk?.standardizedName, "Full Cream Milk");
    assert.match(milk?.ingredientKey ?? "", /cream/);
  });

  it("excludes non-food by default but keeps the line", () => {
    const parsed = parseWoolworthsEmail(SAMPLE_HTML);
    const laundry = parsed.candidates.find((item) =>
      /laundry/i.test(item.originalName ?? ""),
    );
    assert.ok(laundry);
    assert.equal(laundry?.isFood, false);
    assert.equal(laundry?.selected, false);
    assert.equal(isLikelyNonFood("Earth Choice Laundry Liquid"), true);
  });

  it("never invents pack sizes that are not present", () => {
    assert.equal(extractPackSizeFromDescription("Fresh basil"), null);
    assert.equal(extractPackSizeFromDescription("Milk 2L"), "2L");
  });

  it("standardises Woolworths house-brand prefixes for matching", () => {
    assert.equal(
      standardizeWoolworthsName("Woolworths Free Range Eggs\n12 pack"),
      "Free Range Eggs",
    );
  });

  it("holds non-finalised email orders for approval in the future inbox path", () => {
    const pendingHtml = SAMPLE_HTML
      .replace("Your order has been delivered", "We're preparing your order")
      .replace("Thanks for shopping at Woolworths", "Order confirmed");
    const preview = previewInboundGroceryEmail({
      messageId: "msg-1",
      fromAddress: "orders@woolworths.com.au",
      subject: "Order confirmed",
      receivedAt: new Date().toISOString(),
      html: pendingHtml,
    });
    assert.equal(preview.fulfillment, "ordered");
    assert.equal(preview.shouldImport, false);
    assert.equal(preview.approvalRequired, true);
    assert.match(preview.reason ?? "", /finalised|delivered/i);
  });
});
