import { nanoid } from "nanoid";
import { getDb } from "./client";
import type {
  Confidence,
  CustomFields,
  DocumentType,
  FieldMetaRecord,
  ImageQuality,
  ImageSource,
  LineItemRecord,
  MergeReport,
  QualityIssue,
  Reconciliation,
  ReceiptDetail,
  ReceiptListItem,
  ReceiptRecord,
} from "../types";

function toBool(v: unknown): boolean {
  return v === 1 || v === true;
}

interface ReceiptRow {
  id: string;
  merchant: string | null;
  purchase_date: string | null;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  tip: number | null;
  total: number | null;
  currency: string | null;
  status: "parsed" | "corrected";
  image_path: string;
  secondary_image_path: string | null;
  active_image: ImageSource;
  raw_llm_json: string | null;
  document_type: DocumentType | null;
  image_quality: ImageQuality | null;
  quality_issues: string | null;
  retake_suggested: number;
  degraded: number;
  reconciliation: string | null;
  custom_fields: string | null;
  merge_report: string | null;
  created_at: string;
  updated_at: string;
}

function rowToReceipt(row: ReceiptRow): ReceiptRecord {
  return {
    id: row.id,
    merchant: row.merchant,
    purchaseDate: row.purchase_date,
    subtotal: row.subtotal,
    tax: row.tax,
    discount: row.discount,
    tip: row.tip,
    total: row.total,
    currency: row.currency,
    status: row.status,
    imagePath: row.image_path,
    secondaryImagePath: row.secondary_image_path,
    activeImage: row.active_image,
    rawLlmJson: row.raw_llm_json,
    documentType: row.document_type,
    imageQuality: row.image_quality,
    qualityIssues: row.quality_issues ? (JSON.parse(row.quality_issues) as QualityIssue[]) : [],
    retakeSuggested: toBool(row.retake_suggested),
    degraded: toBool(row.degraded),
    reconciliation: row.reconciliation ? (JSON.parse(row.reconciliation) as Reconciliation) : null,
    customFields: row.custom_fields ? (JSON.parse(row.custom_fields) as CustomFields) : {},
    mergeReport: row.merge_report ? (JSON.parse(row.merge_report) as MergeReport) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface LineItemRow {
  id: string;
  receipt_id: string;
  name: string;
  quantity: number | null;
  amount: number | null;
  confidence: Confidence;
  flagged: number;
  sort_order: number;
  user_edited: number;
  image_source: ImageSource;
}

function rowToLineItem(row: LineItemRow): LineItemRecord {
  return {
    id: row.id,
    receiptId: row.receipt_id,
    name: row.name,
    quantity: row.quantity,
    amount: row.amount,
    confidence: row.confidence,
    flagged: toBool(row.flagged),
    sortOrder: row.sort_order,
    userEdited: toBool(row.user_edited),
    imageSource: row.image_source,
  };
}

interface FieldMetaRow {
  receipt_id: string;
  field: string;
  confidence: Confidence;
  flagged: number;
  user_edited: number;
  image_source: ImageSource;
}

function rowToFieldMeta(row: FieldMetaRow): FieldMetaRecord {
  return {
    receiptId: row.receipt_id,
    field: row.field,
    confidence: row.confidence,
    flagged: toBool(row.flagged),
    userEdited: toBool(row.user_edited),
    imageSource: row.image_source,
  };
}

export interface NewLineItem {
  name: string;
  quantity: number | null;
  amount: number | null;
  confidence: Confidence;
  flagged: boolean;
}

export interface NewFieldMeta {
  field: string;
  confidence: Confidence;
  flagged: boolean;
}

export interface NewReceipt {
  merchant: string | null;
  purchaseDate: string | null;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  tip: number | null;
  total: number | null;
  currency: string | null;
  imagePath: string;
  rawLlmJson: string;
  documentType: DocumentType;
  imageQuality: ImageQuality;
  qualityIssues: QualityIssue[];
  retakeSuggested: boolean;
  degraded: boolean;
  reconciliation: Reconciliation | null;
  lineItems: NewLineItem[];
  fieldMeta: NewFieldMeta[];
}

export function createReceipt(id: string, input: NewReceipt): string {
  const db = getDb();
  const now = new Date().toISOString();

  const insert = db.transaction(() => {
    db.prepare(
      `INSERT INTO receipts (
        id, merchant, purchase_date, subtotal, tax, discount, tip, total, currency,
        status, image_path, raw_llm_json, document_type, image_quality, quality_issues,
        retake_suggested, degraded, reconciliation, custom_fields, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'parsed', ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)`
    ).run(
      id,
      input.merchant,
      input.purchaseDate,
      input.subtotal,
      input.tax,
      input.discount,
      input.tip,
      input.total,
      input.currency,
      input.imagePath,
      input.rawLlmJson,
      input.documentType,
      input.imageQuality,
      JSON.stringify(input.qualityIssues),
      input.retakeSuggested ? 1 : 0,
      input.degraded ? 1 : 0,
      input.reconciliation ? JSON.stringify(input.reconciliation) : null,
      now,
      now
    );

    const insertItem = db.prepare(
      `INSERT INTO line_items (id, receipt_id, name, quantity, amount, confidence, flagged, sort_order, image_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'primary')`
    );
    input.lineItems.forEach((item, idx) => {
      insertItem.run(nanoid(), id, item.name, item.quantity, item.amount, item.confidence, item.flagged ? 1 : 0, idx);
    });

    const insertMeta = db.prepare(
      `INSERT INTO field_meta (receipt_id, field, confidence, flagged, image_source)
       VALUES (?, ?, ?, ?, 'primary')`
    );
    input.fieldMeta.forEach((meta) => {
      insertMeta.run(id, meta.field, meta.confidence, meta.flagged ? 1 : 0);
    });
  });

  insert();
  return id;
}

export function listReceipts(): ReceiptListItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT r.id, r.merchant, r.purchase_date, r.total, r.currency, r.status, r.image_path, r.created_at,
              (
                SELECT COUNT(*) FROM line_items li WHERE li.receipt_id = r.id AND li.flagged = 1
              ) + (
                SELECT COUNT(*) FROM field_meta fm WHERE fm.receipt_id = r.id AND fm.flagged = 1
              ) AS flag_count,
              (
                SELECT COUNT(*) FROM line_items li WHERE li.receipt_id = r.id
              ) AS item_count
       FROM receipts r
       ORDER BY r.created_at DESC`
    )
    .all() as Array<{
    id: string;
    merchant: string | null;
    purchase_date: string | null;
    total: number | null;
    currency: string | null;
    status: "parsed" | "corrected";
    image_path: string;
    created_at: string;
    flag_count: number;
    item_count: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    merchant: row.merchant,
    purchaseDate: row.purchase_date,
    total: row.total,
    currency: row.currency,
    status: row.status,
    imagePath: row.image_path,
    flagCount: row.flag_count,
    itemCount: row.item_count,
    createdAt: row.created_at,
  }));
}

export function getReceiptDetail(id: string): ReceiptDetail | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM receipts WHERE id = ?`).get(id) as ReceiptRow | undefined;
  if (!row) return null;

  const itemRows = db
    .prepare(`SELECT * FROM line_items WHERE receipt_id = ? ORDER BY sort_order ASC`)
    .all(id) as LineItemRow[];
  const metaRows = db.prepare(`SELECT * FROM field_meta WHERE receipt_id = ?`).all(id) as FieldMetaRow[];

  const fieldMeta: Record<string, FieldMetaRecord> = {};
  for (const m of metaRows) {
    fieldMeta[m.field] = rowToFieldMeta(m);
  }

  return {
    ...rowToReceipt(row),
    lineItems: itemRows.map(rowToLineItem),
    fieldMeta,
  };
}

