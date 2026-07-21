import { callGemini } from "../gemini/client";
import { extractionResultSchema, salvageExtraction, type ValidatedExtraction } from "../gemini/validation";

export interface ExtractionOutcome {
  extraction: ValidatedExtraction;
  degraded: boolean;
}

function summarizeZodError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: Array<{ path: (string | number)[]; message: string }> }).issues;
    return issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }
  return "invalid response shape";
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Classification + extraction in a single Gemini call. On invalid output,
 * retries exactly once with the Zod error appended to the prompt. If the
 * retry also fails validation, salvages whatever fields parse individually
 * and returns degraded: true rather than erroring out.
 */
export async function extractReceipt(fileBase64: string, mimeType: string): Promise<ExtractionOutcome> {
  const firstText = await callGemini(fileBase64, mimeType);
  const firstJson = tryParseJson(firstText);
  const firstResult = extractionResultSchema.safeParse(firstJson);

  if (firstResult.success) {
    return { extraction: firstResult.data, degraded: false };
  }

  const retryText = await callGemini(fileBase64, mimeType, summarizeZodError(firstResult.error));
  const retryJson = tryParseJson(retryText);
  const retryResult = extractionResultSchema.safeParse(retryJson);

  if (retryResult.success) {
    return { extraction: retryResult.data, degraded: false };
  }

  return { extraction: salvageExtraction(retryJson ?? firstJson), degraded: true };
}
