import type { Reconciliation } from "../types";

// ISO 4217 currencies with no minor unit (zero decimal places).
const ZERO_DECIMAL_CURRENCIES = new Set([
  "JPY",
  "KRW",
  "VND",
  "CLP",
  "ISK",
  "HUF",
  "TWD",
  "UGX",
  "PYG",
  "RWF",
  "BIF",
  "XAF",
  "XOF",
  "XPF",
  "GNF",
  "MGA",
  "KMF",
  "DJF",
  "VUV",
]);

export interface ArithmeticCheckInput {
  lineItemAmounts: Array<number | null>;
  tax: number | null;
  tip: number | null;
  discount: number | null;
  total: number | null;
  currency: string | null;
}

export interface ArithmeticCheckResult {
  ok: boolean;
  reconciliation: Reconciliation | null;
}

/**
 * sum(line_items) + tax + tip - discount vs total, tolerance +/-0.02
 * (or +/-1 currency unit for zero-decimal currencies).
 */
export function checkArithmetic(input: ArithmeticCheckInput): ArithmeticCheckResult {
  const { lineItemAmounts, tax, tip, discount, total, currency } = input;

  if (total === null || lineItemAmounts.length === 0) {
    return { ok: true, reconciliation: null };
  }

  const itemsSum = lineItemAmounts.reduce((acc: number, v) => acc + (v ?? 0), 0);
  const computedTotal = itemsSum + (tax ?? 0) + (tip ?? 0) - (discount ?? 0);
  const delta = computedTotal - total;

  const tolerance = currency && ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 0.02;
  const ok = Math.abs(delta) <= tolerance;

  return {
    ok,
    reconciliation: ok
      ? null
      : {
          items_sum: round2(itemsSum),
          computed_total: round2(computedTotal),
          stated_total: round2(total),
          delta: round2(delta),
        },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const MIN_YEAR = 1990;

export function checkDateSanity(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  if (date.getFullYear() < MIN_YEAR) return false;
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (date.getTime() >= endOfToday.getTime()) return false;
  return true;
}

export function checkAmountSanity(amount: number | null): boolean {
  if (amount === null) return true;
  return amount >= 0;
}

export function checkQuantitySanity(quantity: number | null): boolean {
  if (quantity === null) return true;
  return quantity > 0;
}
