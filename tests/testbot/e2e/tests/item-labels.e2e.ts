// Item labels in the list on / are shown without leading or trailing whitespace.
import { test, expect, type Page } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { TEST_ITEM_PREFIX, deleteItemsNamed } from "../support/items-api.cjs";

const baseUrl = process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND || process.env.SKYRAMP_TEST_SERVICE_URL_UI || "http://localhost:8080";

// The real API trims names when it stores them, so only a scripted answer gives the page untrimmed labels.
async function openWithItems(page: Page, items: unknown[]) {
  await page.route("**/api/items", (route) =>
    route.request().method() === "GET" ? route.fulfill({ status: 200, json: items }) : route.fallback(),
  );
  await page.route("**/api/items/count", (route) => route.fulfill({ status: 200, json: { count: items.length } }));
  await page.goto(`${baseUrl}/`);
  const list = page.getByTestId("item-list");
  await expect(list).toHaveAttribute("data-count", String(items.length));
  return list;
}

test.describe("item labels on the item list", () => {
  test.beforeEach(({ page }) => {
    page.setDefaultTimeout(10000);
  });

  test("string labels are shown without surrounding whitespace, inner whitespace kept", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const list = await openWithItems(page, ["  Apple  ", "\tBanana\n", "  Green   Apple "]);
    // textContent, not innerText: innerText collapses the whitespace being checked.
    expect(await list.getByTestId("item").allTextContents()).toEqual(["Apple", "Banana", "Green   Apple"]);
  });

  test("an object item's name is shown without surrounding whitespace", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const list = await openWithItems(page, [{ id: "a1", name: "  Padded Name  " }]);
    const item = list.locator('[data-item-id="a1"]');
    await expect(item).toHaveCount(1);
    expect(await item.textContent()).toBe("Padded Name");
  });

  test("an object item's title is shown without surrounding whitespace when it has no name", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const list = await openWithItems(page, [{ id: "b2", title: "  Titled  " }]);
    const item = list.locator('[data-item-id="b2"]');
    await expect(item).toHaveCount(1);
    expect(await item.textContent()).toBe("Titled");
  });

  test("a name added with surrounding spaces is shown trimmed in the list", async ({ page }, testInfo) => {
    page = newSkyrampPlaywrightPage(page);
    const name = `${TEST_ITEM_PREFIX}${Date.now()}-${testInfo.workerIndex}`;
    try {
      await page.goto(`${baseUrl}/`);
      const list = page.getByTestId("item-list");
      await expect(list).toHaveAttribute("data-count", /^\d+$/);
      const before = Number(await list.getAttribute("data-count"));

      await page.getByTestId("item-name-input").fill(`  ${name}  `);
      const post = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/items");
      await page.getByTestId("add-item-submit").click();
      expect((await post).postDataJSON()).toEqual({ name });

      const status = page.getByTestId("status");
      await expect(status).toHaveAttribute("data-state", "ok");
      await expect(status).toHaveText(`Added "${name}"`);
      await expect(list).toHaveAttribute("data-count", String(before + 1));
      const added = list.getByTestId("item").filter({ hasText: name });
      await expect(added).toHaveCount(1);
      expect(await added.textContent()).toBe(name);
    } finally {
      await deleteItemsNamed(name);
    }
  });
});
