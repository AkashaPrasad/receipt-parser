"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadDropzone } from "@/components/upload-dropzone";
import { Skeleton } from "@/components/ui/skeleton";
import { reparseReceipt, ApiError } from "@/lib/api-client";
import type { ReceiptDetail } from "@/lib/types";
import { toast } from "sonner";

export function ReuploadDialog({
  receiptId,
  open,
  onOpenChange,
  onMerged,
}: {
  receiptId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged: (receipt: ReceiptDetail) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const updated = await reparseReceipt(receiptId, file);
      onMerged(updated);
      toast.success("Merged the new photo into this receipt");
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't process that photo. Please try again.";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !uploading && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reupload a better photo</DialogTitle>
          <DialogDescription>
            Upload a second photo of the same receipt. Fields you&apos;ve already corrected are kept; everything
            else is refreshed from the new photo.
          </DialogDescription>
        </DialogHeader>
        {uploading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-40 w-full" />
            <p className="text-center text-sm text-muted-foreground">Merging the new photo…</p>
          </div>
        ) : (
          <UploadDropzone onFile={handleFile} />
        )}
      </DialogContent>
    </Dialog>
  );
}
