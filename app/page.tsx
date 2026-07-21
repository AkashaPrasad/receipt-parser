"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { UploadDropzone } from "@/components/upload-dropzone";
import { NotAReceiptCard } from "@/components/not-a-receipt-card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, FlagBadge } from "@/components/status-badge";
import { listReceipts, uploadReceipt, ApiError } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ReceiptListItem } from "@/lib/types";
import { toast } from "sonner";

const STATUS_MESSAGES = ["Reading receipt…", "Extracting items…", "Checking the math…"];

export default function Home() {
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const [rejection, setRejection] = useState<string | null>(null);
  const [recent, setRecent] = useState<ReceiptListItem[] | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    listReceipts()
      .then((list) => setRecent(list.slice(0, 5)))
      .catch(() => setRecent([]));
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function handleFile(file: File) {
    setRejection(null);
    setUploading(true);
    setStatusIndex(0);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    intervalRef.current = setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 1500);

    try {
      const receipt = await uploadReceipt(file);
      router.push(`/receipts/${receipt.id}`);
    } catch (err) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setUploading(false);
      URL.revokeObjectURL(url);
      setPreviewUrl(null);

      if (err instanceof ApiError && (err.code === "NOT_A_RECEIPT" || err.code === "OTHER_DOCUMENT")) {
        setRejection(err.message);
      } else {
        const message = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
        toast.error(message);
      }
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-muted/20">
      <NavHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        {rejection ? (
          <NotAReceiptCard message={rejection} onRetry={() => setRejection(null)} />
        ) : uploading ? (
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-xl border">
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Receipt preview" className="max-h-96 w-full object-contain bg-background" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                <div className="flex items-center gap-3 rounded-full bg-background px-4 py-2 shadow-sm border">
                  <span className="size-2 animate-pulse rounded-full bg-primary" />
                  <span className="text-sm font-medium">{STATUS_MESSAGES[statusIndex]}</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ) : (
          <UploadDropzone onFile={handleFile} />
        )}

        <section className="mt-12">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Recent receipts</h2>
            {recent && recent.length > 0 && (
              <Link href="/receipts" className="text-sm text-primary hover:underline">
                View all
              </Link>
            )}
          </div>

          {recent === null ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : recent.length === 0 ? (
            <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              No receipts yet — drop one above to get started.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border bg-background">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/receipts/${r.id}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/receipts/${r.id}/image`}
                      alt=""
                      className="size-10 shrink-0 rounded object-cover border"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.merchant ?? "Unknown merchant"}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(r.purchaseDate)}</p>
                    </div>
                    <span className="text-sm tabular-nums">{formatCurrency(r.total, r.currency)}</span>
                    <StatusBadge status={r.status} />
                    <FlagBadge count={r.flagCount} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
