"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { NavHeader } from "@/components/nav-header";
import { StatusBadge, FlagBadge } from "@/components/status-badge";
import { EditableField } from "@/components/editable-field";
import { LineItemsEditor } from "@/components/line-items-editor";
import { ReconciliationBanner } from "@/components/reconciliation-banner";
import { CustomFieldsEditor } from "@/components/custom-fields-editor";
import { SaveBar } from "@/components/save-bar";
import { ReceiptImagePane } from "@/components/receipt-image-pane";
import { DeleteReceiptDialog } from "@/components/delete-receipt-dialog";
import { ReuploadDialog } from "@/components/reupload-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Trash2, RefreshCw } from "lucide-react";
import { getReceipt, saveCorrection as apiSaveCorrection, ApiError } from "@/lib/api-client";
import { checkArithmetic, checkAmountSanity, checkDateSanity } from "@/lib/pipeline/checks";
import type { ReceiptDetail } from "@/lib/types";
import type { ReceiptDraft } from "@/lib/draft-types";

function toDraft(receipt: ReceiptDetail): ReceiptDraft {
  return {
    merchant: receipt.merchant,
    purchaseDate: receipt.purchaseDate,
    currency: receipt.currency,
    subtotal: receipt.subtotal,
    tax: receipt.tax,
    discount: receipt.discount,
    tip: receipt.tip,
    total: receipt.total,
    customFields: receipt.customFields,
    lineItems: receipt.lineItems.map((li) => ({
      key: li.id,
      id: li.id,
      name: li.name,
      quantity: li.quantity,
      amount: li.amount,
      flagged: li.flagged,
      confidence: li.confidence,
      imageSource: li.imageSource,
    })),
  };
}

