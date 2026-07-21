import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { AppError, errorResponse } from "@/lib/errors";
import { validateUpload, processUpload } from "@/lib/pipeline/files";
import { extractReceipt } from "@/lib/pipeline/extract";
import { buildReceiptFromExtraction } from "@/lib/pipeline/build-receipt";
import { mergeLineItems, mergeScalarFields } from "@/lib/pipeline/merge";
import { checkArithmetic } from "@/lib/pipeline/checks";
import { getReceiptDetail, updateMergeResult } from "@/lib/db/receipts";
import { UPLOADS_DIR } from "@/lib/db/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const existing = getReceiptDetail(id);
    if (!existing) {
      throw new AppError("NOT_FOUND", 404, "Receipt not found.");
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      throw new AppError("VALIDATION_ERROR", 400, "No file was uploaded.");
    }
    validateUpload({ size: file.size, type: file.type });

    const buffer = Buffer.from(await file.arrayBuffer());
    const processed = await processUpload(buffer, file.type, id, "secondary");

    const { extraction } = await extractReceipt(processed.geminiBase64, processed.geminiMimeType);

    if (extraction.document_type === "not_a_document" || extraction.document_type === "other_document") {
      await fs.rm(path.join(UPLOADS_DIR, id), { recursive: true, force: true }).catch(() => {});
      const message =
        extraction.document_type === "not_a_document"
          ? "This doesn't look like a receipt. Try a clearer photo of the receipt itself."
          : "This looks like a different kind of document, not a receipt or invoice.";
      throw new AppError(extraction.document_type === "not_a_document" ? "NOT_A_RECEIPT" : "OTHER_DOCUMENT", 422, message);
    }

    const built = buildReceiptFromExtraction(extraction);

    const lineItemMerge = mergeLineItems(existing.lineItems, built.lineItems);
    const scalarMerge = mergeScalarFields(
      existing.fieldMeta,
      {
        merchant: existing.merchant,
        purchaseDate: existing.purchaseDate,
        subtotal: existing.subtotal,
        tax: existing.tax,
        discount: existing.discount,
        tip: existing.tip,
        total: existing.total,
      },
      built,
      lineItemMerge.addedNames
    );

    const currency = existing.currency ?? built.currency;

    const arithmetic = checkArithmetic({
      lineItemAmounts: lineItemMerge.items.map((li) => li.amount),
      tax: scalarMerge.values.tax,
      tip: scalarMerge.values.tip,
      discount: scalarMerge.values.discount,
      total: scalarMerge.values.total,
      currency,
    });

    const finalFieldMeta = scalarMerge.fieldMeta.map((meta) =>
      meta.field === "total" ? { ...meta, flagged: meta.flagged || !arithmetic.ok } : meta
    );

    const updated = updateMergeResult(id, {
      receipt: { ...scalarMerge.values, currency },
      secondaryImagePath: processed.displayImageRelPath,
      reconciliation: arithmetic.reconciliation,
      mergeReport: scalarMerge.report,
      fieldMeta: finalFieldMeta,
      lineItems: lineItemMerge.items,
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return errorResponse(err instanceof Error ? err : new Error("Unknown error"));
  }
}
