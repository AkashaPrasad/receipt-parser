import { NextResponse } from "next/server";

export type ErrorCode =
  | "NOT_A_RECEIPT"
  | "OTHER_DOCUMENT"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE_TYPE"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UPSTREAM_ERROR"
  | "CONFIG_ERROR"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ErrorCode, status: number, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function errorResponse(error: AppError | Error): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status }
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: error.message } },
    { status: 500 }
  );
}
