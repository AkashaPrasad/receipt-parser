"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LineItemDraft } from "@/lib/draft-types";
import { flagReason } from "@/lib/draft-types";
import { nanoid } from "nanoid";

interface LineItemsEditorProps {
  items: LineItemDraft[];
  onChange: (items: LineItemDraft[]) => void;
}

type Col = "name" | "quantity" | "amount";

export function LineItemsEditor({ items, onChange }: LineItemsEditorProps) {
  const [editing, setEditing] = useState<{ key: string; col: Col } | null>(null);
  const [draftValue, setDraftValue] = useState("");

  function startEdit(item: LineItemDraft, col: Col) {
    setEditing({ key: item.key, col });
    const value = item[col];
    setDraftValue(value === null || value === undefined ? "" : String(value));
  }

  function commitEdit(item: LineItemDraft, col: Col) {
    const next = items.map((it) => {
      if (it.key !== item.key) return it;
      if (col === "name") return { ...it, name: draftValue };
      const numeric = draftValue.trim() === "" ? null : Number(draftValue);
      return { ...it, [col]: Number.isNaN(numeric) ? it[col] : numeric };
    });
    onChange(next);
    setEditing(null);
  }

  function removeItem(key: string) {
    onChange(items.filter((it) => it.key !== key));
  }

  function addItem() {
    const newItem: LineItemDraft = {
      key: nanoid(),
      name: "",
      quantity: null,
      amount: null,
      flagged: false,
      confidence: "high",
      imageSource: "primary",
    };
    onChange([...items, newItem]);
  }

  function handleDrop(targetKey: string, draggedKey: string) {
    if (targetKey === draggedKey) return;
    const from = items.findIndex((it) => it.key === draggedKey);
    const to = items.findIndex((it) => it.key === targetKey);
    if (from === -1 || to === -1) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  function renderCell(item: LineItemDraft, col: Col) {
    const isEditing = editing?.key === item.key && editing.col === col;
    const value = item[col];

    if (isEditing) {
      return (
        <input
          autoFocus
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          onBlur={() => commitEdit(item, col)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit(item, col);
            if (e.key === "Escape") setEditing(null);
          }}
          type={col === "name" ? "text" : "number"}
          step={col === "quantity" ? "any" : "0.01"}
          className="w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none ring-primary focus:ring-2"
        />
      );
    }

    const display =
      col === "name" ? value || <span className="text-muted-foreground">Unnamed item</span> : value ?? "";

    const cellContent = (
      <button
        type="button"
        onClick={() => startEdit(item, col)}
        className={cn(
          "w-full rounded px-2 py-1 text-left text-sm",
          item.flagged ? "bg-amber-100 dark:bg-amber-950/40" : "hover:bg-muted/60"
        )}
      >
        {display === "" ? <span className="text-muted-foreground">—</span> : display}
      </button>
    );

    if (item.flagged) {
      return (
        <Tooltip>
          <TooltipTrigger render={cellContent} />
          <TooltipContent>{flagReason(item)}</TooltipContent>
        </Tooltip>
      );
    }
    return cellContent;
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="w-20">Qty</TableHead>
            <TableHead className="w-28">Amount</TableHead>
            <TableHead className="w-8"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.key}
              className="group"
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", item.key)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(item.key, e.dataTransfer.getData("text/plain"))}
            >
              <TableCell className="cursor-grab text-muted-foreground">
                <GripVertical className="size-4" />
              </TableCell>
              <TableCell>{renderCell(item, "name")}</TableCell>
              <TableCell>{renderCell(item, "quantity")}</TableCell>
              <TableCell>{renderCell(item, "amount")}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 opacity-0 group-hover:opacity-100"
                  onClick={() => removeItem(item.key)}
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={5} className="p-1">
              <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={addItem}>
                <Plus className="size-4" /> Add item
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
