import type { NewFieldMeta, NewLineItem } from "../db/receipts";
import type { Confidence, FieldMetaRecord, ImageSource, LineItemRecord, MergeReport } from "../types";
import type { BuiltReceipt } from "./build-receipt";

export interface MergedField<T> {
  value: T | null;
  meta: {
    confidence: Confidence;
    flagged: boolean;
    userEdited: boolean;
    imageSource: ImageSource;
  };
  bucket: "updated" | "kept" | "unclear";
}

/**
 * Merge precedence for a single scalar field, highest wins:
 * 1. A field the user already corrected is never overwritten by a machine.
 * 2. The new parse if it's high-confidence and the old field was flagged/null.
 * 3. The old value if it was high-confidence and unflagged.
 * 4. Otherwise the new parse wins (better photo, presumably) but stays flagged.
 */
export function mergeField<T>(
  oldValue: T | null,
  oldMeta: FieldMetaRecord | undefined,
  newValue: T | null,
  newMeta: NewFieldMeta
): MergedField<T> {
  if (oldMeta?.userEdited) {
    return {
      value: oldValue,
      meta: {
        confidence: oldMeta.confidence,
        flagged: oldMeta.flagged,
        userEdited: true,
        imageSource: oldMeta.imageSource,
      },
      bucket: "kept",
    };
  }

  const oldFlaggedOrNull = !oldMeta || oldMeta.flagged || oldValue === null;
  if (newMeta.confidence === "high" && oldFlaggedOrNull) {
    return {
      value: newValue,
      meta: { confidence: newMeta.confidence, flagged: newMeta.flagged, userEdited: false, imageSource: "secondary" },
      bucket: "updated",
    };
  }

  if (oldMeta && oldMeta.confidence === "high" && !oldMeta.flagged) {
    return {
      value: oldValue,
      meta: {
        confidence: oldMeta.confidence,
        flagged: oldMeta.flagged,
        userEdited: false,
        imageSource: oldMeta.imageSource,
      },
      bucket: "kept",
    };
  }

  return {
    value: newValue,
    meta: { confidence: newMeta.confidence, flagged: true, userEdited: false, imageSource: "secondary" },
    bucket: "unclear",
  };
}

function normalizeTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function tokenSetRatio(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  return intersection / union.size;
}

function amountsClose(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return true;
  const tolerance = Math.max(0.02, Math.abs(a) * 0.05);
  return Math.abs(a - b) <= tolerance;
}

export interface MergedLineItem extends NewLineItem {
  userEdited: boolean;
  imageSource: ImageSource;
}

export interface LineItemMergeResult {
  items: MergedLineItem[];
  addedNames: string[];
}

const NAME_SIMILARITY_THRESHOLD = 0.8;

/**
 * Matches old and new line items by normalized name similarity (token-set
 * ratio) plus amount proximity, then applies the same merge precedence as
 * scalar fields. Unmatched new items are added (flagged); unmatched old
 * items are kept only if the user had already edited them.
 */
