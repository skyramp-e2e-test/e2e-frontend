import { test, expect, type Page } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { created, deleteCreated, itemsPage, listApiItems, seed, API_URL, UI_URL, type Item } from "../support/items";

// The items page sorts GET /api/items by the label it shows (name, then title, then JSON),
// case-insensitively and with natural number order. Seeded tests clear the API's items first
// because the list shows every item and its order is what they check.

/** Answer GET /api/items (exact path) and GET /api/items/count with the given bodies. */
async function stubItems(page: Page, itemsBody: unknown, count: number): Promise<void> {
  await page.route("**/api/items", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(itemsBody) })
      : route.continue(),
  );
  await page.route("**/api/items/count", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ count }) }),
  );
}

function expectSortedByLabel(labels: string[]) {
  for (let i = 1; i < labels.length; i++) {
    expect(
      labels[i - 1].localeCompare(labels[i], undefined, { sensitivity: "base", numeric: true }),
      `"${labels[i - 1]}" sorts before "${labels[i]}"`,
    ).toBeLessThanOrEqual(0);
  }
}

test.afterEach(async () => {
  await deleteCreated();
});

test.describe("items created in the order Cherry, Apple, Banana", () => {
  let seeded: Item[];

  test.beforeEach(async () => {
    seeded = await seed(["Cherry", "Apple", "Banana"]);
  });

  test("the list is rendered A-Z by name", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const ui = itemsPage(page);
    await ui.open();
    await expect(ui.list).toHaveAttribute("data-count", "3");
    await expect(ui.items).toHaveText(["Apple", "Banana", "Cherry"]);
    await expect(ui.status).toHaveAttribute("data-state", "ok");
  });

  test("data-index is each item's sorted position", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const ui = itemsPage(page);
    await ui.open();
    await expect(ui.items).toHaveText(["Apple", "Banana", "Cherry"]);
    expect(await ui.indexes()).toEqual(["0", "1", "2"]);
  });

  test("data-item-id moves with its item when sorted", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const ui = itemsPage(page);
    await ui.open();
    const idOf = Object.fromEntries(seeded.map((i) => [i.name, i.id]));
    await expect(ui.items).toHaveText(["Apple", "Banana", "Cherry"]);
    for (const name of ["Apple", "Banana", "Cherry"]) {
      await expect(ui.items.filter({ hasText: name })).toHaveAttribute("data-item-id", idOf[name]);
    }
  });

  test("the API keeps creation order after the page renders it sorted", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const ui = itemsPage(page);
    await ui.open();
    await expect(ui.items).toHaveText(["Apple", "Banana", "Cherry"]);
    expect((await listApiItems(API_URL)).map((i) => i.name)).toEqual(["Cherry", "Apple", "Banana"]);
    expect((await listApiItems(UI_URL)).map((i) => i.name)).toEqual(["Cherry", "Apple", "Banana"]);
  });

  test("data-count, item rows and the total count line agree and the empty state is hidden", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const ui = itemsPage(page);
    await ui.open();
    await expect(ui.list).toHaveAttribute("data-count", "3");
    await expect(ui.items).toHaveCount(3);
    await expect(ui.emptyState).toBeHidden();
    await expect(ui.countValue).toHaveText("3");
  });
});

test("names are compared case-insensitively", async ({ page }) => {
  await seed(["banana", "Apple", "cherry", "apricot"]);
  page = newSkyrampPlaywrightPage(page);
  const ui = itemsPage(page);
  await ui.open();
  await expect(ui.list).toHaveAttribute("data-count", "4");
  await expect(ui.items).toHaveText(["Apple", "apricot", "banana", "cherry"]);
});

test("numbers inside names are ordered naturally", async ({ page }) => {
  await seed(["item 10", "item 2", "item 1"]);
  page = newSkyrampPlaywrightPage(page);
  const ui = itemsPage(page);
  await ui.open();
  await expect(ui.list).toHaveAttribute("data-count", "3");
  await expect(ui.items).toHaveText(["item 1", "item 2", "item 10"]);
});

test("case and numbers are handled together", async ({ page }) => {
  await seed(["Item 10", "item 9", "ITEM 1", "apple"]);
  page = newSkyrampPlaywrightPage(page);
  const ui = itemsPage(page);
  await ui.open();
  await expect(ui.list).toHaveAttribute("data-count", "4");
  await expect(ui.items).toHaveText(["apple", "ITEM 1", "item 9", "Item 10"]);
});

test("an item added through the form appears in its sorted place", async ({ page }) => {
  await seed(["Cherry", "Apple"]);
  page = newSkyrampPlaywrightPage(page);
  const ui = itemsPage(page);
  await ui.open();
  await expect(ui.list).toHaveAttribute("data-count", "2");
  await ui.nameInput.fill("banana");
  const posted = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "POST");
  await ui.addButton.click();
  const res = await posted;
  expect(res.request().postDataJSON()).toEqual({ name: "banana" });
  expect(res.status()).toBe(201);
  created.push((await res.json()).id);
  await expect(ui.status).toHaveText('Added "banana"');
  await expect(ui.items).toHaveText(["Apple", "banana", "Cherry"]);
  expect(await ui.indexes()).toEqual(["0", "1", "2"]);
  await expect(ui.list).toHaveAttribute("data-count", "3");
  expect((await listApiItems()).map((i) => i.name)).toEqual(["Cherry", "Apple", "banana"]);
});

test("items without a name sort by their title, and by their JSON without either", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await stubItems(
    page,
    [{ id: "1", name: "Delta" }, { id: "2", title: "alpha" }, { id: "3", name: "charlie" }, { id: "4", title: "Bravo" }, { id: "5" }],
    5,
  );
  const ui = itemsPage(page);
  await ui.open();
  await expect(ui.list).toHaveAttribute("data-count", "5");
  const labels = await ui.items.allTextContents();
  expect(labels.filter((l) => l !== '{"id":"5"}')).toEqual(["alpha", "Bravo", "charlie", "Delta"]);
  await expect(ui.items.filter({ hasText: '{"id":"5"}' })).toHaveCount(1);
  expectSortedByLabel(labels);
});

test("a response of the form { items: [...] } is sorted the same way", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await stubItems(page, { items: [{ id: "b", name: "Beta" }, { id: "a", name: "alpha" }] }, 2);
  const ui = itemsPage(page);
  await ui.open();
  await expect(ui.list).toHaveAttribute("data-count", "2");
  await expect(ui.items).toHaveText(["alpha", "Beta"]);
});

test("an item whose name is a number is still shown and sorted", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await stubItems(page, [{ id: "b", name: "beta" }, { id: "n", name: 5 }], 2);
  const ui = itemsPage(page);
  await ui.open();
  await expect(ui.status).not.toContainText("Failed to load items");
  await expect(ui.status).toHaveAttribute("data-state", "ok");
  await expect(ui.items).toHaveText(["5", "beta"]);
  await expect(ui.list).toHaveAttribute("data-count", "2");
});

test("an item whose title is a boolean is still shown and sorted", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await stubItems(page, [{ id: "b", name: "beta" }, { id: "t", title: true }], 2);
  const ui = itemsPage(page);
  await ui.open();
  await expect(ui.status).not.toContainText("Failed to load items");
  await expect(ui.status).toHaveAttribute("data-state", "ok");
  await expect(ui.items).toHaveText(["beta", "true"]);
  await expect(ui.list).toHaveAttribute("data-count", "2");
});
