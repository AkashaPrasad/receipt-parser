import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { APIRequestContext } from "@playwright/test";

const SAMPLES_DIR = path.join(process.cwd(), "samples");

export function getSamplePath(index: number): string | null {
  if (!fs.existsSync(SAMPLES_DIR)) return null;
  const files = fs
    .readdirSync(SAMPLES_DIR)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort();
  const file = files[index];
  return file ? path.join(SAMPLES_DIR, file) : null;
}

export async function makeSolidColorPng(): Promise<Buffer> {
  return sharp({
    create: { width: 400, height: 400, channels: 3, background: { r: 180, g: 90, b: 40 } },
  })
    .png()
    .toBuffer();
}

export async function deleteReceipt(request: APIRequestContext, id: string): Promise<void> {
  await request.delete(`/api/receipts/${id}`).catch(() => {});
}
