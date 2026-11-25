// Item labels in the list are trimmed before they are shown.
import { test, expect, getBaseUrl, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { Page } from "@playwright/test";

const baseUrl = getBaseUrl("SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND", "http://localhost:8080");
const apiUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

test.use({ viewport: { width: 1280, height: 900 } });

// Answers only GET /api/items (not /api/items/count) with the given JSON body.
async function stubItemList(page: Page, body: unknown) {
  await page.route(
    (url) => url.pathname === "/api/items",
    (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
        : route.continue(),
  );
}

async function openWithItems(page: Page, body: unknown[]) {
  await stubItemList(page, body);
  await page.goto(`${baseUrl}/`);
  await expect(page.getByTestId("item-list")).toHaveAttribute("data-count", String(body.length));
}

const itemText = (page: Page) =>
  page.getByTestId("item").evaluateAll((els) => els.map((el) => el.textContent));

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(15000);
});

test("string labels with outer spaces, tabs and newlines are shown trimmed", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await openWithItems(page, ["  Apple  ", "\tKiwi\n"]);
  expect(await itemText(page)).toEqual(["Apple", "Kiwi"]);
});

test("an object item's name with outer spaces is shown trimmed", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await openWithItems(page, [{ id: "x1", name: "  Pear  " }]);
  const item = page.locator('[data-testid="item"][data-item-id="x1"]');
  await expect(item).toHaveCount(1);
  expect(await item.textContent()).toBe("Pear");
});

test("an object item labelled by its title has the title trimmed", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await openWithItems(page, [{ id: "x2", title: "  Plum " }]);
  const item = page.locator('[data-testid="item"][data-item-id="x2"]');
  await expect(item).toHaveCount(1);
  expect(await item.textContent()).toBe("Plum");
});

test("inner whitespace and labels without outer whitespace are kept", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await openWithItems(page, ["  Green tea  ", "Banana", 42, { id: "x3", name: "Cherry pie" }]);
  expect(await itemText(page)).toEqual(["Green tea", "Banana", "42", "Cherry pie"]);
  await expect(page.locator('[data-testid="item"][data-item-id="x3"]')).toHaveText("Cherry pie");
  await expect(page.getByTestId("empty-state")).toBeHidden();
});

test.describe("with items added through the form", () => {
  const made: string[] = [];

  test.afterEach(async ({ request }) => {
    const res = await request.get(`${apiUrl}/api/items`);
    const items: { id: string; name: string }[] = await res.json();
    for (const it of items.filter((i) => made.includes(i.name))) {
      await request.delete(`${apiUrl}/api/items/${it.id}`);
    }
    made.length = 0;
  });

  test("a name typed with surrounding spaces is added and listed trimmed", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const name = `Mango tb-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    made.push(name);
    await page.goto(`${baseUrl}/`);
    await expect(page.getByTestId("item-list")).toHaveAttribute("data-count", /\d+/);
    await page.getByTestId("item-name-input").fill(`  ${name}  `);
    const posted = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/items");
    await page.getByTestId("add-item-submit").click();
    expect((await posted).postDataJSON()).toEqual({ name });
    await expect(page.getByTestId("status")).toHaveAttribute("data-state", "ok");
    await expect(page.getByTestId("status")).toHaveText(`Added "${name}"`);
    const added = page.getByTestId("item").filter({ hasText: name });
    await expect(added).toHaveCount(1);
    expect(await added.textContent()).toBe(name);
  });
});
