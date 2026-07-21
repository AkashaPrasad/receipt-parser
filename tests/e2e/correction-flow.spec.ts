import { test, expect } from "@playwright/test";
import { getSamplePath, deleteReceipt } from "./helpers";

test.describe.configure({ mode: "serial" });

const samplePath = getSamplePath(0);
test.skip(!samplePath, "No sample receipt found in ./samples");

let receiptId: string;

test.describe("upload, correct, and persist a receipt", () => {
  test.afterAll(async ({ request }) => {
    if (receiptId) await deleteReceipt(request, receiptId);
  });

  test("uploading a sample receipt renders merchant and total", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Drop a receipt/i }).click();
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /Drop a receipt/i }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(samplePath!);

    await page.waitForURL(/\/receipts\/[^/]+$/, { timeout: 45_000 });
    receiptId = page.url().split("/receipts/")[1];

    await expect(page.getByLabel("Merchant")).not.toHaveValue("");
    await expect(page.getByLabel("Total", { exact: true })).not.toHaveValue("");
  });

  test("editing a line item updates the reconciliation banner live, and persists after save + reload", async ({
    page,
  }) => {
    await page.goto(`/receipts/${receiptId}`);
    // Don't assume the fresh parse reconciles — some sample receipts are
    // deliberately mismatched to exercise this exact flag. Just confirm
    // editing an amount live-updates the banner, whichever state it starts in.
    await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();

    const firstAmountCell = page.locator("table").getByRole("row").nth(1).getByRole("button").nth(2);
    await firstAmountCell.click();
    const input = page.locator("table input[type=number]").first();
    await input.fill("999");
    await input.press("Enter");

    await expect(page.getByText("Numbers don't add up")).toBeVisible();

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Receipt saved")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Corrected")).toBeVisible();
    await expect(page.getByText("Numbers don't add up")).toBeVisible();
  });

  test("adding a line item, deleting a line item, and adding a custom field all persist", async ({ page }) => {
    await page.goto(`/receipts/${receiptId}`);
    await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();

    const rowsBefore = await page.locator("table tbody tr").count();
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(rowsBefore + 1);
    const newRow = page.locator("table tbody tr").nth(rowsBefore - 1);
    // first button in a line-item row is always the Name cell (drag handle has none)
    await newRow.getByRole("button").first().click();
    const nameInput = page.locator("table input[type=text]").first();
    await nameInput.fill("Extra Napkins");
    await nameInput.press("Enter");

    await page.getByPlaceholder("Field name (e.g. GSTIN)").fill("Table");
    await page.getByRole("button", { name: "Add field" }).click();
    await page.locator("text=Table").locator("..").getByRole("textbox").fill("12");

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Receipt saved")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Extra Napkins")).toBeVisible();
    await expect(page.getByText("Table")).toBeVisible();

    // delete the item we just added
    const row = page.locator("table tbody tr", { hasText: "Extra Napkins" });
    await row.hover();
    await row.getByRole("button").last().click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Receipt saved")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Extra Napkins")).not.toBeVisible();
  });
});
