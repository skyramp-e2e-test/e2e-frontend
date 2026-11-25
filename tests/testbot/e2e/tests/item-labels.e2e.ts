// Item labels in the list are shown trimmed of leading and trailing whitespace.
// Each test answers GET /api/items and GET /api/items/count from the browser with
// page.route, so the list shows exactly the items the test chooses.
import { test, expect, type Page, type Route } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";

const baseUrl = (
  process.env.SKYRAMP_TEST_SERVICE_URL_UI ??
  process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND ??
  "http://localhost:8080"
).replace(/\/+$/, "");

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

/** Answers GET /api/items with items and GET /api/items/count with { count }. */
async function mockItems(page: Page, items: unknown[], count: number) {
  await page.route(
    (url) => url.pathname === "/api/items/count",
    (route) => json(route, { count }),
  );
  await page.route(
    (url) => url.pathname === "/api/items",
    (route) => (route.request().method() === "GET" ? json(route, items) : route.fallback()),
  );
}

async function openItems(page: Page, count: number) {
  await page.goto(`${baseUrl}/`);
  await expect(page.locator(`[data-testid="item-list"][data-count="${count}"]`)).toBeVisible();
}

const rows = (page: Page) => page.getByTestId("item-list").getByTestId("item");

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(10000);
});

test("string items with surrounding whitespace are shown trimmed", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await mockItems(page, ["  apple  ", "\tbanana\n"], 2);
  await openItems(page, 2);
  await expect(rows(page)).toHaveCount(2);
  expect(await rows(page).allTextContents()).toEqual(["apple", "banana"]);
});

test("trimming keeps whitespace inside a label", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await mockItems(page, ["  green apple  "], 1);
  await openItems(page, 1);
  await expect(rows(page)).toHaveCount(1);
  expect(await rows(page).allTextContents()).toEqual(["green apple"]);
});

test("object items labelled by name or title are shown trimmed", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await mockItems(page, [{ id: "a1", name: "  pear  " }, { id: "a2", title: "  plum " }], 2);
  await openItems(page, 2);
  await expect(rows(page)).toHaveCount(2);
  const pear = page.locator('[data-testid="item"][data-item-id="a1"]');
  const plum = page.locator('[data-testid="item"][data-item-id="a2"]');
  expect.soft(await pear.textContent()).toBe("pear");
  expect.soft(await plum.textContent()).toBe("plum");
});

test("labels without surrounding whitespace and non-string items are shown as before", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await mockItems(page, ["apple", 42], 2);
  await openItems(page, 2);
  await expect(rows(page)).toHaveCount(2);
  expect(await rows(page).allTextContents()).toEqual(["apple", "42"]);
});
