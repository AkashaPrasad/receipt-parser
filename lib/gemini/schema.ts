import { Type, type Schema } from "@google/genai";

function fieldValueSchema(valueType: Type, description: string): Schema {
  return {
    type: Type.OBJECT,
    description,
    properties: {
      value: { type: valueType, nullable: true },
      confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
    },
    required: ["value", "confidence"],
  };
}

export const extractionResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    document_type: {
      type: Type.STRING,
      enum: ["receipt", "invoice", "other_document", "not_a_document"],
    },
    image_quality: {
      type: Type.STRING,
      enum: ["good", "poor_but_readable", "unreadable"],
    },
    quality_issues: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: ["blur", "glare", "cropped", "faded", "low_light"] },
    },
    merchant: fieldValueSchema(Type.STRING, "Business name as printed on the receipt"),
    purchase_date: fieldValueSchema(Type.STRING, "ISO 8601 date (YYYY-MM-DD)"),
    currency: { type: Type.STRING, nullable: true, description: "ISO 4217 currency code" },
    line_items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          quantity: { type: Type.NUMBER, nullable: true },
          amount: { type: Type.NUMBER, nullable: true },
          confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
        },
        required: ["name", "quantity", "amount", "confidence"],
      },
    },
    subtotal: fieldValueSchema(Type.NUMBER, "Sum before tax/tip, as printed"),
    tax: fieldValueSchema(Type.NUMBER, "Total tax amount"),
    discount: fieldValueSchema(Type.NUMBER, "Total discount amount, stored positive"),
    tip: fieldValueSchema(Type.NUMBER, "Tip/gratuity amount"),
    total: fieldValueSchema(Type.NUMBER, "Final amount paid, not the subtotal"),
  },
  required: [
    "document_type",
    "image_quality",
    "quality_issues",
    "merchant",
    "purchase_date",
    "currency",
    "line_items",
    "subtotal",
    "tax",
    "discount",
    "tip",
    "total",
  ],
};
