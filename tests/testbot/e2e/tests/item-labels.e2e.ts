// Item labels in the list are shown trimmed (leading and trailing whitespace removed).
// GET /api/items is scripted in the browser: the e2e-api trims names on write, so it never returns these shapes.
import { test, expect, type Page } from "@playwright/test";
import { checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { frontendUrl, itemsPage, scriptItems } from "../support/items-page";

test.describe.configure({ timeout: 30_000 });

async function openWithItems(page: Page, items: unknown[]) {
  await scriptItems(page, () => items);
  await page.goto(`${frontendUrl}/`);
  const ui = itemsPage(page);
  await expect(ui.status).toHaveText("");
  await expect(ui.list).toHaveAttribute("data-count", String(items.length));
  return ui;
}

test("bare string labels are shown without surrounding whitespace, inner spaces kept", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const ui = await openWithItems(page, ["  Alpha Beta  ", "\tGamma\n"]);
  expect(await ui.labels()).toEqual(["Alpha Beta", "Gamma"]);
  await expect(ui.list).toHaveAttribute("data-count", "2");
  await expect(ui.emptyState).toBeHidden();
});

test("an item object's name is shown trimmed", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const ui = await openWithItems(page, [{ id: "a1", name: "  Delta  " }]);
  await expect(ui.items).toHaveCount(1);
  expect(await ui.item("a1").evaluate((el) => el.textContent)).toBe("Delta");
});

test("an item object's title is shown trimmed when it has no name", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const ui = await openWithItems(page, [{ id: "b2", title: "\n Epsilon \t" }]);
  await expect(ui.items).toHaveCount(1);
  expect(await ui.item("b2").evaluate((el) => el.textContent)).toBe("Epsilon");
});

test("a number item is shown as its string form", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const ui = await openWithItems(page, [42]);
  expect(await ui.labels()).toEqual(["42"]);
});

test("labels reloaded after adding an item are shown trimmed", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  let added = false;
  let posted: unknown;
  await scriptItems(
    page,
    () => (added ? ["  Old  ", "  New  "] : ["  Old  "]),
    async (route) => {
      posted = route.request().postDataJSON();
      added = true;
      await route.fulfill({ status: 201, json: { id: "n1", name: "New" } });
    },
  );
  await page.goto(`${frontendUrl}/`);
  const ui = itemsPage(page);
  await expect(ui.status).toHaveText("");
  await expect(ui.list).toHaveAttribute("data-count", "1");
  expect(await ui.labels()).toEqual(["Old"]);
  await page.evaluate(() => ((window as unknown as { __sameDocument: boolean }).__sameDocument = true));

  await ui.nameInput.fill("New");
  await ui.addButton.click();
  await expect(ui.status).toHaveText('Added "New"');
  await expect(ui.status).toHaveAttribute("data-state", "ok");
  checkRequestPayload(posted, { name: "New" });
  await expect(ui.list).toHaveAttribute("data-count", "2");
  expect(await ui.labels()).toEqual(["Old", "New"]);
  expect(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument)).toBe(true);
});
