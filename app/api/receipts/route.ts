import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { listReceipts } from "@/lib/db/receipts";

export async function GET() {
  try {
    const receipts = listReceipts();
    return NextResponse.json(receipts);
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error("Unknown error"));
  }
}
