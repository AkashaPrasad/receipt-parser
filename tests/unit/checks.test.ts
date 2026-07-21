import { describe, expect, it } from "vitest";
import {
  checkAmountSanity,
  checkArithmetic,
  checkDateSanity,
  checkQuantitySanity,
} from "@/lib/pipeline/checks";

describe("checkArithmetic", () => {
  it("reconciles when items + tax - discount + tip equals total exactly", () => {
    const result = checkArithmetic({
      lineItemAmounts: [9, 3.75],
      tax: 1.02,
      tip: null,
      discount: null,
      total: 13.77,
      currency: "USD",
    });
    expect(result.ok).toBe(true);
    expect(result.reconciliation).toBeNull();
  });

  it("tolerates rounding within +/-0.02", () => {
    const result = checkArithmetic({
      lineItemAmounts: [10],
      tax: 0,
      tip: null,
      discount: null,
      total: 10.02,
      currency: "USD",
    });
    expect(result.ok).toBe(true);
  });

  it("flags a mismatch beyond tolerance and reports the delta", () => {
    const result = checkArithmetic({
      lineItemAmounts: [50, 3.75],
      tax: 1.02,
      tip: null,
      discount: null,
      total: 13.77,
      currency: "USD",
    });
    expect(result.ok).toBe(false);
    expect(result.reconciliation).toEqual({
      items_sum: 53.75,
      computed_total: 54.77,
      stated_total: 13.77,
      delta: 41,
    });
  });

  it("applies discount by subtracting it from the computed total", () => {
    const result = checkArithmetic({
      lineItemAmounts: [20],
      tax: 0,
      tip: 0,
      discount: 5,
      total: 15,
      currency: "USD",
    });
    expect(result.ok).toBe(true);
  });

  it("uses a +/-1 unit tolerance for zero-decimal currencies", () => {
    const result = checkArithmetic({
      lineItemAmounts: [1000],
      tax: 0,
      tip: null,
      discount: null,
      total: 1001,
      currency: "JPY",
    });
    expect(result.ok).toBe(true);
  });

  it("skips the check entirely when there are no line items", () => {
    const result = checkArithmetic({
      lineItemAmounts: [],
      tax: 1,
      tip: null,
      discount: null,
      total: 100,
      currency: "USD",
    });
    expect(result.ok).toBe(true);
    expect(result.reconciliation).toBeNull();
  });
});

describe("checkDateSanity", () => {
  it("accepts a plausible past date", () => {
    expect(checkDateSanity("2023-12-10")).toBe(true);
  });

  it("rejects null", () => {
    expect(checkDateSanity(null)).toBe(false);
  });

  it("rejects unparseable strings", () => {
    expect(checkDateSanity("not-a-date")).toBe(false);
  });

  it("rejects dates before 1990", () => {
    expect(checkDateSanity("1985-01-01")).toBe(false);
  });

  it("rejects dates in the future", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(checkDateSanity(future.toISOString().slice(0, 10))).toBe(false);
  });
});

describe("checkAmountSanity", () => {
  it("allows null (field simply absent)", () => {
    expect(checkAmountSanity(null)).toBe(true);
  });

  it("allows zero and positive amounts", () => {
    expect(checkAmountSanity(0)).toBe(true);
    expect(checkAmountSanity(12.5)).toBe(true);
  });

  it("rejects negative amounts", () => {
    expect(checkAmountSanity(-1)).toBe(false);
  });
});

describe("checkQuantitySanity", () => {
  it("allows null", () => {
    expect(checkQuantitySanity(null)).toBe(true);
  });

  it("rejects zero or negative quantities", () => {
    expect(checkQuantitySanity(0)).toBe(false);
    expect(checkQuantitySanity(-2)).toBe(false);
  });

  it("allows positive quantities", () => {
    expect(checkQuantitySanity(3)).toBe(true);
  });
});
