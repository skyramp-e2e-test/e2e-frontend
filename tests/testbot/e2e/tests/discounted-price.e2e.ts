// Discounted price next to each item's price on the items page (e2e-frontend public/app.js priceLabel).
// List cases stub the page's own GET /api/items so each price shape is shown on its own; the real-API case runs
// against the real frontend and e2e-api.
import { test, expect, type Page } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { API_URL, UI_URL, deleteItems, itemsPage, openLoaded, uniqueName } from "../support/items-page";

test.use({ baseURL: UI_URL });

async function stubItems(page: Page, items: unknown[]) {
  await page.route("**/api/items", (route) => route.fulfill({ json: items }));
  await page.route("**/api/items/count", (route) => route.fulfill({ json: { count: items.length } }));
}

test.describe("item list prices (stubbed list)", () => {
  test("priced items show their price and 10%-off price", async ({ page: rawPage }, testInfo) => {
    const page = newSkyrampPlaywrightPage(rawPage, testInfo);
    await stubItems(page, [
      { id: "a", name: "Widget", price: 20 },
      { id: "b", name: "Gadget", price: 9.5 },
    ]);
    await openLoaded(page);
    const ui = itemsPage(page);
    await expect(ui.item("Widget")).toHaveText("Widget — $20.00 (discounted: $18.00)");
    await expect(ui.item("Gadget")).toHaveText("Gadget — $9.50 (discounted: $8.55)");
    await expect(ui.items).toHaveCount(2);
    await expect(ui.list).toHaveAttribute("data-count", "2");
    await expect(ui.emptyState).toBeHidden();
  });

  test("a discount ending in half a cent rounds up, like the API discount helper", async ({ page: rawPage }, testInfo) => {
    const page = newSkyrampPlaywrightPage(rawPage, testInfo);
    await stubItems(page, [
      { id: "r1", name: "Penny", price: 1.15 },
      { id: "r2", name: "Nickel", price: 4.35 },
      { id: "r3", name: "Round", price: 100 },
    ]);
    await openLoaded(page);
    const ui = itemsPage(page);
    await expect.soft(ui.item("Penny")).toHaveText("Penny — $1.15 (discounted: $1.04)");
    await expect.soft(ui.item("Nickel")).toHaveText("Nickel — $4.35 (discounted: $3.92)");
    await expect.soft(ui.item("Round")).toHaveText("Round — $100.00 (discounted: $90.00)");
  });

  test("items without a price show their name only", async ({ page: rawPage }, testInfo) => {
    const page = newSkyrampPlaywrightPage(rawPage, testInfo);
    await stubItems(page, [
      { id: "n1", name: "Plain" },
      { id: "n2", name: "Nulled", price: null },
    ]);
    await openLoaded(page);
    const ui = itemsPage(page);
    await expect(ui.item("Plain")).toHaveText("Plain", { useInnerText: true });
    await expect(ui.item("Nulled")).toHaveText("Nulled", { useInnerText: true });
    await expect(ui.list).not.toContainText("$");
  });

  test("items with a non-numeric price show their name only, never NaN", async ({ page: rawPage }, testInfo) => {
    const page = newSkyrampPlaywrightPage(rawPage, testInfo);
    await stubItems(page, [
      { id: "b1", name: "Bad", price: "abc" },
      { id: "b2", name: "Obj", price: {} },
    ]);
    await openLoaded(page);
    const ui = itemsPage(page);
    await expect(ui.item("Bad")).toHaveText("Bad", { useInnerText: true });
    await expect(ui.item("Obj")).toHaveText("Obj", { useInnerText: true });
    await expect(ui.list).not.toContainText("NaN");
    await expect(ui.list).not.toContainText("$");
  });
});

test.describe("item prices against the real API", () => {
  const created: string[] = [];
  test.afterEach(async ({ request }) => {
    await deleteItems(request, created.splice(0));
  });

  test("an item given a price through the API shows it and its discounted price", async ({ page: rawPage, request }, testInfo) => {
    const page = newSkyrampPlaywrightPage(rawPage, testInfo);
    const name = uniqueName("Priced");
    const res = await request.post(`${API_URL}/api/items`, { data: { name, price: 20 } });
    expect(res.status()).toBe(201);
    const { id } = await res.json();
    created.push(id);

    const listed = await (await request.get(`${API_URL}/api/items`)).json();
    expect.soft(listed.find((item: { id: string }) => item.id === id)).toMatchObject({ id, name, price: 20 });

    await openLoaded(page);
    await expect(itemsPage(page).item(name)).toHaveText(`${name} — $20.00 (discounted: $18.00)`);
  });
});
