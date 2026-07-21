import type { Confidence, CustomFields, ImageSource } from "./types";

export interface LineItemDraft {
  key: string;
  id?: string;
  name: string;
  quantity: number | null;
  amount: number | null;
  flagged: boolean;
  confidence: Confidence;
  imageSource: ImageSource;
}

export interface ReceiptDraft {
  merchant: string | null;
  purchaseDate: string | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  tip: number | null;
  total: number | null;
  customFields: CustomFields;
  lineItems: LineItemDraft[];
}

export function flagReason(item: { confidence: Confidence; amount: number | null; quantity: number | null }): string {
  if (item.amount === null) return "Not found on receipt";
  if (item.amount < 0) return "Negative amount";
  if (item.quantity !== null && item.quantity <= 0) return "Invalid quantity";
  if (item.confidence === "low") return "Model confidence low";
  return "Doesn't match total";
}
