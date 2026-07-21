"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_UPLOAD_BYTES, ACCEPTED_MIME_TYPES } from "@/lib/upload-constraints";

const ACCEPTED_TYPES: string[] = [...ACCEPTED_MIME_TYPES];
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".pdf"];

interface UploadDropzoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function UploadDropzone({ onFile, disabled }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndEmit = useCallback(
    (file: File) => {
      if (!isAcceptedFile(file)) {
        setError("Unsupported file type. Please use JPG, PNG, WEBP, HEIC, or PDF.");
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setError("That file is larger than 15 MB.");
        return;
      }
      setError(null);
      onFile(file);
    },
    [onFile]
  );

  useEffect(() => {
    if (disabled) return;
    function handlePaste(event: ClipboardEvent) {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            validateAndEmit(file);
            break;
          }
        }
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [disabled, validateAndEmit]);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) validateAndEmit(file);
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) validateAndEmit(file);
    event.target.value = "";
  }

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        aria-disabled={disabled}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary/60 hover:bg-muted/40"
        )}
      >
        <UploadCloud className="size-8 text-muted-foreground" aria-hidden />
        <div>
          <p className="text-sm font-medium">Drop a receipt — JPG, PNG, HEIC, or PDF</p>
          <p className="mt-1 text-xs text-muted-foreground">
            or click to browse, or paste from clipboard (⌘/Ctrl+V)
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleInputChange}
          disabled={disabled}
        />
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
