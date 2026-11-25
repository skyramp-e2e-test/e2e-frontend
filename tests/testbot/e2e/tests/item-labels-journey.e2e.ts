// Journey: view the item list and add an item; every label is shown trimmed.
import { test, expect } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { TEST_ITEM_PREFIX, deleteItemsNamed } from "../support/items-api.cjs";

const baseUrl = process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND || process.env.SKYRAMP_TEST_SERVICE_URL_UI || "http://localhost:8080";

test("view the item list, add a padded name, and see every label trimmed", async ({ page }, testInfo) => {
  page.setDefaultTimeout(10000);
  page = newSkyrampPlaywrightPage(page);
  const name = `${TEST_ITEM_PREFIX}${Date.now()}-${testInfo.workerIndex}`;
  const list = page.getByTestId("item-list");
  const items = list.getByTestId("item");

  try {
    await test.step("1. open / and see the list labels without surrounding whitespace", async () => {
      await page.goto(`${baseUrl}/`);
      await expect(list).toHaveAttribute("data-count", /^\d+$/);
      const labels = await items.allTextContents();
      expect.soft(labels.filter((l) => l !== l.trim())).toEqual([]);
    });

    await test.step("2. add a name with surrounding spaces and see it trimmed in the reloaded list", async () => {
      await page.getByTestId("item-name-input").fill(`  ${name}  `);
      const post = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/items");
      await page.getByTestId("add-item-submit").click();
      expect.soft((await post).postDataJSON()).toEqual({ name });
      const status = page.getByTestId("status");
      await expect(status).toHaveText(`Added "${name}"`);
      await expect(status).toHaveAttribute("data-state", "ok");
      const added = items.filter({ hasText: name });
      await expect(added).toHaveCount(1);
      expect.soft(await added.textContent()).toBe(name);
    });

    await test.step("outcome: after a reload every entry, the new one included, is shown trimmed", async () => {
      await page.reload();
      await expect(list).toHaveAttribute("data-count", /^[1-9]\d*$/);
      const labels = await items.allTextContents();
      expect(labels.filter((l) => l === name)).toEqual([name]);
      expect(labels.filter((l) => l !== l.trim())).toEqual([]);
    });
  } finally {
    await deleteItemsNamed(name);
  }
});
