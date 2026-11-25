// Item labels on the Items page, with the page's GET /api/items answered by a stub so each label shape is exact.
import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { ItemsPage } from "../support/items-page";

let items: ItemsPage;

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(15000);
  items = new ItemsPage(newSkyrampPlaywrightPage(page));
});

test("a string item with surrounding whitespace is shown trimmed, inner space kept", async () => {
  await items.stubItems(["  red apple  "]);
  await items.goto();
  await expect(items.list).toHaveAttribute("data-count", "1");
  expect(await items.allTexts()).toEqual(["red apple"]);
  await expect(items.emptyState).toBeHidden();
});

test("an item object's name with surrounding whitespace is shown trimmed", async () => {
  await items.stubItems([
    { id: "a1", name: "  Widget  " },
    { id: "a2", name: "Gadget" },
  ]);
  await items.goto();
  await expect(items.list).toHaveAttribute("data-count", "2");
  expect.soft(await ItemsPage.textOf(items.itemById("a2"))).toBe("Gadget");
  expect(await ItemsPage.textOf(items.itemById("a1"))).toBe("Widget");
});

test("an item object labelled by its title is shown with the title trimmed", async () => {
  await items.stubItems({ items: [{ id: "t1", title: "  Gizmo " }] });
  await items.goto();
  await expect(items.list).toHaveAttribute("data-count", "1");
  expect(await ItemsPage.textOf(items.itemById("t1"))).toBe("Gizmo");
});

test("a whitespace-only string item is still listed with an empty label", async () => {
  await items.stubItems(["   ", "kiwi"]);
  await items.goto();
  await expect(items.list).toHaveAttribute("data-count", "2");
  await expect(items.items).toHaveCount(2);
  expect(await items.allTexts()).toEqual(["", "kiwi"]);
  await expect(items.emptyState).toBeHidden();
});

test("numeric and boolean items still show their string form", async () => {
  await items.stubItems([42, 0, false]);
  await items.goto();
  await expect(items.list).toHaveAttribute("data-count", "3");
  expect(await items.allTexts()).toEqual(["42", "0", "false"]);
  await expect(items.status).toHaveAttribute("data-state", "ok");
});

test("item object names and titles with tabs and spaces around them are shown trimmed", async () => {
  await items.stubItems([
    { id: "a1", name: "  Widget  " },
    { id: "t1", title: "\tGizmo  " },
  ]);
  await items.goto();
  await expect(items.list).toHaveAttribute("data-count", "2");
  expect.soft(await ItemsPage.textOf(items.itemById("a1"))).toBe("Widget");
  expect.soft(await ItemsPage.textOf(items.itemById("t1"))).toBe("Gizmo");
});
