import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { pdf } from "pdf-to-img";
import { AppError } from "../errors";
import { UPLOADS_DIR } from "../db/client";
import { MAX_UPLOAD_BYTES, ACCEPTED_MIME_TYPES } from "../upload-constraints";

const ACCEPTED_MIME_TYPE_SET = new Set<string>(ACCEPTED_MIME_TYPES);

export function validateUpload(file: { size: number; type: string }): void {
  if (!ACCEPTED_MIME_TYPE_SET.has(file.type)) {
    throw new AppError(
      "UNSUPPORTED_FILE_TYPE",
      400,
      "Unsupported file type. Please upload a JPG, PNG, WEBP, HEIC, or PDF."
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AppError("FILE_TOO_LARGE", 413, "File is larger than the 15 MB limit.");
  }
}

export interface ProcessedUpload {
  /** Base64-encoded bytes to send to Gemini. */
  geminiBase64: string;
  /** MIME type to send to Gemini alongside geminiBase64. */
  geminiMimeType: string;
  /** Path (relative to the uploads dir) of the PNG/JPEG used for on-screen display. */
  displayImageRelPath: string;
}

/**
 * Persists an uploaded file to disk under data/uploads/<receiptId>/<slot>*,
 * converting HEIC to PNG and rasterizing PDF page 1 to PNG for display.
 * Returns what's needed to both call Gemini and serve the review-UI image.
 */
export async function processUpload(
  buffer: Buffer,
  mimeType: string,
  receiptId: string,
  slot: "primary" | "secondary"
): Promise<ProcessedUpload> {
  const dir = path.join(UPLOADS_DIR, receiptId);
  await fs.mkdir(dir, { recursive: true });

  if (mimeType === "application/pdf") {
    const pdfRelPath = `${slot}.pdf`;
    await fs.writeFile(path.join(dir, pdfRelPath), buffer);

    const doc = await pdf(buffer, { scale: 2 });
    const pageBuffer = await doc.getPage(1);
    const displayRelPath = `${slot}-page1.png`;
    await fs.writeFile(path.join(dir, displayRelPath), pageBuffer);

    return {
      geminiBase64: buffer.toString("base64"),
      geminiMimeType: "application/pdf",
      displayImageRelPath: displayRelPath,
    };
  }

  if (mimeType === "image/heic" || mimeType === "image/heif") {
    const pngBuffer = await sharp(buffer).png().toBuffer();
    const displayRelPath = `${slot}.png`;
    await fs.writeFile(path.join(dir, displayRelPath), pngBuffer);

    return {
      geminiBase64: pngBuffer.toString("base64"),
      geminiMimeType: "image/png",
      displayImageRelPath: displayRelPath,
    };
  }

  const ext = mimeType.split("/")[1];
  const displayRelPath = `${slot}.${ext}`;
  await fs.writeFile(path.join(dir, displayRelPath), buffer);

  return {
    geminiBase64: buffer.toString("base64"),
    geminiMimeType: mimeType,
    displayImageRelPath: displayRelPath,
  };
}

export function imageRelPathToAbsolute(receiptId: string, relPath: string): string {
  return path.join(UPLOADS_DIR, receiptId, relPath);
}

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export function contentTypeForPath(relPath: string): string {
  const ext = path.extname(relPath).toLowerCase();
  return CONTENT_TYPES[ext] || "application/octet-stream";
}
