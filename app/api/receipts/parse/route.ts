import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { AppError, errorResponse } from "@/lib/errors";
import { validateUpload, processUpload } from "@/lib/pipeline/files";
import { extractReceipt } from "@/lib/pipeline/extract";
import { buildReceiptFromExtraction } from "@/lib/pipeline/build-receipt";
import { createReceipt, getReceiptDetail } from "@/lib/db/receipts";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      throw new AppError("VALIDATION_ERROR", 400, "No file was uploaded.");
    }

    validateUpload({ size: file.size, type: file.type });

    const receiptId = nanoid();
    const buffer = Buffer.from(await file.arrayBuffer());
    const processed = await processUpload(buffer, file.type, receiptId, "primary");

    const { extraction, degraded } = await extractReceipt(processed.geminiBase64, processed.geminiMimeType);

    if (extraction.document_type === "not_a_document") {
      throw new AppError(
        "NOT_A_RECEIPT",
        422,
        "This doesn't look like a receipt. Try a clearer photo of the receipt itself."
      );
    }
    if (extraction.document_type === "other_document") {
      throw new AppError(
        "OTHER_DOCUMENT",
        422,
        "This looks like a different kind of document, not a receipt or invoice."
      );
    }

    const built = buildReceiptFromExtraction(extraction);

    createReceipt(receiptId, {
      merchant: built.merchant,
      purchaseDate: built.purchaseDate,
      subtotal: built.subtotal,
      tax: built.tax,
      discount: built.discount,
      tip: built.tip,
      total: built.total,
      currency: built.currency,
      imagePath: processed.displayImageRelPath,
      rawLlmJson: JSON.stringify(extraction),
      documentType: extraction.document_type,
      imageQuality: extraction.image_quality,
      qualityIssues: extraction.quality_issues,
      retakeSuggested: extraction.image_quality === "unreadable",
      degraded,
      reconciliation: built.reconciliation,
      lineItems: built.lineItems,
      fieldMeta: built.fieldMeta,
    });

    const detail = getReceiptDetail(receiptId);
    return NextResponse.json(detail, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return errorResponse(err instanceof Error ? err : new Error("Unknown error"));
  }
}
