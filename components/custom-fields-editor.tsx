"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import type { CustomFields } from "@/lib/types";

export function CustomFieldsEditor({
  fields,
  onChange,
}: {
  fields: CustomFields;
  onChange: (fields: CustomFields) => void;
}) {
  const [newKey, setNewKey] = useState("");
  const entries = Object.entries(fields);

  function updateValue(key: string, value: string) {
    onChange({ ...fields, [key]: value });
  }

  function removeField(key: string) {
    const next = { ...fields };
    delete next[key];
    onChange(next);
  }

  function addField() {
    const key = newKey.trim();
    if (!key || key in fields) return;
    onChange({ ...fields, [key]: "" });
    setNewKey("");
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="w-32 shrink-0 truncate text-xs font-medium text-muted-foreground">{key}</span>
          <Input value={value} onChange={(e) => updateValue(key, e.target.value)} className="h-8" />
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => removeField(key)}>
            <X className="size-3.5" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addField()}
          placeholder="Field name (e.g. GSTIN)"
          className="h-8 w-32 shrink-0"
        />
        <Button variant="outline" size="sm" onClick={addField} disabled={!newKey.trim()}>
          <Plus className="size-3.5" /> Add field
        </Button>
      </div>
    </div>
  );
}
