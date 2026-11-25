// Item labels in the list (public/app.js itemLabel): GET /api/items is stubbed in the page so each
// test controls exactly which items the list renders.
import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { Page } from "@playwright/test";
import { ItemsPage } from "../items-page";

async function openWithItems(rawPage: Page, items: unknown[]): Promise<ItemsPage> {
  const page = newSkyrampPlaywrightPage(rawPage) as Page;
  const itemsPage = new ItemsPage(page);
  await itemsPage.stubItems(items);
  await itemsPage.goto();
  await expect(itemsPage.listWithCount(items.length)).toBeVisible();
  return itemsPage;
}

test.describe("item labels", () => {
  test("string items are shown with surrounding whitespace trimmed", async ({ page }) => {
    const itemsPage = await openWithItems(page, ["  Apple  ", "\tBanana\n", "   "]);
    expect(await itemsPage.rowTexts()).toEqual(["Apple", "Banana", ""]);
    await expect(itemsPage.list).toHaveAttribute("data-count", "3");
    await expect(itemsPage.emptyState).toBeHidden();
    await expect(itemsPage.status).toHaveText("");
    await expect(itemsPage.status).toHaveAttribute("data-state", "ok");
  });

  test("object item name is shown with surrounding whitespace trimmed", async ({ page }) => {
    const itemsPage = await openWithItems(page, [{ id: "1", name: "  Apple  " }]);
    await expect(itemsPage.items).toHaveAttribute("data-item-id", "1");
    expect(await itemsPage.rowTexts()).toEqual(["Apple"]);
  });

  test("object item title is shown with surrounding whitespace trimmed when it has no name", async ({ page }) => {
    const itemsPage = await openWithItems(page, [{ id: "2", title: "  Pear " }]);
    await expect(itemsPage.items).toHaveAttribute("data-item-id", "2");
    expect(await itemsPage.rowTexts()).toEqual(["Pear"]);
  });

  test("labels without surrounding whitespace keep their inner spaces", async ({ page }) => {
    const itemsPage = await openWithItems(page, ["Big  Red Apple", { id: "3", name: "Green  Pear" }]);
    expect(await itemsPage.rowTexts()).toEqual(["Big  Red Apple", "Green  Pear"]);
  });

  test("a number item is shown as its string form", async ({ page }) => {
    const itemsPage = await openWithItems(page, [42]);
    expect(await itemsPage.rowTexts()).toEqual(["42"]);
  });
});
