import { describe, expect, it } from "vitest";
import { mergeField, mergeLineItems } from "@/lib/pipeline/merge";
import type { FieldMetaRecord, LineItemRecord } from "@/lib/types";
import type { NewFieldMeta, NewLineItem } from "@/lib/db/receipts";

function fieldMeta(overrides: Partial<FieldMetaRecord> = {}): FieldMetaRecord {
  return {
    receiptId: "r1",
    field: "total",
    confidence: "high",
    flagged: false,
    userEdited: false,
    imageSource: "primary",
    ...overrides,
  };
}

function newMeta(overrides: Partial<NewFieldMeta> = {}): NewFieldMeta {
  return { field: "total", confidence: "high", flagged: false, ...overrides };
}

describe("mergeField precedence", () => {
  it("never overwrites a field the user already corrected", () => {
    const result = mergeField(
      "User Value",
      fieldMeta({ userEdited: true, confidence: "low", flagged: true }),
      "New Parse Value",
      newMeta({ confidence: "high" })
    );
    expect(result.bucket).toBe("kept");
    expect(result.value).toBe("User Value");
    expect(result.meta.userEdited).toBe(true);
  });

  it("takes the new high-confidence value when the old field was flagged", () => {
    const result = mergeField(
      "Old",
      fieldMeta({ flagged: true }),
      "New",
      newMeta({ confidence: "high" })
    );
    expect(result.bucket).toBe("updated");
    expect(result.value).toBe("New");
    expect(result.meta.imageSource).toBe("secondary");
  });

  it("takes the new high-confidence value when the old field was null", () => {
    const result = mergeField<string>(null, undefined, "New", newMeta({ confidence: "high" }));
    expect(result.bucket).toBe("updated");
    expect(result.value).toBe("New");
  });

  it("keeps the old value when it was high-confidence and unflagged", () => {
    const result = mergeField(
      "Old",
      fieldMeta({ confidence: "high", flagged: false }),
      "New",
      newMeta({ confidence: "medium" })
    );
    expect(result.bucket).toBe("kept");
    expect(result.value).toBe("Old");
  });

  it("falls back to the new parse but stays flagged when neither side is trustworthy", () => {
    const result = mergeField(
      "Old",
      fieldMeta({ confidence: "medium", flagged: true }),
      "New",
      newMeta({ confidence: "medium" })
    );
    expect(result.bucket).toBe("unclear");
    expect(result.value).toBe("New");
    expect(result.meta.flagged).toBe(true);
  });
});

function lineItem(overrides: Partial<LineItemRecord> = {}): LineItemRecord {
  return {
    id: "li1",
    receiptId: "r1",
    name: "Coffee",
    quantity: 1,
    amount: 4.5,
    confidence: "high",
    flagged: false,
    sortOrder: 0,
    userEdited: false,
    imageSource: "primary",
    ...overrides,
  };
}

function newItem(overrides: Partial<NewLineItem> = {}): NewLineItem {
  return { name: "Coffee", quantity: 1, amount: 4.5, confidence: "high", flagged: false, ...overrides };
}

describe("mergeLineItems", () => {
  it("matches items by normalized name (case/punctuation) and amount proximity, preferring the new high-confidence data", () => {
    const result = mergeLineItems(
      [lineItem({ name: "cappuccino!", amount: 9, flagged: true })],
      [newItem({ name: "Cappuccino", amount: 9.0, confidence: "high" })]
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("Cappuccino");
    expect(result.items[0].imageSource).toBe("secondary");
    expect(result.addedNames).toEqual([]);
  });

  it("never overwrites a matched user-edited old item even when the new photo reads it differently", () => {
    const result = mergeLineItems(
      [lineItem({ name: "Cappuccino", amount: 9, userEdited: true })],
      [newItem({ name: "Cappuccino", amount: 9.2, confidence: "high" })]
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].amount).toBe(9);
    expect(result.items[0].userEdited).toBe(true);
  });

  it("keeps both when a user-edited item's amount has diverged too far from the new photo to match", () => {
    const result = mergeLineItems(
      [lineItem({ name: "Cappuccino", amount: 9, userEdited: true })],
      [newItem({ name: "Cappuccino", amount: 12, confidence: "high" })]
    );
    // amount too far off to match as the same line -> old edit is preserved
    // unmatched, and the new reading is surfaced as its own flagged item
    // rather than silently overwriting or dropping either.
    expect(result.items).toHaveLength(2);
    expect(result.items.some((it) => it.userEdited && it.amount === 9)).toBe(true);
    expect(result.items.some((it) => !it.userEdited && it.amount === 12 && it.flagged)).toBe(true);
  });

  it("drops unmatched old items that were never user-edited", () => {
    const result = mergeLineItems([lineItem({ name: "Old Thing", amount: 1 })], []);
    expect(result.items).toHaveLength(0);
  });

  it("keeps unmatched old items that the user edited", () => {
    const result = mergeLineItems([lineItem({ name: "Old Thing", amount: 1, userEdited: true })], []);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("Old Thing");
  });

  it("adds unmatched new items as flagged, sourced from the secondary image", () => {
    const result = mergeLineItems([], [newItem({ name: "Milk", amount: 3.99 })]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].flagged).toBe(true);
    expect(result.items[0].imageSource).toBe("secondary");
    expect(result.addedNames).toEqual(["Milk"]);
  });

  it("does not match items whose names are unrelated even if amounts coincide", () => {
    const result = mergeLineItems(
      [lineItem({ name: "Almond Croissant", amount: 3.75 })],
      [newItem({ name: "Bread", amount: 3.75 })]
    );
    // no name overlap -> no match -> old (unedited) dropped, new added
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("Bread");
    expect(result.addedNames).toEqual(["Bread"]);
  });
});
