import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { z } from "zod";
import path from "node:path";
import { AppError, errorResponse } from "@/lib/errors";
import { deleteReceipt, getReceiptDetail, saveCorrection } from "@/lib/db/receipts";
import { recomputeCorrection } from "@/lib/pipeline/recompute";
import { UPLOADS_DIR } from "@/lib/db/client";

const correctionSchema = z.object({
  merchant: z.string().nullable(),
  purchaseDate: z.string().nullable(),
  currency: z.string().nullable(),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  discount: z.number().nullable(),
  tip: z.number().nullable(),
  total: z.number().nullable(),
  customFields: z.record(z.string(), z.string()),
  lineItems: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string(),
      quantity: z.number().nullable(),
      amount: z.number().nullable(),
    })
  ),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const detail = getReceiptDetail(id);
    if (!detail) {
      throw new AppError("NOT_FOUND", 404, "Receipt not found.");
    }
    return NextResponse.json(detail);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return errorResponse(err instanceof Error ? err : new Error("Unknown error"));
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const existing = getReceiptDetail(id);
    if (!existing) {
      throw new AppError("NOT_FOUND", 404, "Receipt not found.");
    }

    const body = await request.json();
    const parsed = correctionSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", 400, "Invalid correction payload.", parsed.error.issues);
    }

    const updated = saveCorrection(id, parsed.data, recomputeCorrection);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return errorResponse(err instanceof Error ? err : new Error("Unknown error"));
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const existing = getReceiptDetail(id);
    if (!existing) {
      throw new AppError("NOT_FOUND", 404, "Receipt not found.");
    }

    deleteReceipt(id);

    const receiptDir = path.join(UPLOADS_DIR, id);
    await fs.rm(receiptDir, { recursive: true, force: true });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return errorResponse(err instanceof Error ? err : new Error("Unknown error"));
  }
}
