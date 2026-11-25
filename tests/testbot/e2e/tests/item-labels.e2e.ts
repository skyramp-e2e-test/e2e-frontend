// Item labels on the items page: each is shown without leading/trailing whitespace.
import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { Page } from "@playwright/test";

const FRONTEND_URL = (
  process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND ||
  process.env.SKYRAMP_TEST_SERVICE_URL_UI ||
  "http://localhost:8080"
).replace(/\/+$/, "");
test.use({ viewport: { width: 1280, height: 900 } });

/** Answer the page's item list and count requests with the given items, so only the labels vary. */
async function stubItems(page: Page, items: unknown[]) {
  await page.route("**/api/items", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) }),
  );
  await page.route("**/api/items/count", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ count: items.length }) }),
  );
}

/** Open the items page and wait until the list holds `count` entries. */
async function openList(page: Page, count: number) {
  await page.goto(`${FRONTEND_URL}/`);
  await expect(page.getByTestId("item-list")).toHaveAttribute("data-count", String(count));
}

test.describe("item labels", () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(15000);
  });

  test("string labels are shown without leading or trailing whitespace", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await stubItems(page, ["  Apple  ", "\tPear\n"]);
    await openList(page, 2);
    // Raw textContent, not toHaveText, which would normalise the whitespace under test.
    expect(await page.getByTestId("item").allTextContents()).toEqual(["Apple", "Pear"]);
    await expect(page.getByTestId("empty-state")).toBeHidden();
  });

  test("trimming keeps interior whitespace and shows a number as its text", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await stubItems(page, ["  big   red apple ", 42]);
    await openList(page, 2);
    expect(await page.getByTestId("item").allTextContents()).toEqual(["big   red apple", "42"]);
  });

  test("an object item's name label is shown trimmed", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await stubItems(page, [{ id: "a1", name: "  Kiwi  " }]);
    await openList(page, 1);
    const item = page.locator('[data-testid="item"][data-item-id="a1"]');
    await expect(item).toHaveCount(1);
    expect(await item.textContent()).toBe("Kiwi");
  });

  test("an object item's title label is shown trimmed when it has no name", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await stubItems(page, [{ id: "b2", title: "  Plum " }]);
    await openList(page, 1);
    const item = page.locator('[data-testid="item"][data-item-id="b2"]');
    await expect(item).toHaveCount(1);
    expect(await item.textContent()).toBe("Plum");
  });
});
