import { describe, expect, it } from "vitest";
import { extractionResultSchema, salvageExtraction } from "@/lib/gemini/validation";

describe("extractionResultSchema", () => {
  it("accepts a well-formed extraction payload", () => {
    const payload = {
      document_type: "receipt",
      image_quality: "good",
      quality_issues: [],
      merchant: { value: "MIRA CAFE", confidence: "high" },
      purchase_date: { value: "2023-12-10", confidence: "high" },
      currency: "USD",
      line_items: [{ name: "Coffee", quantity: 1, amount: 4.5, confidence: "high" }],
      subtotal: { value: 4.5, confidence: "high" },
      tax: { value: 0.36, confidence: "high" },
      discount: { value: null, confidence: "high" },
      tip: { value: null, confidence: "high" },
      total: { value: 4.86, confidence: "high" },
    };
    const result = extractionResultSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("rejects a payload missing required fields", () => {
    const result = extractionResultSchema.safeParse({ document_type: "receipt" });
    expect(result.success).toBe(false);
  });
});

describe("salvageExtraction", () => {
  it("salvages individually valid fields and drops the rest to low-confidence null", () => {
    const malformed = {
      document_type: "receipt",
      image_quality: "good",
      quality_issues: [],
      merchant: { value: "Corner Store", confidence: "high" },
      purchase_date: { value: "not a real shape" }, // missing confidence -> should fail and fall back
      currency: "USD",
      line_items: "not an array",
      subtotal: { value: 10, confidence: "medium" },
      tax: { value: 1, confidence: "medium" },
      discount: null,
      tip: null,
      total: { value: 11, confidence: "medium" },
    };

    const salvaged = salvageExtraction(malformed);

    expect(salvaged.merchant).toEqual({ value: "Corner Store", confidence: "high" });
    expect(salvaged.purchase_date).toEqual({ value: null, confidence: "low" });
    expect(salvaged.line_items).toEqual([]);
    expect(salvaged.subtotal.value).toBe(10);
    expect(salvaged.total.value).toBe(11);
  });

  it("never throws on completely garbage input", () => {
    expect(() => salvageExtraction(null)).not.toThrow();
    expect(() => salvageExtraction("a string")).not.toThrow();
    expect(() => salvageExtraction(42)).not.toThrow();

    const salvaged = salvageExtraction("garbage");
    expect(salvaged.document_type).toBe("receipt");
    expect(salvaged.image_quality).toBe("unreadable");
    expect(salvaged.merchant.value).toBeNull();
  });
});
