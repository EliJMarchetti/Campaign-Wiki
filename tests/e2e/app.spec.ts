import { expect, test } from "@playwright/test";

test("loads a working application shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Campaign Wiki")).toBeVisible();
});
