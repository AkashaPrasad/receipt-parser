import { z } from "zod";

export const confidenceSchema = z.enum(["high", "medium", "low"]);

function fieldValueSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema.nullable(),
    confidence: confidenceSchema,
  });
}

export const lineItemSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable(),
  amount: z.number().nullable(),
  confidence: confidenceSchema,
});

export const extractionResultSchema = z.object({
  document_type: z.enum(["receipt", "invoice", "other_document", "not_a_document"]),
  image_quality: z.enum(["good", "poor_but_readable", "unreadable"]),
  quality_issues: z.array(z.enum(["blur", "glare", "cropped", "faded", "low_light"])),
  merchant: fieldValueSchema(z.string()),
  purchase_date: fieldValueSchema(z.string()),
  currency: z.string().nullable(),
  line_items: z.array(lineItemSchema),
  subtotal: fieldValueSchema(z.number()),
  tax: fieldValueSchema(z.number()),
  discount: fieldValueSchema(z.number()),
  tip: fieldValueSchema(z.number()),
  total: fieldValueSchema(z.number()),
});

export type ValidatedExtraction = z.infer<typeof extractionResultSchema>;

/**
 * Best-effort salvage: pull out any top-level field that parses on its own,
 * so a malformed response degrades to a mostly-empty, low-confidence receipt
 * rather than a dead end. Used only after the retry has already failed.
 */
export function salvageExtraction(raw: unknown): ValidatedExtraction {
  const fallbackField = () => ({ value: null, confidence: "low" as const });
  const obj = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;

  const salvageField = <T extends z.ZodTypeAny>(key: string, schema: T) => {
    const result = fieldValueSchema(schema).safeParse(obj[key]);
    return result.success ? result.data : fallbackField();
  };

  const lineItemsResult = z.array(lineItemSchema).safeParse(obj.line_items);
  const documentTypeResult = z
    .enum(["receipt", "invoice", "other_document", "not_a_document"])
    .safeParse(obj.document_type);
  const imageQualityResult = z.enum(["good", "poor_but_readable", "unreadable"]).safeParse(obj.image_quality);
  const qualityIssuesResult = z
    .array(z.enum(["blur", "glare", "cropped", "faded", "low_light"]))
    .safeParse(obj.quality_issues);
  const currencyResult = z.string().nullable().safeParse(obj.currency);

  return {
    document_type: documentTypeResult.success ? documentTypeResult.data : "receipt",
    image_quality: imageQualityResult.success ? imageQualityResult.data : "unreadable",
    quality_issues: qualityIssuesResult.success ? qualityIssuesResult.data : [],
    merchant: salvageField("merchant", z.string()),
    purchase_date: salvageField("purchase_date", z.string()),
    currency: currencyResult.success ? currencyResult.data : null,
    line_items: lineItemsResult.success ? lineItemsResult.data : [],
    subtotal: salvageField("subtotal", z.number()),
    tax: salvageField("tax", z.number()),
    discount: salvageField("discount", z.number()),
    tip: salvageField("tip", z.number()),
    total: salvageField("total", z.number()),
  };
}
