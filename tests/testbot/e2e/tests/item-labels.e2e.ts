// Item labels on the items page: labels are shown trimmed of leading and trailing whitespace,
// whatever shape the item has (string, or object labelled by name or title).
// The journeys through the real app are in item-label-journeys.e2e.ts.
import { test, expect, type Page } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";

const baseUrl = (
  process.env.SKYRAMP_TEST_SERVICE_URL_UI ||
  process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND ||
  "http://localhost:8080"
).replace(/\/+$/, "");

test.use({ viewport: { width: 1280, height: 900 } });

/** Answer the page's GET /api/items and GET /api/items/count with the given body. */
async function stubItems(page: Page, items: unknown[]) {
  await page.route("**/api/items", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) }),
  );
  await page.route("**/api/items/count", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ count: items.length }) }),
  );
}

/** textContent of every listed item, in order (not innerText, which collapses whitespace). */
const itemTexts = (page: Page) => page.getByTestId("item-list").getByTestId("item").allTextContents();

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(15000);
});

test("string item labels are shown without leading and trailing whitespace", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await stubItems(page, ["  Apple  ", "\tBanana split\n"]);
  await page.goto(`${baseUrl}/`);
  await expect(page.getByTestId("item-list")).toHaveAttribute("data-count", "2");
  expect(await itemTexts(page)).toEqual(["Apple", "Banana split"]);
  await expect(page.getByTestId("status")).toHaveAttribute("data-state", "ok");
  expect(await page.getByTestId("status").textContent()).toBe("");
});

test("an object item's padded name is shown trimmed", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await stubItems(page, [{ id: "a1", name: "  Padded name  " }]);
  await page.goto(`${baseUrl}/`);
  await expect(page.getByTestId("item-list")).toHaveAttribute("data-count", "1");
  expect(await page.locator('[data-testid="item"][data-item-id="a1"]').textContent()).toBe("Padded name");
});

test("an object item labelled by its padded title is shown trimmed", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await stubItems(page, [{ id: "t1", title: "  Titled  " }]);
  await page.goto(`${baseUrl}/`);
  await expect(page.getByTestId("item-list")).toHaveAttribute("data-count", "1");
  expect(await page.locator('[data-testid="item"][data-item-id="t1"]').textContent()).toBe("Titled");
});

test("a whitespace-only string item is still listed, with an empty label", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await stubItems(page, ["   ", "Kept"]);
  await page.goto(`${baseUrl}/`);
  await expect(page.getByTestId("item-list")).toHaveAttribute("data-count", "2");
  await expect(page.getByTestId("item-list").getByTestId("item")).toHaveCount(2);
  expect(await itemTexts(page)).toEqual(["", "Kept"]);
  await expect(page.getByTestId("empty-state")).toBeHidden();
});
