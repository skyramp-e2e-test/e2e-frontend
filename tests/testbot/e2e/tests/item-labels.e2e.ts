// Item labels in the list are shown without leading or trailing whitespace (e2e-frontend#47).
// The routed cases answer GET /api/items from the test, since the real API trims names on every write.
import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { Page } from "@playwright/test";
import { ITEM_NAME_PREFIX, createItem, deleteItemsNamed } from "../support/items-api";

const pageTimeout = 15000;

/** Answers GET /api/items with `body`; any other method goes on to the app. */
async function answerItemsWith(page: Page, body: unknown) {
  await page.route("**/api/items", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
      : route.continue(),
  );
}

const itemList = (page: Page) => page.getByTestId("item-list");
const items = (page: Page) => page.getByTestId("item");
const itemNamed = (page: Page, text: string) => items(page).filter({ hasText: text });
const labels = (page: Page) => items(page).evaluateAll((els) => els.map((el) => el.textContent));
const textOf = (locator: ReturnType<Page["locator"]>) => locator.evaluate((el) => el.textContent);

function uniqueItemName() {
  return `${ITEM_NAME_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe("item labels", () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(pageTimeout);
  });

  test("string items with surrounding whitespace are shown trimmed", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await answerItemsWith(page, ["  Apple  ", "\tBanana\n"]);
    await page.goto("/");
    await expect(itemList(page)).toHaveAttribute("data-count", "2");
    expect(await items(page).evaluateAll((els) => els.map((el) => el.textContent))).toEqual(["Apple", "Banana"]);
  });

  test("an object item's name is shown trimmed", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await answerItemsWith(page, [{ id: "a1", name: "  Apple  " }]);
    await page.goto("/");
    await expect(itemList(page)).toHaveAttribute("data-count", "1");
    expect(await textOf(itemNamed(page, "Apple"))).toBe("Apple");
  });

  test("an object item labelled by its title has the title trimmed", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await answerItemsWith(page, [{ id: "t1", title: "  Pear " }]);
    await page.goto("/");
    await expect(itemList(page)).toHaveAttribute("data-count", "1");
    expect(await textOf(itemNamed(page, "Pear"))).toBe("Pear");
  });

  test("object items with padded name and title are both shown trimmed", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await answerItemsWith(page, [{ id: "a1", name: "  Apple  " }, { id: "t1", title: "\tPear " }]);
    await page.goto("/");
    await expect(itemList(page)).toHaveAttribute("data-count", "2");
    expect.soft(await textOf(itemNamed(page, "Apple"))).toBe("Apple");
    expect.soft(await textOf(itemNamed(page, "Pear"))).toBe("Pear");
  });

  test("whitespace inside a label is kept", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await answerItemsWith(page, ["  Green  tea "]);
    await page.goto("/");
    await expect(itemList(page)).toHaveAttribute("data-count", "1");
    expect(await labels(page)).toEqual(["Green  tea"]);
  });

  test("a whitespace-only string item is shown with an empty label", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await answerItemsWith(page, ["   ", "Plum"]);
    await page.goto("/");
    await expect(itemList(page)).toHaveAttribute("data-count", "2");
    // The order is what is checked: the whitespace-only item comes first, then "Plum".
    expect(await labels(page)).toEqual(["", "Plum"]);
  });

  test("an item added through the form is listed with its trimmed name", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const name = uniqueItemName();
    try {
      await page.goto("/");
      await expect(page.getByTestId("status")).toHaveText("");
      await page.getByTestId("item-name-input").fill(`  ${name}  `);
      const postRequest = page.waitForRequest((r) => r.url().endsWith("/api/items") && r.method() === "POST");
      await page.getByTestId("add-item-submit").click();
      expect((await postRequest).postDataJSON()).toEqual({ name });
      await expect(page.getByTestId("status")).toHaveText(`Added "${name}"`);
      await expect(items(page).filter({ hasText: name })).toHaveCount(1);
      expect(await textOf(items(page).filter({ hasText: name }))).toBe(name);
    } finally {
      await deleteItemsNamed(name);
    }
  });

  test("user sees trimmed labels and adds an item that is listed trimmed", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const listed = `${ITEM_NAME_PREFIX}green  tea-${Date.now()}`;
    const name = uniqueItemName();
    try {
      // The API keeps inner spacing and trims the ends of every name it saves.
      await createItem(`  ${listed} `);

      await test.step("open the items page and see an item with inner spacing listed trimmed", async () => {
        await page.goto("/");
        await expect(itemNamed(page, listed.replace("  ", " "))).toHaveCount(1);
        expect.soft(await textOf(itemNamed(page, listed.replace("  ", " ")))).toBe(listed);
      });

      await test.step("add an item with a padded name through the form", async () => {
        await page.getByTestId("item-name-input").fill(`  ${name}  `);
        const postRequest = page.waitForRequest((r) => r.url().endsWith("/api/items") && r.method() === "POST");
        await page.getByTestId("add-item-submit").click();
        expect.soft((await postRequest).postDataJSON()).toEqual({ name });
        await expect.soft(page.getByTestId("status")).toHaveText(`Added "${name}"`);
        await expect.soft(itemNamed(page, name)).toHaveCount(1);
        expect.soft(await textOf(itemNamed(page, name))).toBe(name);
      });

      await test.step("both items are still listed trimmed after a reload", async () => {
        await page.reload();
        await expect(itemNamed(page, name)).toHaveCount(1);
        expect.soft(await textOf(itemNamed(page, name))).toBe(name);
        expect(await textOf(itemNamed(page, listed.replace("  ", " ")))).toBe(listed);
      });
    } finally {
      await deleteItemsNamed(name, listed);
    }
  });
});
