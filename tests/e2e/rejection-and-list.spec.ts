import { test, expect } from "@playwright/test";
import { getSamplePath, makeSolidColorPng, deleteReceipt } from "./helpers";

test("uploading a non-receipt image shows a friendly rejection card, not a crash", async ({ page }) => {
  const buffer = await makeSolidColorPng();

  await page.goto("/");
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Drop a receipt/i }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: "not-a-receipt.png", mimeType: "image/png", buffer });

  await expect(page.getByText(/doesn't look like a receipt|different kind of document/i)).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByRole("button", { name: "Try another photo" })).toBeVisible();

  // still on the upload page, dropzone recoverable, no console-crash navigation
  await expect(page).toHaveURL("/");
});

test.describe("all receipts list", () => {
  const samplePath = getSamplePath(1);
  test.skip(!samplePath, "No sample receipt found in ./samples");

  test("open a receipt from the list, then delete it with confirmation, and it disappears from the list", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /Drop a receipt/i }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(samplePath!);
    await page.waitForURL(/\/receipts\/[^/]+$/, { timeout: 45_000 });
    const id = page.url().split("/receipts/")[1];

    try {
      await page.goto("/receipts");
      const row = page.locator("table tbody tr", { has: page.locator(`a[href="/receipts/${id}"]`) });
      await expect(row).toBeVisible();

      await row.getByRole("button").last().click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await page.getByRole("button", { name: "Delete" }).last().click();

      await expect(page.getByText("Receipt deleted")).toBeVisible();
      await expect(page.locator(`a[href="/receipts/${id}"]`)).toHaveCount(0);
    } finally {
      await deleteReceipt(request, id);
    }
  });
});
