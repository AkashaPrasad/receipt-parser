"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteReceipt as apiDeleteReceipt } from "@/lib/api-client";
import { toast } from "sonner";

export function DeleteReceiptDialog({
  receiptId,
  merchant,
  open,
  onOpenChange,
  onDeleted,
}: {
  receiptId: string;
  merchant: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiDeleteReceipt(receiptId);
      toast.success("Receipt deleted");
      onOpenChange(false);
      onDeleted();
    } catch {
      toast.error("Couldn't delete this receipt. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {merchant ?? "this receipt"}?</DialogTitle>
          <DialogDescription>
            This deletes the receipt and its images. Cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
