export const migrations: string[] = [
  // 1. initial schema
  `
  CREATE TABLE IF NOT EXISTS receipts (
    id            TEXT PRIMARY KEY,
    merchant      TEXT,
    purchase_date TEXT,
    subtotal      REAL,
    tax           REAL,
    discount      REAL,
    tip           REAL,
    total         REAL,
    currency      TEXT,
    status        TEXT NOT NULL,
    image_path    TEXT NOT NULL,
    raw_llm_json  TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS line_items (
    id          TEXT PRIMARY KEY,
    receipt_id  TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    quantity    REAL,
    amount      REAL,
    confidence  TEXT NOT NULL,
    flagged     INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS field_meta (
    receipt_id  TEXT NOT NULL,
    field       TEXT NOT NULL,
    confidence  TEXT NOT NULL,
    flagged     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (receipt_id, field)
  );

  CREATE INDEX IF NOT EXISTS idx_line_items_receipt ON line_items(receipt_id);
  `,
  // 2. quality metadata + reconciliation + custom fields + reupload support
  `
  ALTER TABLE receipts ADD COLUMN document_type TEXT;
  ALTER TABLE receipts ADD COLUMN image_quality TEXT;
  ALTER TABLE receipts ADD COLUMN quality_issues TEXT;
  ALTER TABLE receipts ADD COLUMN retake_suggested INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE receipts ADD COLUMN degraded INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE receipts ADD COLUMN reconciliation TEXT;
  ALTER TABLE receipts ADD COLUMN custom_fields TEXT;
  ALTER TABLE receipts ADD COLUMN active_image TEXT NOT NULL DEFAULT 'primary';
  ALTER TABLE receipts ADD COLUMN secondary_image_path TEXT;
  ALTER TABLE receipts ADD COLUMN merge_report TEXT;

  ALTER TABLE line_items ADD COLUMN user_edited INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE line_items ADD COLUMN image_source TEXT NOT NULL DEFAULT 'primary';

  ALTER TABLE field_meta ADD COLUMN user_edited INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE field_meta ADD COLUMN image_source TEXT NOT NULL DEFAULT 'primary';
  `,
];
