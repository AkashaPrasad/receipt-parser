import type { ReceiptDetail, ReceiptListItem } from "./types";
import type { ErrorCode } from "./errors";

export class ApiError extends Error {
  code: ErrorCode;
  status: number;

  constructor(code: ErrorCode, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let code: ErrorCode = "INTERNAL_ERROR";
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error?.code) code = body.error.code;
      if (body?.error?.message) message = body.error.message;
    } catch {
      // response body wasn't JSON; fall back to the generic message
    }
    throw new ApiError(code, response.status, message);
  }
  return response.json() as Promise<T>;
}

export async function listReceipts(): Promise<ReceiptListItem[]> {
  const res = await fetch("/api/receipts");
  return parseJsonOrThrow(res);
}

export async function getReceipt(id: string): Promise<ReceiptDetail> {
  const res = await fetch(`/api/receipts/${id}`);
  return parseJsonOrThrow(res);
}

export async function uploadReceipt(file: File): Promise<ReceiptDetail> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/receipts/parse", { method: "POST", body: formData });
  return parseJsonOrThrow(res);
}

export interface CorrectionPayload {
  merchant: string | null;
  purchaseDate: string | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  tip: number | null;
  total: number | null;
  customFields: Record<string, string>;
  lineItems: Array<{ id?: string; name: string; quantity: number | null; amount: number | null }>;
}

export async function saveCorrection(id: string, payload: CorrectionPayload): Promise<ReceiptDetail> {
  const res = await fetch(`/api/receipts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function deleteReceipt(id: string): Promise<void> {
  const res = await fetch(`/api/receipts/${id}`, { method: "DELETE" });
  await parseJsonOrThrow(res);
}

export async function reparseReceipt(id: string, file: File): Promise<ReceiptDetail> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`/api/receipts/${id}/reparse`, { method: "POST", body: formData });
  return parseJsonOrThrow(res);
}
