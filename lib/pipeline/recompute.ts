import type { CorrectionInput } from "../db/receipts";
import { checkAmountSanity, checkArithmetic, checkDateSanity, checkQuantitySanity } from "./checks";
import type { Reconciliation } from "../types";

export interface RecomputeResult {
  reconciliation: Reconciliation | null;
  flaggedFields: Set<string>;
  flaggedItemIndexes: Set<number>;
}

/**
 * Re-runs the deterministic checks (never the model's own confidence, which
 * is fixed at parse time) against user-corrected data. Used by PATCH so the
 * reconciliation banner and flags stay accurate after edits.
 */
export function recomputeCorrection(input: CorrectionInput): RecomputeResult {
  const arithmetic = checkArithmetic({
    lineItemAmounts: input.lineItems.map((li) => li.amount),
    tax: input.tax,
    tip: input.tip,
    discount: input.discount,
    total: input.total,
    currency: input.currency,
  });

  const flaggedFields = new Set<string>();
  if (input.merchant === null) flaggedFields.add("merchant");
  if (input.purchaseDate === null || !checkDateSanity(input.purchaseDate)) flaggedFields.add("purchase_date");
  if (!checkAmountSanity(input.subtotal)) flaggedFields.add("subtotal");
  if (!checkAmountSanity(input.tax)) flaggedFields.add("tax");
  if (!checkAmountSanity(input.discount)) flaggedFields.add("discount");
  if (!checkAmountSanity(input.tip)) flaggedFields.add("tip");
  if (input.total === null || input.total <= 0 || !arithmetic.ok) flaggedFields.add("total");

  const flaggedItemIndexes = new Set<number>();
  input.lineItems.forEach((item, idx) => {
    if (!checkAmountSanity(item.amount) || !checkQuantitySanity(item.quantity)) {
      flaggedItemIndexes.add(idx);
    }
  });

  return { reconciliation: arithmetic.reconciliation, flaggedFields, flaggedItemIndexes };
}
