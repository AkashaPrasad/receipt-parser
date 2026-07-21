"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { NavHeader } from "@/components/nav-header";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { StatusBadge, FlagBadge } from "@/components/status-badge";
import { DeleteReceiptDialog } from "@/components/delete-receipt-dialog";
import { listReceipts } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ReceiptListItem } from "@/lib/types";
import { MoreHorizontal } from "lucide-react";

type SortKey = "date" | "total";

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptListItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [deleteTarget, setDeleteTarget] = useState<ReceiptListItem | null>(null);

  function reload() {
    listReceipts()
      .then(setReceipts)
      .catch(() => setReceipts([]));
  }

  useEffect(reload, []);

  const filtered = useMemo(() => {
    if (!receipts) return [];
    const term = search.trim().toLowerCase();
    const rows = term ? receipts.filter((r) => (r.merchant ?? "").toLowerCase().includes(term)) : receipts;
    return [...rows].sort((a, b) => {
      if (sortKey === "total") return (b.total ?? 0) - (a.total ?? 0);
      return new Date(b.purchaseDate ?? b.createdAt).getTime() - new Date(a.purchaseDate ?? a.createdAt).getTime();
    });
  }, [receipts, search, sortKey]);

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <NavHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold">All receipts</h1>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search merchant…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortKey((k) => (k === "date" ? "total" : "date"))}
            >
              Sort: {sortKey === "date" ? "Date" : "Total"}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16"></TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts === null ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                    {receipts.length === 0 ? (
                      <>
                        No receipts yet.{" "}
                        <Link href="/" className="text-primary hover:underline">
                          Upload one
                        </Link>
                        .
                      </>
                    ) : (
                      "No receipts match your search."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id} className="group">
                    <TableCell>
                      <Link href={`/receipts/${r.id}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/receipts/${r.id}/image`}
                          alt=""
                          className="size-10 rounded object-cover border"
                        />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/receipts/${r.id}`} className="font-medium hover:underline">
                        {r.merchant ?? "Unknown merchant"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(r.purchaseDate)}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(r.total, r.currency)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.itemCount}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell>
                      <FlagBadge count={r.flagCount} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem render={<Link href={`/receipts/${r.id}`}>View</Link>} />
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(r)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      {deleteTarget && (
        <DeleteReceiptDialog
          receiptId={deleteTarget.id}
          merchant={deleteTarget.merchant}
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onDeleted={reload}
        />
      )}
    </div>
  );
}
