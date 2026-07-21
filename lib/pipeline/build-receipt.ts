import type { ValidatedExtraction } from "../gemini/validation";
import type { NewFieldMeta, NewLineItem } from "../db/receipts";
import type { Reconciliation, Confidence } from "../types";
import { checkArithmetic, checkAmountSanity, checkDateSanity, checkQuantitySanity } from "./checks";

export interface BuiltReceipt {
  merchant: string | null;
  purchaseDate: string | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  tip: number | null;
  total: number | null;
  lineItems: NewLineItem[];
  fieldMeta: NewFieldMeta[];
  reconciliation: Reconciliation | null;
}

export function buildReceiptFromExtraction(extraction: ValidatedExtraction): BuiltReceipt {
  const lineItemAmounts = extraction.line_items.map((li) => li.amount);

  const arithmetic = checkArithmetic({
    lineItemAmounts,
    tax: extraction.tax.value,
    tip: extraction.tip.value,
    discount: extraction.discount.value,
    total: extraction.total.value,
    currency: extraction.currency,
  });

  const fieldMeta: NewFieldMeta[] = [];

  const pushMeta = (field: string, confidence: Confidence, deterministicFailed: boolean) => {
    fieldMeta.push({
      field,
      confidence,
      flagged: confidence === "low" || deterministicFailed,
    });
  };

  pushMeta("merchant", extraction.merchant.confidence, extraction.merchant.value === null);
  pushMeta(
    "purchase_date",
    extraction.purchase_date.confidence,
    extraction.purchase_date.value === null || !checkDateSanity(extraction.purchase_date.value)
  );
  pushMeta("subtotal", extraction.subtotal.confidence, !checkAmountSanity(extraction.subtotal.value));
  pushMeta("tax", extraction.tax.confidence, !checkAmountSanity(extraction.tax.value));
  pushMeta("discount", extraction.discount.confidence, !checkAmountSanity(extraction.discount.value));
  pushMeta("tip", extraction.tip.confidence, !checkAmountSanity(extraction.tip.value));
  pushMeta(
    "total",
    extraction.total.confidence,
    extraction.total.value === null || extraction.total.value <= 0 || !arithmetic.ok
  );

  const lineItems: NewLineItem[] = extraction.line_items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    amount: item.amount,
    confidence: item.confidence,
    flagged:
      item.confidence === "low" ||
      !checkAmountSanity(item.amount) ||
      !checkQuantitySanity(item.quantity),
  }));

  return {
    merchant: extraction.merchant.value,
    purchaseDate: extraction.purchase_date.value,
    currency: extraction.currency,
    subtotal: extraction.subtotal.value,
    tax: extraction.tax.value,
    discount: extraction.discount.value,
    tip: extraction.tip.value,
    total: extraction.total.value,
    lineItems,
    fieldMeta,
    reconciliation: arithmetic.reconciliation,
  };
}
