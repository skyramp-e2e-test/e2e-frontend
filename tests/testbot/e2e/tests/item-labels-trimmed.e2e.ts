import { test, expect, type Page } from "@playwright/test";
import { checkRequestPayload } from "@skyramp/skyramp";
import { ItemsPage } from "../pages/items-page";

// Each test stubs the API answers the page loads, so the labels it checks come only from the stubbed items.
async function stubItems(page: Page, items: unknown[]): Promise<void> {
  await page.route("**/api/items/count", (route) => route.fulfill({ json: { count: items.length } }));
  await page.route("**/api/items", (route) => route.fulfill({ status: 200, json: items }));
}

test.describe("item list labels are trimmed", () => {
  test("padded string items are shown as their trimmed text", async ({ page }) => {
    await stubItems(page, ["  apple  ", "banana "]);
    const items = new ItemsPage(page);
    await items.goto();

    await expect(items.items).toHaveCount(2);
    await expect.poll(() => items.labels()).toEqual(["apple", "banana"]);
    await expect(items.list).toHaveAttribute("data-count", "2");
    await expect(items.emptyState).toBeHidden();
  });

  test("number items are shown as their string form, trimmed", async ({ page }) => {
    await stubItems(page, [42, "  x"]);
    const items = new ItemsPage(page);
    await items.goto();

    await expect(items.items).toHaveCount(2);
    await expect.poll(() => items.labels()).toEqual(["42", "x"]);
  });

  test("a whitespace-only item is shown with an empty label and still counted", async ({ page }) => {
    await stubItems(page, ["   ", "ok"]);
    const items = new ItemsPage(page);
    await items.goto();

    await expect(items.items).toHaveCount(2);
    await expect.poll(() => items.labels()).toEqual(["", "ok"]);
    await expect(items.list).toHaveAttribute("data-count", "2");
    await expect(items.emptyState).toBeHidden();
  });

  test("object items show their name or title trimmed", async ({ page }) => {
    await stubItems(page, [
      { id: "1", name: "  Widget  " },
      { id: "2", title: " Gadget " },
    ]);
    const items = new ItemsPage(page);
    await items.goto();

    await expect(items.item("1")).toHaveCount(1);
    await expect(items.item("2")).toHaveCount(1);
    await expect.soft.poll(() => items.item("1").evaluate((el) => el.textContent)).toBe("Widget");
    await expect.soft.poll(() => items.item("2").evaluate((el) => el.textContent)).toBe("Gadget");
  });

  test("after adding an item the reloaded list shows trimmed labels", async ({ page }) => {
    let added = false;
    await page.route("**/api/items/count", (route) => route.fulfill({ json: { count: added ? 1 : 0 } }));
    await page.route("**/api/items", (route) => {
      if (route.request().method() === "POST") {
        added = true;
        return route.fulfill({ status: 201, json: {} });
      }
      return route.fulfill({ status: 200, json: added ? ["  pear  "] : [] });
    });
    const items = new ItemsPage(page);
    await items.goto();
    await expect(items.emptyState).toBeVisible();
    await expect(items.items).toHaveCount(0);

    await items.nameInput.fill("pear");
    const posted = page.waitForRequest((req) => req.method() === "POST" && new URL(req.url()).pathname === "/api/items");
    await items.submit.click();
    checkRequestPayload((await posted).postDataJSON(), { name: "pear" });

    await expect(items.status).toHaveText('Added "pear"');
    await expect(items.items).toHaveCount(1);
    await expect.poll(() => items.labels()).toEqual(["pear"]);
  });
});