export function getReceiptImagePath(id: string): { imagePath: string; secondaryImagePath: string | null } | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT image_path, secondary_image_path FROM receipts WHERE id = ?`)
    .get(id) as { image_path: string; secondary_image_path: string | null } | undefined;
  if (!row) return null;
  return { imagePath: row.image_path, secondaryImagePath: row.secondary_image_path };
}

export interface CorrectionInput {
  merchant: string | null;
  purchaseDate: string | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  tip: number | null;
  total: number | null;
  customFields: CustomFields;
  lineItems: Array<{
    id?: string;
    name: string;
    quantity: number | null;
    amount: number | null;
  }>;
}

export function saveCorrection(
  id: string,
  input: CorrectionInput,
  recompute: (input: CorrectionInput) => {
    reconciliation: Reconciliation | null;
    flaggedFields: Set<string>;
    flaggedItemIndexes: Set<number>;
  }
): ReceiptDetail | null {
  const db = getDb();
  const existing = getReceiptDetail(id);
  if (!existing) return null;

  const { reconciliation, flaggedFields, flaggedItemIndexes } = recompute(input);
  const now = new Date().toISOString();

  const scalarFields: Array<[keyof CorrectionInput, unknown, unknown]> = [
    ["merchant", existing.merchant, input.merchant],
    ["purchaseDate", existing.purchaseDate, input.purchaseDate],
    ["currency", existing.currency, input.currency],
    ["subtotal", existing.subtotal, input.subtotal],
    ["tax", existing.tax, input.tax],
    ["discount", existing.discount, input.discount],
    ["tip", existing.tip, input.tip],
    ["total", existing.total, input.total],
  ];

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE receipts SET merchant = ?, purchase_date = ?, subtotal = ?, tax = ?, discount = ?, tip = ?,
       total = ?, currency = ?, custom_fields = ?, status = 'corrected', reconciliation = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      input.merchant,
      input.purchaseDate,
      input.subtotal,
      input.tax,
      input.discount,
      input.tip,
      input.total,
      input.currency,
      JSON.stringify(input.customFields ?? {}),
      reconciliation ? JSON.stringify(reconciliation) : null,
      now,
      id
    );

    const fieldNameMap: Record<string, string> = {
      merchant: "merchant",
      purchaseDate: "purchase_date",
      currency: "currency",
      subtotal: "subtotal",
      tax: "tax",
      discount: "discount",
      tip: "tip",
      total: "total",
    };

    for (const [key, oldVal, newVal] of scalarFields) {
      const field = fieldNameMap[key as string];
      const existingMeta = existing.fieldMeta[field];
      const changed = oldVal !== newVal;
      const userEdited = existingMeta?.userEdited || changed;
      const flagged = flaggedFields.has(field);
      db.prepare(
        `INSERT INTO field_meta (receipt_id, field, confidence, flagged, user_edited, image_source)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(receipt_id, field) DO UPDATE SET flagged = excluded.flagged, user_edited = excluded.user_edited`
      ).run(
        id,
        field,
        existingMeta?.confidence ?? "high",
        flagged ? 1 : 0,
        userEdited ? 1 : 0,
        existingMeta?.imageSource ?? "primary"
      );
    }

    db.prepare(`DELETE FROM line_items WHERE receipt_id = ?`).run(id);
    const insertItem = db.prepare(
      `INSERT INTO line_items (id, receipt_id, name, quantity, amount, confidence, flagged, sort_order, user_edited, image_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    input.lineItems.forEach((item, idx) => {
      const prior = item.id ? existing.lineItems.find((li) => li.id === item.id) : undefined;
      const changed =
        !prior || prior.name !== item.name || prior.quantity !== item.quantity || prior.amount !== item.amount;
      const userEdited = prior?.userEdited || changed || !prior;
      insertItem.run(
        item.id ?? nanoid(),
        id,
        item.name,
        item.quantity,
        item.amount,
        prior?.confidence ?? "high",
        flaggedItemIndexes.has(idx) ? 1 : 0,
        idx,
        userEdited ? 1 : 0,
        prior?.imageSource ?? "primary"
      );
    });
  });

  tx();
  return getReceiptDetail(id);
}

