// Item labels on the items page: labels are trimmed before the list shows them,
// for strings and for object items' name or title, with inner whitespace kept.
import { test, expect, type Page } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";

const uiUrl = process.env.SKYRAMP_TEST_SERVICE_URL_UI || "http://localhost:8080";

test.use({ viewport: { width: 1280, height: 900 } });

/** Answer GET /api/items with `items` and GET /api/items/count with their number, then open the page. */
async function openWithItems(page: Page, items: unknown[]) {
  await page.route("**/api/items/count", (route) => route.fulfill({ status: 200, json: { count: items.length } }));
  await page.route("**/api/items", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({ status: 200, json: items });
  });
  await page.goto(`${uiUrl}/`);
  await expect(page.getByTestId("item-list")).toHaveAttribute("data-count", String(items.length));
}

/** textContent of each list item, in order (textContent keeps whitespace that innerText would collapse). */
async function itemTexts(page: Page) {
  return page.getByTestId("item").evaluateAll((els) => els.map((el) => el.textContent));
}

test.describe("item labels from a stubbed item list", () => {
  test("string items are shown with leading and trailing whitespace removed", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await openWithItems(page, ["  Apple  ", "\tPear\n"]);
    expect(await itemTexts(page)).toEqual(["Apple", "Pear"]);
  });

  test("an object item's name is shown trimmed", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await openWithItems(page, [{ id: "b1", name: "  Banana  " }]);
    const item = page.locator('[data-testid="item"][data-item-id="b1"]');
    await expect(item).toHaveCount(1);
    expect(await item.evaluate((el) => el.textContent)).toBe("Banana");
  });

  test("an object item without a name shows its title trimmed", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await openWithItems(page, [{ id: "g1", title: "  Gamma " }]);
    const item = page.locator('[data-testid="item"][data-item-id="g1"]');
    await expect(item).toHaveCount(1);
    expect(await item.evaluate((el) => el.textContent)).toBe("Gamma");
  });

  test("whitespace inside a label is kept", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await openWithItems(page, ["  New  York  "]);
    expect(await itemTexts(page)).toEqual(["New  York"]);
  });
});
