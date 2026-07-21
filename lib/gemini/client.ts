import { GoogleGenAI } from "@google/genai";
import { AppError } from "../errors";
import { extractionResponseSchema } from "./schema";
import { SYSTEM_PROMPT, buildRetryPrompt } from "./prompt";

const TIMEOUT_MS = 45_000;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError(
      "CONFIG_ERROR",
      500,
      "GEMINI_API_KEY is not set. Check your .env file (see .env.example)."
    );
  }
  return new GoogleGenAI({ apiKey });
}

function getModel(): string {
  return process.env.GEMINI_MODEL || "gemini-3.5-flash";
}

function isRetryableStatus(status: number | undefined): boolean {
  return status === 429 || (status !== undefined && status >= 500);
}

function isAuthStatus(status: number | undefined): boolean {
  return status === 401 || status === 403;
}

function extractStatus(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const anyErr = err as { status?: number; code?: number };
    return anyErr.status ?? anyErr.code;
  }
  return undefined;
}

async function callOnce(
  client: GoogleGenAI,
  fileBase64: string,
  mimeType: string,
  promptSuffix?: string
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await client.models.generateContent({
      model: getModel(),
      contents: [
        {
          role: "user",
          parts: [
            { text: promptSuffix ? `${SYSTEM_PROMPT}\n\n${promptSuffix}` : SYSTEM_PROMPT },
            { inlineData: { mimeType, data: fileBase64 } },
          ],
        },
      ],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: extractionResponseSchema,
        abortSignal: controller.signal,
      },
    });

    const text = response.text;
    if (!text) {
      throw new AppError("UPSTREAM_ERROR", 502, "Gemini returned an empty response.");
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Calls Gemini once, retrying transient (429/5xx/timeout) failures once with
 * a short backoff. Auth failures and other errors are not retried.
 */
export async function callGemini(
  fileBase64: string,
  mimeType: string,
  promptSuffix?: string
): Promise<string> {
  const client = getClient();

  try {
    return await callOnce(client, fileBase64, mimeType, promptSuffix);
  } catch (err) {
    if (err instanceof AppError) throw err;

    const status = extractStatus(err);
    if (isAuthStatus(status)) {
      throw new AppError(
        "CONFIG_ERROR",
        500,
        "Gemini rejected the API key (401/403). Check GEMINI_API_KEY in your .env file."
      );
    }

    const isAbort = err instanceof Error && err.name === "AbortError";
    if (isRetryableStatus(status) || isAbort) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        return await callOnce(client, fileBase64, mimeType, promptSuffix);
      } catch (retryErr) {
        throw new AppError(
          "UPSTREAM_ERROR",
          502,
          "Gemini is temporarily unavailable. Please try again.",
          retryErr instanceof Error ? retryErr.message : undefined
        );
      }
    }

    throw new AppError(
      "UPSTREAM_ERROR",
      502,
      "Gemini request failed.",
      err instanceof Error ? err.message : undefined
    );
  }
}

export function buildRetrySuffix(zodErrorSummary: string): string {
  return buildRetryPrompt(zodErrorSummary);
}
