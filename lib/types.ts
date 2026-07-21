export type Confidence = "high" | "medium" | "low";

export type DocumentType = "receipt" | "invoice" | "other_document" | "not_a_document";
export type ImageQuality = "good" | "poor_but_readable" | "unreadable";
export type QualityIssue = "blur" | "glare" | "cropped" | "faded" | "low_light";

export type ImageSource = "primary" | "secondary";

export interface FieldValue<T> {
  value: T | null;
  confidence: Confidence;
}

export interface Reconciliation {
  items_sum: number;
  computed_total: number;
  stated_total: number;
  delta: number;
}

export interface LineItemRecord {
  id: string;
  receiptId: string;
  name: string;
  quantity: number | null;
  amount: number | null;
  confidence: Confidence;
  flagged: boolean;
  sortOrder: number;
  userEdited: boolean;
  imageSource: ImageSource;
}

export interface FieldMetaRecord {
  receiptId: string;
  field: string;
  confidence: Confidence;
  flagged: boolean;
  userEdited: boolean;
  imageSource: ImageSource;
}

export type CustomFields = Record<string, string>;

export interface ReceiptRecord {
  id: string;
  merchant: string | null;
  purchaseDate: string | null;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  tip: number | null;
  total: number | null;
  currency: string | null;
  status: "parsed" | "corrected";
  imagePath: string;
  secondaryImagePath: string | null;
  activeImage: ImageSource;
  rawLlmJson: string | null;
  documentType: DocumentType | null;
  imageQuality: ImageQuality | null;
  qualityIssues: QualityIssue[];
  retakeSuggested: boolean;
  degraded: boolean;
  reconciliation: Reconciliation | null;
  customFields: CustomFields;
  mergeReport: MergeReport | null;
  createdAt: string;
  updatedAt: string;
}

export interface MergeReport {
  updatedFields: string[];
  keptFields: string[];
  unclearFields: string[];
  addedItems: string[];
}

export interface ReceiptDetail extends ReceiptRecord {
  lineItems: LineItemRecord[];
  fieldMeta: Record<string, FieldMetaRecord>;
}

export interface ReceiptListItem {
  id: string;
  merchant: string | null;
  purchaseDate: string | null;
  total: number | null;
  currency: string | null;
  status: "parsed" | "corrected";
  imagePath: string;
  flagCount: number;
  itemCount: number;
  createdAt: string;
}
