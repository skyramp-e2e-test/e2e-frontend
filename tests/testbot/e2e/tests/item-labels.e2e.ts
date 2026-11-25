import { test, expect, type Page, type Locator } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";

// The frontend (pages and its /api proxy) and the API behind it, for seeding and cleanup.
const baseUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND || process.env.SKYRAMP_TEST_SERVICE_URL_UI || "http://localhost:8080").replace(/\/$/, "");
const apiUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/$/, "");

// Every item these tests create starts with this, so cleanup-label-items.mjs can find what a stopped run left.
const NAME_PREFIX = "Testbot label ";
const uniqueName = (what: string) => `${NAME_PREFIX}${what} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test.use({ viewport: { width: 1280, height: 900 } });

/** The items page: its elements found by their test ids. */
class ItemsPage {
  readonly list: Locator;
  readonly items: Locator;
  readonly emptyState: Locator;
  readonly nameInput: Locator;
  readonly addButton: Locator;
  readonly status: Locator;
  readonly countValue: Locator;

  constructor(readonly page: Page) {
    this.list = page.getByTestId("item-list");
    this.items = page.getByTestId("item");
    this.emptyState = page.getByTestId("empty-state");
    this.nameInput = page.getByTestId("item-name-input");
    this.addButton = page.getByTestId("add-item-submit");
    this.status = page.getByTestId("status");
    this.countValue = page.getByTestId("item-count-value");
  }

  async open() {
    await this.page.goto(`${baseUrl}/`);
  }

  /** The item in the list at this position, in the order the API answered. */
  itemAt(index: number) {
    return this.list.locator(`[data-testid="item"][data-index="${index}"]`);
  }

  /** The item in the list with this id. */
  itemWithId(id: string) {
    return this.list.locator(`[data-testid="item"][data-item-id="${id}"]`);
  }

  /** The list's count once it has rendered (data-count is set by render()). */
  async renderedCount() {
    await expect(this.list).toHaveAttribute("data-count", /^\d+$/);
    return Number(await this.list.getAttribute("data-count"));
  }
}

/**
 * Checks the exact text an item shows. toHaveText normalises whitespace, so it would pass an untrimmed label:
 * textContent is compared as it is, retried until it holds.
 */
async function expectExactLabel(item: Locator, label: string) {
  await expect(item).toHaveJSProperty("textContent", label);
}

/** Scripts the API answers the page loads its list and count from (for the label cases only, never a journey). */
async function answerItems(page: Page, items: unknown, count: number) {
  await page.route("**/api/items", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) }),
  );
  await page.route("**/api/items/count", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ count }) }),
  );
}

async function deleteItem(id: string) {
  await fetch(`${apiUrl}/api/items/${encodeURIComponent(id)}`, { method: "DELETE" });
}

test.describe("item labels in the item list", () => {
  let items: ItemsPage;
  const created: string[] = [];

  test.beforeEach(async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    items = new ItemsPage(page);
  });

  test.afterEach(async () => {
    while (created.length) await deleteItem(created.pop()!);
  });

  test("bare string labels are shown with surrounding whitespace removed", async () => {
    await test.step("array of strings", async () => {
      await answerItems(items.page, ["  Milk  ", "\tEggs\n"], 2);
      await items.open();
      await expect(items.list).toHaveAttribute("data-count", "2");
      await expectExactLabel(items.itemAt(0), "Milk");
      await expectExactLabel(items.itemAt(1), "Eggs");
    });
    await test.step("{ items: [...] } shape", async () => {
      await items.page.unrouteAll();
      await answerItems(items.page, { items: ["  Wrapped  "] }, 1);
      await items.open();
      await expect(items.list).toHaveAttribute("data-count", "1");
      await expectExactLabel(items.itemAt(0), "Wrapped");
    });
  });

  test("object item names are shown with surrounding whitespace removed", async () => {
    await answerItems(items.page, [{ id: "1", name: "  Milk  " }, { id: "2", name: "\tEggs\n" }], 2);
    await items.open();
    await expect(items.list).toHaveAttribute("data-count", "2");
    await expectExactLabel(items.itemWithId("1"), "Milk");
    await expectExactLabel(items.itemWithId("2"), "Eggs");
  });

  test("an object item title is shown with surrounding whitespace removed", async () => {
    await answerItems(items.page, [{ id: "4", title: "  Titled  " }], 1);
    await items.open();
    await expect(items.list).toHaveAttribute("data-count", "1");
    await expectExactLabel(items.itemWithId("4"), "Titled");
  });

  test("a string label keeps the whitespace inside it", async () => {
    await answerItems(items.page, ["  New  York  "], 1);
    await items.open();
    await expect(items.list).toHaveAttribute("data-count", "1");
    await expectExactLabel(items.itemAt(0), "New  York");
  });

  test("an object name label keeps the whitespace inside it", async () => {
    await answerItems(items.page, [{ id: "5", name: "  New  York  " }], 1);
    await items.open();
    await expect(items.list).toHaveAttribute("data-count", "1");
    await expectExactLabel(items.itemWithId("5"), "New  York");
  });
});

test.describe("user journeys", () => {
  const created: string[] = [];

  test.afterEach(async () => {
    while (created.length) await deleteItem(created.pop()!);
  });

  test("open the items list and read clean item labels", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const items = new ItemsPage(page);
    // Items saved through the app with stray whitespace around (and inside) their names.
    const labels = [uniqueName("Milk"), uniqueName("New  York")];
    const ids: string[] = [];
    for (const label of labels) {
      const res = await fetch(`${baseUrl}/api/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `  ${label}\t ` }),
      });
      expect(res.status).toBe(201);
      const item = await res.json();
      created.push(item.id);
      ids.push(item.id);
    }

    await test.step("1. open the items page", async () => {
      const listed = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "GET");
      await items.open();
      const answered = await (await listed).json();
      const answeredItems = Array.isArray(answered) ? answered : answered.items;
      await expect.soft(items.list).toHaveAttribute("data-count", String(answeredItems.length));
      await expect.soft(items.emptyState).toBeHidden();
    });

    await test.step("2. read each item in the list", async () => {
      await expect.soft(items.itemWithId(ids[0])).toHaveJSProperty("textContent", labels[0]);
      await expect.soft(items.itemWithId(ids[1])).toHaveJSProperty("textContent", labels[1]);
    });
  });

  test("add an item with stray spaces and see it in the list", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const items = new ItemsPage(page);
    const name = uniqueName("Padded Milk");
    let before = 0;
    let countBefore = 0;

    await test.step("1. type the name with surrounding spaces in the Item name box", async () => {
      await items.open();
      before = await items.renderedCount();
      await expect(items.countValue).toHaveText(/^\d+$/);
      countBefore = Number(await items.countValue.textContent());
      await items.nameInput.fill(`  ${name}  `);
      await expect.soft(items.nameInput).toHaveValue(`  ${name}  `);
      await expect.soft(items.list).toHaveAttribute("data-count", String(before));
    });

    await test.step("2. click Add", async () => {
      const posted = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "POST");
      await items.addButton.click();
      const response = await posted;
      expect.soft(response.request().postDataJSON()).toEqual({ name });
      const item = await response.json();
      if (item && item.id) created.push(item.id);
      await expect.soft(items.status).toHaveJSProperty("textContent", `Added "${name}"`);
      await expect.soft(items.status).toHaveAttribute("data-state", "ok");
      await expect.soft(items.list).toHaveAttribute("data-count", String(before + 1));
      await expect.soft(items.countValue).toHaveText(String(countBefore + 1));
      await expect.soft(items.itemWithId(item.id)).toHaveJSProperty("textContent", name);
    });
  });
});
