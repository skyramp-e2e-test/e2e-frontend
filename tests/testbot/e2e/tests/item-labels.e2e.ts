// Item labels in the item list are trimmed of leading and trailing whitespace (e2e-frontend#42).
import { test, expect, type Page } from "@playwright/test";
import { checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { UI_URL, deleteItemsNamed, itemsPage, runId, textOf, textsOf } from "../item-label-page";

test.describe.configure({ timeout: 60_000 });

// Opens the page with GET /api/items (and its count) answered by the given items, then waits for them to render.
async function openWithItems(page: Page, items: unknown[]) {
  await page.route("**/api/items", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) })
      : route.fallback(),
  );
  await page.route("**/api/items/count", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ count: items.length }) }),
  );
  await page.goto(`${UI_URL}/`);
  const ui = itemsPage(page);
  await expect(ui.list).toHaveAttribute("data-count", String(items.length));
  return ui;
}

test.describe("item labels in the item list", () => {
  test("string labels with surrounding whitespace are shown trimmed", async ({ page }) => {
    const ui = await openWithItems(newSkyrampPlaywrightPage(page), ["  Apple  ", "\tBanana\n"]);
    await expect(ui.items).toHaveCount(2);
    await expect.poll(textsOf(ui.items)).toEqual(["Apple", "Banana"]);
  });

  test("object item name with surrounding whitespace is shown trimmed", async ({ page }) => {
    const ui = await openWithItems(newSkyrampPlaywrightPage(page), [{ id: "a1", name: "  Apple  " }]);
    await expect(ui.itemById("a1")).toHaveCount(1);
    await expect.poll(textOf(ui.itemById("a1"))).toBe("Apple");
  });

  test("object item title with surrounding whitespace is shown trimmed when it has no name", async ({ page }) => {
    const ui = await openWithItems(newSkyrampPlaywrightPage(page), [{ id: "t1", title: "  Pear " }]);
    await expect(ui.itemById("t1")).toHaveCount(1);
    await expect.poll(textOf(ui.itemById("t1"))).toBe("Pear");
  });

  test("trimming keeps whitespace inside a string label", async ({ page }) => {
    const ui = await openWithItems(newSkyrampPlaywrightPage(page), ["  Big  Apple "]);
    await expect(ui.items).toHaveCount(1);
    await expect.poll(textsOf(ui.items)).toEqual(["Big  Apple"]);
  });

  test("number and already-clean string labels are shown unchanged", async ({ page }) => {
    const ui = await openWithItems(newSkyrampPlaywrightPage(page), [42, "Apple"]);
    await expect(ui.items).toHaveCount(2);
    await expect.poll(textsOf(ui.items)).toEqual(["42", "Apple"]);
    await expect(ui.status).toHaveAttribute("data-state", "ok");
    await expect.poll(textOf(ui.status)).toBe("");
  });

  test("padded object name and title are both shown trimmed", async ({ page }) => {
    const ui = await openWithItems(newSkyrampPlaywrightPage(page), [
      { id: "a1", name: "  Apple  " },
      { id: "t1", title: "\tPear " },
    ]);
    await expect.soft.poll(textOf(ui.itemById("a1"))).toBe("Apple");
    await expect.soft.poll(textOf(ui.itemById("t1"))).toBe("Pear");
  });

  test("padded object name keeps its inner spaces when trimmed", async ({ page }) => {
    const ui = await openWithItems(newSkyrampPlaywrightPage(page), [{ id: "b1", name: " Big  Apple " }]);
    await expect(ui.itemById("b1")).toHaveCount(1);
    await expect.poll(textOf(ui.itemById("b1"))).toBe("Big  Apple");
  });

  test.describe("against the real API", () => {
    const created: string[] = [];
    test.afterEach(async () => {
      await deleteItemsNamed(created.splice(0));
    });

    test("an item added through the form is listed under its name", async ({ page }) => {
      page = newSkyrampPlaywrightPage(page);
      const ui = itemsPage(page);
      const name = `Plan Trim Kiwi ${runId()}`;
      created.push(name);

      await page.goto(`${UI_URL}/`);
      await expect(ui.status).toHaveAttribute("data-state", "ok");
      await ui.nameInput.fill(name);
      await expect(ui.nameInput).toHaveValue(name);
      const postPromise = page.waitForResponse(
        (r) => r.url().endsWith("/api/items") && r.request().method() === "POST",
      );
      await ui.submit.click();
      const post = await postPromise;
      checkRequestPayload(post.request().postDataJSON(), { name });
      expect(post.status()).toBe(201);

      await expect(ui.status).toHaveAttribute("data-state", "ok");
      await expect(ui.status).toHaveText(`Added "${name}"`);
      const listed = ui.items.filter({ hasText: name });
      await expect(listed).toHaveCount(1);
      await expect.poll(textOf(listed)).toBe(name);
    });
  });
});
