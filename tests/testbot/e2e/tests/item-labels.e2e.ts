import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { ItemsPage, addedItemPrefix, deleteItemsNamed } from "../pages/items-page";

test.describe("item labels in the list", () => {
  let items: ItemsPage;

  test.beforeEach(async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    items = new ItemsPage(page);
  });

  /** Show `body` as the GET /api/items answer and return each row's raw textContent once `count` rows are shown. */
  async function labelsFor(body: unknown, count: number): Promise<string[]> {
    await items.stubItems(body, count);
    await items.open();
    await items.waitForListCount(count);
    return items.labels();
  }

  test("a string item with surrounding spaces is shown without them", async () => {
    expect(await labelsFor(["  apple  "], 1)).toEqual(["apple"]);
  });

  test("tabs and newlines around a string item are trimmed", async () => {
    expect(await labelsFor(["\t\nbanana\n\t"], 1)).toEqual(["banana"]);
  });

  test("whitespace inside a string label is kept", async () => {
    expect(await labelsFor([" red  apple "], 1)).toEqual(["red  apple"]);
  });

  test("a whitespace-only string item still renders as one row with an empty label", async () => {
    expect(await labelsFor(["   "], 1)).toEqual([""]);
    await expect(items.items).toHaveCount(1);
    await expect(items.list).toHaveAttribute("data-count", "1");
    await expect(items.emptyState).toBeHidden();
  });

  test("an object item's name with surrounding whitespace is shown trimmed", async () => {
    await items.stubItems([{ id: "1", name: "  pear  " }], 1);
    await items.open();
    await items.waitForListCount(1);
    expect(await items.itemById("1").textContent()).toBe("pear");
  });

  test("an object item's title with surrounding whitespace is shown trimmed when it has no name", async () => {
    await items.stubItems([{ id: "2", title: " plum  " }], 1);
    await items.open();
    await items.waitForListCount(1);
    expect(await items.itemById("2").textContent()).toBe("plum");
  });

  test("a number item is shown as its decimal string", async () => {
    expect(await labelsFor([42], 1)).toEqual(["42"]);
  });

  test("labels in a wrapped items answer are trimmed, in order", async () => {
    expect(await labelsFor({ items: ["  apple  ", 7, " x "] }, 3)).toEqual(["apple", "7", "x"]);
    await expect(items.list).toHaveAttribute("data-count", "3");
  });
});

test.describe("adding an item through the form", () => {
  const name = `${addedItemPrefix}${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  test.afterEach(async () => {
    await deleteItemsNamed(name);
  });

  test("the added item is listed by its trimmed name and the count goes up by one", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const items = new ItemsPage(page);
    await items.open();
    const before = await items.shownCount();

    await items.nameInput.fill(`  ${name}  `);
    const posted = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/items");
    await items.submit.click();
    expect((await posted).postDataJSON()).toEqual({ name });

    await expect(items.status).toHaveText(`Added "${name}"`);
    await expect(items.status).toHaveAttribute("data-state", "ok");
    const row = items.items.filter({ hasText: name });
    await expect(row).toHaveCount(1);
    expect(await row.textContent()).toBe(name);
    await expect(items.countValue).toHaveText(String(before + 1));
    await expect(items.nameInput).toHaveValue("");
  });
});