export function mergeLineItems(oldItems: LineItemRecord[], newItems: NewLineItem[]): LineItemMergeResult {
  const oldTokens = oldItems.map((it) => normalizeTokens(it.name));
  const newTokens = newItems.map((it) => normalizeTokens(it.name));

  const candidates: Array<{ oldIdx: number; newIdx: number; score: number }> = [];
  oldItems.forEach((oldItem, oldIdx) => {
    newItems.forEach((newItem, newIdx) => {
      const sim = tokenSetRatio(oldTokens[oldIdx], newTokens[newIdx]);
      if (sim >= NAME_SIMILARITY_THRESHOLD && amountsClose(oldItem.amount, newItem.amount)) {
        candidates.push({ oldIdx, newIdx, score: sim });
      }
    });
  });
  candidates.sort((a, b) => b.score - a.score);

  const matchedOld = new Set<number>();
  const matchedNew = new Set<number>();
  const pairs: Array<{ oldIdx: number; newIdx: number }> = [];
  for (const c of candidates) {
    if (matchedOld.has(c.oldIdx) || matchedNew.has(c.newIdx)) continue;
    matchedOld.add(c.oldIdx);
    matchedNew.add(c.newIdx);
    pairs.push({ oldIdx: c.oldIdx, newIdx: c.newIdx });
  }

  const items: MergedLineItem[] = [];

  for (const { oldIdx, newIdx } of pairs) {
    const oldItem = oldItems[oldIdx];
    const newItem = newItems[newIdx];

    if (oldItem.userEdited) {
      items.push({
        name: oldItem.name,
        quantity: oldItem.quantity,
        amount: oldItem.amount,
        confidence: oldItem.confidence,
        flagged: oldItem.flagged,
        userEdited: true,
        imageSource: oldItem.imageSource,
      });
      continue;
    }

    const oldFlaggedOrNull = oldItem.flagged || oldItem.amount === null;
    if (newItem.confidence === "high" && oldFlaggedOrNull) {
      items.push({ ...newItem, userEdited: false, imageSource: "secondary" });
    } else if (oldItem.confidence === "high" && !oldItem.flagged) {
      items.push({
        name: oldItem.name,
        quantity: oldItem.quantity,
        amount: oldItem.amount,
        confidence: oldItem.confidence,
        flagged: oldItem.flagged,
        userEdited: false,
        imageSource: oldItem.imageSource,
      });
    } else {
      items.push({ ...newItem, flagged: true, userEdited: false, imageSource: "secondary" });
    }
  }

  oldItems.forEach((oldItem, idx) => {
    if (!matchedOld.has(idx) && oldItem.userEdited) {
      items.push({
        name: oldItem.name,
        quantity: oldItem.quantity,
        amount: oldItem.amount,
        confidence: oldItem.confidence,
        flagged: oldItem.flagged,
        userEdited: true,
        imageSource: oldItem.imageSource,
      });
    }
  });

  const addedNames: string[] = [];
  newItems.forEach((newItem, idx) => {
    if (!matchedNew.has(idx)) {
      items.push({ ...newItem, flagged: true, userEdited: false, imageSource: "secondary" });
      addedNames.push(newItem.name);
    }
  });

  return { items, addedNames };
}

export interface ScalarMergeOutput {
  values: {
    merchant: string | null;
    purchaseDate: string | null;
    subtotal: number | null;
    tax: number | null;
    discount: number | null;
    tip: number | null;
    total: number | null;
  };
  fieldMeta: Array<{
    field: string;
    confidence: Confidence;
    flagged: boolean;
    userEdited: boolean;
    imageSource: ImageSource;
  }>;
  report: MergeReport;
}

export function mergeScalarFields(
  existingFieldMeta: Record<string, FieldMetaRecord>,
  existingValues: {
    merchant: string | null;
    purchaseDate: string | null;
    subtotal: number | null;
    tax: number | null;
    discount: number | null;
    tip: number | null;
    total: number | null;
  },
  built: BuiltReceipt,
  addedItemNames: string[]
): ScalarMergeOutput {
  const fieldDefs: Array<{ key: keyof ScalarMergeOutput["values"]; field: string; newValue: number | string | null; newMeta: NewFieldMeta }> =
    built.fieldMeta.map((meta) => {
      const key = (meta.field === "purchase_date" ? "purchaseDate" : meta.field) as keyof ScalarMergeOutput["values"];
      const newValue = (built as unknown as Record<string, number | string | null>)[key];
      return { key, field: meta.field, newValue, newMeta: meta };
    });

  const values = { ...existingValues };
  const fieldMeta: ScalarMergeOutput["fieldMeta"] = [];
  const report: MergeReport = { updatedFields: [], keptFields: [], unclearFields: [], addedItems: addedItemNames };

  for (const def of fieldDefs) {
    const oldValue = existingValues[def.key];
    const merged = mergeField(oldValue, existingFieldMeta[def.field], def.newValue, def.newMeta);
    (values as Record<string, unknown>)[def.key] = merged.value;
    fieldMeta.push({ field: def.field, ...merged.meta });
    if (merged.bucket === "updated") report.updatedFields.push(def.field);
    else if (merged.bucket === "kept") report.keptFields.push(def.field);
    else report.unclearFields.push(def.field);
  }

  return { values, fieldMeta, report };
}
