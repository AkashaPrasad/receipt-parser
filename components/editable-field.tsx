"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface EditableFieldProps {
  label: string;
  value: string | number | null;
  type?: "text" | "number" | "date";
  flagged?: boolean;
  flagReason?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  onChange: (value: string) => void;
}

export function EditableField({
  label,
  value,
  type = "text",
  flagged,
  flagReason,
  placeholder,
  className,
  inputClassName,
  onChange,
}: EditableFieldProps) {
  const id = useId();
  const input = (
    <Input
      id={id}
      value={value ?? ""}
      type={type}
      step={type === "number" ? "any" : undefined}
      placeholder={placeholder ?? "not found — add if present"}
      onChange={(e) => onChange(e.target.value)}
      className={cn(flagged && "border-amber-500 bg-amber-50 dark:bg-amber-950/30", inputClassName)}
    />
  );

  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {flagged && flagReason ? (
        <Tooltip>
          <TooltipTrigger render={input} />
          <TooltipContent>{flagReason}</TooltipContent>
        </Tooltip>
      ) : (
        input
      )}
    </div>
  );
}
