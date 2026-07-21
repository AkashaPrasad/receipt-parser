"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize, RotateCw } from "lucide-react";
import type { ImageSource } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReceiptImagePaneProps {
  receiptId: string;
  imageSource: ImageSource;
  hasSecondary: boolean;
  onImageSourceChange: (source: ImageSource) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export function ReceiptImagePane({ receiptId, imageSource, hasSecondary, onImageSourceChange }: ReceiptImagePaneProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const imageUrl = `/api/receipts/${receiptId}/image${imageSource === "secondary" ? "?which=secondary" : ""}`;

  function clampZoom(z: number) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  }

  // True "contain" fit: the whole receipt is always visible by default,
  // scaled to its real aspect ratio — no cropping, no manual panning needed.
  const rotatedNatural =
    naturalSize && rotation % 180 !== 0 ? { w: naturalSize.h, h: naturalSize.w } : naturalSize;

  const fitScale =
    rotatedNatural && containerSize.w > 0 && containerSize.h > 0
      ? Math.min(containerSize.w / rotatedNatural.w, containerSize.h / rotatedNatural.h)
      : 0;

  const renderedWidth = naturalSize && fitScale ? naturalSize.w * fitScale * zoom : 0;
  const renderedHeight = naturalSize && fitScale ? naturalSize.h * fitScale * zoom : 0;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  // Reset the view when switching images (adjusted during render, matching
  // React's guidance for state that must sync to a changed prop).
  const [lastImageUrl, setLastImageUrl] = useState(imageUrl);
  if (imageUrl !== lastImageUrl) {
    setLastImageUrl(imageUrl);
    setZoom(1);
    setRotation(0);
    setNaturalSize(null);
  }

  useEffect(() => {
    viewportRef.current?.scrollTo({ left: 0, top: 0 });
  }, [imageUrl]);

  return (
    <div className="flex h-full flex-col bg-muted/30">
      <div className="flex items-center justify-between gap-2 border-b bg-background px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setZoom((z) => clampZoom(z - 0.25))}
            title="Zoom out"
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setZoom((z) => clampZoom(z + 0.25))}
            title="Zoom in"
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => {
              setZoom(1);
              viewportRef.current?.scrollTo({ left: 0, top: 0 });
            }}
            title="Fit to view"
          >
            <Maximize className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            title="Rotate"
          >
            <RotateCw className="size-4" />
          </Button>
        </div>

        {hasSecondary && (
          <div className="flex items-center rounded-md border p-0.5 text-xs">
            <button
              className={cn("rounded px-2 py-1", imageSource === "primary" && "bg-muted font-medium")}
              onClick={() => onImageSourceChange("primary")}
            >
              Photo 1
            </button>
            <button
              className={cn("rounded px-2 py-1", imageSource === "secondary" && "bg-muted font-medium")}
              onClick={() => onImageSourceChange("secondary")}
            >
              Photo 2
            </button>
          </div>
        )}
      </div>

      {/* Fixed in place — no drag-to-pan. The image is sized to its real
          aspect ratio so the whole receipt is visible by default; zoom
          scales it in place and the container scrolls natively if needed. */}
      <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-auto">
        <div className="flex min-h-full min-w-full items-center justify-center p-6">
          <div
            className="relative shrink-0"
            style={{
              width: renderedWidth || undefined,
              height: renderedHeight || undefined,
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "center center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Receipt"
              draggable={false}
              style={{ width: "100%", height: "100%", display: "block" }}
              className="select-none"
              onLoad={(e) => {
                const img = e.currentTarget;
                setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