export default function ReceiptDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [notFound, setNotFoundState] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reuploadOpen, setReuploadOpen] = useState(false);
  const [imageSource, setImageSource] = useState<"primary" | "secondary">("primary");

  const load = useCallback(() => {
    getReceipt(id)
      .then((r) => {
        setReceipt(r);
        setDraft(toDraft(r));
        setImageSource(r.activeImage);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFoundState(true);
        else setLoadError(true);
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!receipt || !draft) return false;
    return JSON.stringify(toDraft(receipt)) !== JSON.stringify(draft);
  }, [receipt, draft]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const liveArithmetic = useMemo(() => {
    if (!draft) return null;
    return checkArithmetic({
      lineItemAmounts: draft.lineItems.map((li) => li.amount),
      tax: draft.tax,
      tip: draft.tip,
      discount: draft.discount,
      total: draft.total,
      currency: draft.currency,
    });
  }, [draft]);

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col">
        <NavHeader />
        <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-lg font-semibold">Receipt not found</h1>
          <p className="text-sm text-muted-foreground">
            This receipt may have been deleted, or the link is incorrect.
          </p>
          <Button render={<Link href="/receipts">Back to all receipts</Link>} />
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col">
        <NavHeader />
        <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-lg font-semibold">Couldn&apos;t load this receipt</h1>
          <Button onClick={load}>Try again</Button>
        </main>
      </div>
    );
  }

  if (!receipt || !draft) {
    return (
      <div className="flex min-h-screen flex-col">
        <NavHeader />
        <main className="mx-auto grid max-w-5xl flex-1 grid-cols-2 gap-6 px-6 py-8">
          <Skeleton className="h-[600px] w-full" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </main>
      </div>
    );
  }

  function updateDraft(patch: Partial<ReceiptDraft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  function isFieldFlagged(field: string, liveFail: boolean): boolean {
    const confidenceLow = receipt?.fieldMeta[field]?.confidence === "low";
    return confidenceLow || liveFail;
  }

  const merchantFlagged = isFieldFlagged("merchant", draft.merchant === null);
  const dateFlagged = isFieldFlagged("purchase_date", draft.purchaseDate === null || !checkDateSanity(draft.purchaseDate));
  const subtotalFlagged = isFieldFlagged("subtotal", !checkAmountSanity(draft.subtotal));
  const taxFlagged = isFieldFlagged("tax", !checkAmountSanity(draft.tax));
  const discountFlagged = isFieldFlagged("discount", !checkAmountSanity(draft.discount));
  const tipFlagged = isFieldFlagged("tip", !checkAmountSanity(draft.tip));
  const totalFlagged = isFieldFlagged(
    "total",
    draft.total === null || draft.total <= 0 || !(liveArithmetic?.ok ?? true)
  );

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      const updated = await apiSaveCorrection(id, {
        merchant: draft.merchant,
        purchaseDate: draft.purchaseDate,
        currency: draft.currency,
        subtotal: draft.subtotal,
        tax: draft.tax,
        discount: draft.discount,
        tip: draft.tip,
        total: draft.total,
        customFields: draft.customFields,
        lineItems: draft.lineItems.map((li) => ({ id: li.id, name: li.name, quantity: li.quantity, amount: li.amount })),
      });
      setReceipt(updated);
      setDraft(toDraft(updated));
      toast.success("Receipt saved");
    } catch {
      toast.error("Couldn't save changes. Your edits are still here — try again.", {
        action: { label: "Retry", onClick: () => handleSave() },
      });
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (receipt) setDraft(toDraft(receipt));
  }

  const showQualityWarning = receipt.imageQuality === "poor_but_readable" || receipt.imageQuality === "unreadable";

  return (
    <div className="flex h-screen flex-col">
      <NavHeader />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/2 min-w-0 border-r">
          <ReceiptImagePane
            receiptId={id}
            imageSource={imageSource}
            hasSecondary={!!receipt.secondaryImagePath}
            onImageSourceChange={setImageSource}
          />
        </div>

        <div className="flex w-1/2 min-w-0 flex-col overflow-hidden">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-3">
                <EditableField
                  label="Merchant"
                  value={draft.merchant}
                  flagged={merchantFlagged}
                  flagReason="Not found on receipt"
                  inputClassName="h-11 text-lg font-semibold"
                  onChange={(v) => updateDraft({ merchant: v || null })}
                />
                <div className="flex items-center gap-3">
                  <EditableField
                    label="Date"
                    type="date"
                    value={draft.purchaseDate}
                    flagged={dateFlagged}
                    flagReason="Missing or implausible date"
                    className="w-44"
                    onChange={(v) => updateDraft({ purchaseDate: v || null })}
                  />
                  <div className="flex items-center gap-2 pt-5">
                    <StatusBadge status={receipt.status} />
                    <FlagBadge
                      count={
                        [merchantFlagged, dateFlagged, subtotalFlagged, taxFlagged, tipFlagged, discountFlagged, totalFlagged].filter(Boolean)
                          .length + draft.lineItems.filter((li) => li.flagged).length
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onClick={() => setReuploadOpen(true)}>
                  <RefreshCw className="size-4" /> Reupload
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            {showQualityWarning && (
              <Alert className="border-amber-500/50 text-amber-800 dark:text-amber-300 [&>svg]:text-amber-600">
                <AlertTriangle className="size-4" />
                <AlertTitle>Photo quality was poor</AlertTitle>
                <AlertDescription className="flex items-center justify-between gap-3 text-amber-800/90 dark:text-amber-300/90">
                  <span>Double-check the flagged fields against the image.</span>
                  <Button size="sm" variant="outline" onClick={() => setReuploadOpen(true)}>
                    Reupload
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <ReconciliationBanner reconciliation={liveArithmetic?.reconciliation ?? null} currency={draft.currency} />

            <div>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Line items</h2>
              <LineItemsEditor items={draft.lineItems} onChange={(items) => updateDraft({ lineItems: items })} />
            </div>

            <div>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Totals</h2>
              <div className="grid grid-cols-2 gap-3">
                <EditableField
                  label="Subtotal"
                  type="number"
                  value={draft.subtotal}
                  flagged={subtotalFlagged}
                  flagReason="Doesn't look right"
                  onChange={(v) => updateDraft({ subtotal: v === "" ? null : Number(v) })}
                />
                <EditableField
                  label="Tax"
                  type="number"
                  value={draft.tax}
                  flagged={taxFlagged}
                  flagReason="Doesn't look right"
                  onChange={(v) => updateDraft({ tax: v === "" ? null : Number(v) })}
                />
                <EditableField
                  label="Discount"
                  type="number"
                  value={draft.discount}
                  flagged={discountFlagged}
                  flagReason="Doesn't look right"
                  onChange={(v) => updateDraft({ discount: v === "" ? null : Number(v) })}
                />
                <EditableField
                  label="Tip"
                  type="number"
                  value={draft.tip}
                  flagged={tipFlagged}
                  flagReason="Doesn't look right"
                  onChange={(v) => updateDraft({ tip: v === "" ? null : Number(v) })}
                />
                <EditableField
                  label="Total"
                  type="number"
                  value={draft.total}
                  flagged={totalFlagged}
                  flagReason="Doesn't match the line items"
                  className="col-span-2"
                  inputClassName="text-base font-semibold"
                  onChange={(v) => updateDraft({ total: v === "" ? null : Number(v) })}
                />
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Custom fields</h2>
              <CustomFieldsEditor fields={draft.customFields} onChange={(cf) => updateDraft({ customFields: cf })} />
            </div>

            {receipt.mergeReport && (
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Updated {receipt.mergeReport.updatedFields.length} field(s) from the new photo · {" "}
                {receipt.mergeReport.keptFields.length} kept from your edits · {receipt.mergeReport.unclearFields.length}{" "}
                still unclear
              </p>
            )}
          </div>

          <SaveBar dirty={dirty} saving={saving} onSave={handleSave} onDiscard={handleDiscard} />
        </div>
      </div>

      <DeleteReceiptDialog
        receiptId={id}
        merchant={receipt.merchant}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push("/receipts")}
      />
      <ReuploadDialog
        receiptId={id}
        open={reuploadOpen}
        onOpenChange={setReuploadOpen}
        onMerged={(updated) => {
          setReceipt(updated);
          setDraft(toDraft(updated));
          setImageSource(updated.activeImage);
        }}
      />
    </div>
  );
}
