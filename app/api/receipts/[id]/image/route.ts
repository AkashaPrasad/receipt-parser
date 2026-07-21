import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { AppError, errorResponse } from "@/lib/errors";
import { getReceiptImagePath } from "@/lib/db/receipts";
import { contentTypeForPath, imageRelPathToAbsolute } from "@/lib/pipeline/files";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const record = getReceiptImagePath(id);
    if (!record) {
      throw new AppError("NOT_FOUND", 404, "Receipt not found.");
    }

    const which = request.nextUrl.searchParams.get("which");
    const relPath = which === "secondary" ? record.secondaryImagePath : record.imagePath;
    if (!relPath) {
      throw new AppError("NOT_FOUND", 404, "Image not found.");
    }

    const absPath = imageRelPathToAbsolute(id, relPath);
    const data = await fs.readFile(absPath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentTypeForPath(relPath),
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return errorResponse(err instanceof Error ? err : new Error("Unknown error"));
  }
}