export function deleteReceipt(id: string): boolean {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM field_meta WHERE receipt_id = ?`).run(id);
    const result = db.prepare(`DELETE FROM receipts WHERE id = ?`).run(id);
    return result.changes > 0;
  });
  return tx();
}

export function updateMergeResult(
  id: string,
  data: {
    receipt: Partial<{
      merchant: string | null;
      purchaseDate: string | null;
      subtotal: number | null;
      tax: number | null;
      discount: number | null;
      tip: number | null;
      total: number | null;
      currency: string | null;
    }>;
    secondaryImagePath: string;
    reconciliation: Reconciliation | null;
    mergeReport: MergeReport;
    fieldMeta: Array<{
      field: string;
      confidence: Confidence;
      flagged: boolean;
      userEdited: boolean;
      imageSource: ImageSource;
    }>;
    lineItems: Array<NewLineItem & { userEdited: boolean; imageSource: ImageSource }>;
  }
): ReceiptDetail | null {
  const db = getDb();
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE receipts SET merchant = ?, purchase_date = ?, subtotal = ?, tax = ?, discount = ?, tip = ?,
       total = ?, currency = ?, secondary_image_path = ?, reconciliation = ?, merge_report = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      data.receipt.merchant ?? null,
      data.receipt.purchaseDate ?? null,
      data.receipt.subtotal ?? null,
      data.receipt.tax ?? null,
      data.receipt.discount ?? null,
      data.receipt.tip ?? null,
      data.receipt.total ?? null,
      data.receipt.currency ?? null,
      data.secondaryImagePath,
      data.reconciliation ? JSON.stringify(data.reconciliation) : null,
      JSON.stringify(data.mergeReport),
      now,
      id
    );

    const upsertMeta = db.prepare(
      `INSERT INTO field_meta (receipt_id, field, confidence, flagged, user_edited, image_source)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(receipt_id, field) DO UPDATE SET confidence = excluded.confidence, flagged = excluded.flagged,
         user_edited = excluded.user_edited, image_source = excluded.image_source`
    );
    for (const m of data.fieldMeta) {
      upsertMeta.run(id, m.field, m.confidence, m.flagged ? 1 : 0, m.userEdited ? 1 : 0, m.imageSource);
    }

    db.prepare(`DELETE FROM line_items WHERE receipt_id = ?`).run(id);
    const insertItem = db.prepare(
      `INSERT INTO line_items (id, receipt_id, name, quantity, amount, confidence, flagged, sort_order, user_edited, image_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    data.lineItems.forEach((item, idx) => {
      insertItem.run(
        nanoid(),
        id,
        item.name,
        item.quantity,
        item.amount,
        item.confidence,
        item.flagged ? 1 : 0,
        idx,
        item.userEdited ? 1 : 0,
        item.imageSource ?? "primary"
      );
    });
  });

  tx();
  return getReceiptDetail(id);
}
