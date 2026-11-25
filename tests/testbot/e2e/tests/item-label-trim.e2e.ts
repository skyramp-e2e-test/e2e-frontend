// Item labels in the list are shown trimmed of leading and trailing whitespace.
// The items API is stubbed in the browser so each test controls exactly what the list receives.
import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { itemListPage, stubItemsApi } from "../item-list-page";

test("string item labels are shown without leading or trailing whitespace", async ({ page }) => {
  await stubItemsApi(page, () => ["  Apple  ", "\tBanana\n"]);
  page = newSkyrampPlaywrightPage(page);
  const items = itemListPage(page);
  await items.open();
  await expect(items.list).toHaveAttribute("data-count", "2");
  expect(await items.labels()).toEqual(["Apple", "Banana"]);
});

test("trimming keeps whitespace inside a label", async ({ page }) => {
  await stubItemsApi(page, () => ["  Green  Apple "]);
  page = newSkyrampPlaywrightPage(page);
  const items = itemListPage(page);
  await items.open();
  await expect(items.list).toHaveAttribute("data-count", "1");
  expect(await items.labels()).toEqual(["Green  Apple"]);
});

test("object item labels from name or title are shown trimmed", async ({ page }) => {
  await stubItemsApi(page, () => [
    { id: "1", name: "  Cherry  " },
    { id: "2", title: " Date " },
  ]);
  page = newSkyrampPlaywrightPage(page);
  const items = itemListPage(page);
  await items.open();
  await expect(items.list).toHaveAttribute("data-count", "2");
  expect.soft(await items.itemById("1").evaluate((el) => el.textContent)).toBe("Cherry");
  expect.soft(await items.itemById("2").evaluate((el) => el.textContent)).toBe("Date");
});

test("a number item is shown as its string form", async ({ page }) => {
  await stubItemsApi(page, () => [42, "  x "]);
  page = newSkyrampPlaywrightPage(page);
  const items = itemListPage(page);
  await items.open();
  await expect(items.list).toHaveAttribute("data-count", "2");
  expect(await items.labels()).toEqual(["42", "x"]);
});

test("a whitespace-only item still renders a row with an empty label", async ({ page }) => {
  await stubItemsApi(page, () => ["   ", "Apple"]);
  page = newSkyrampPlaywrightPage(page);
  const items = itemListPage(page);
  await items.open();
  await expect(items.list).toHaveAttribute("data-count", "2");
  await expect(items.items).toHaveCount(2);
  expect(await items.labels()).toEqual(["", "Apple"]);
  await expect(items.emptyState).toBeHidden();
});
