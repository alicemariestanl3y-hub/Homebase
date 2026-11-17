/**
 * Future dedicated HomeBase inbox architecture for retailer emails.
 *
 * This increment does NOT wire IMAP/forwarding. Manual paste / screenshot
 * import uses the same parsers. When an inbox is added later:
 *
 * 1. Receive message → insert grocery_email_inbox (parse_status=pending)
 * 2. Detect retailer (Woolworths AU first) → parse HTML/text
 * 3. Only finalised/delivered orders proceed; others stay needs_approval
 * 4. Substitutions flagged on lines (was_substituted)
 * 5. Create draft grocery_imports with requires_approval=true
 * 6. User approves in UI → performSaveGroceryImport stocks inventory
 */

import type { GroceryFulfillment, GroceryRetailerCode } from "./types";
import {
  detectWoolworthsContent,
  parseWoolworthsEmail,
  WOOLWORTHS_RETAILER_CODE,
} from "./retailers/woolworths";

export type InboundGroceryEmail = {
  messageId: string;
  fromAddress: string;
  subject: string;
  receivedAt: string;
  html?: string | null;
  text?: string | null;
};

export type EmailImportPolicy = {
  /** Skip / hold orders that are not delivered/finalised. */
  onlyFinalisedOrders: true;
  /** Never write inventory until a person confirms. */
  requireApprovalBeforeInventory: true;
  /** Surface substitutions for review instead of silent accept. */
  handleSubstitutions: true;
};

export const DEFAULT_EMAIL_IMPORT_POLICY: EmailImportPolicy = {
  onlyFinalisedOrders: true,
  requireApprovalBeforeInventory: true,
  handleSubstitutions: true,
};

export function detectRetailerCode(
  email: InboundGroceryEmail,
): GroceryRetailerCode {
  const blob = `${email.fromAddress}\n${email.subject}\n${email.html ?? ""}\n${email.text ?? ""}`;
  if (detectWoolworthsContent(blob)) return WOOLWORTHS_RETAILER_CODE;
  return "other";
}

export function isFinalisedOrder(fulfillment: GroceryFulfillment): boolean {
  return fulfillment === "delivered";
}

/**
 * Normalize an inbound email into the same candidate shape as paste import.
 * Returns approvalRequired so callers never auto-stock inventory.
 */
export function previewInboundGroceryEmail(
  email: InboundGroceryEmail,
  policy: EmailImportPolicy = DEFAULT_EMAIL_IMPORT_POLICY,
): {
  retailerCode: GroceryRetailerCode;
  fulfillment: GroceryFulfillment;
  shouldImport: boolean;
  approvalRequired: boolean;
  reason: string | null;
  parsed: ReturnType<typeof parseWoolworthsEmail> | null;
} {
  const retailerCode = detectRetailerCode(email);
  const content = email.html?.trim() || email.text?.trim() || "";
  if (!content) {
    return {
      retailerCode,
      fulfillment: "unknown",
      shouldImport: false,
      approvalRequired: true,
      reason: "Email had no HTML or text body.",
      parsed: null,
    };
  }

  if (retailerCode !== WOOLWORTHS_RETAILER_CODE) {
    return {
      retailerCode,
      fulfillment: "unknown",
      shouldImport: false,
      approvalRequired: true,
      reason: "Unsupported retailer for automatic email import yet.",
      parsed: null,
    };
  }

  const parsed = parseWoolworthsEmail(content);
  if (policy.onlyFinalisedOrders && !isFinalisedOrder(parsed.fulfillment)) {
    return {
      retailerCode,
      fulfillment: parsed.fulfillment,
      shouldImport: false,
      approvalRequired: true,
      reason:
        "Order does not look finalised/delivered yet — held for approval.",
      parsed,
    };
  }

  return {
    retailerCode,
    fulfillment: parsed.fulfillment,
    shouldImport: true,
    approvalRequired: policy.requireApprovalBeforeInventory,
    reason: null,
    parsed,
  };
}
