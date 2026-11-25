// Adding an item through the form against the running e2e-api (no stubs): the new row is shown by its
// trimmed name. Each test deletes the item it made through the API.
import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { Page } from "@playwright/test";
import { ItemsPage, apiBaseUrl } from "../items-page";

async function deleteItemsNamed(name: string) {
  const res = await fetch(`${apiBaseUrl}/api/items`);
  const items: { id: string; name: string }[] = await res.json();
  for (const item of items.filter((i) => i.name === name)) {
    await fetch(`${apiBaseUrl}/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
  }
}

test.describe("add item with surrounding whitespace", () => {
  let created: string | undefined;

  test.afterEach(async () => {
    if (created) await deleteItemsNamed(created);
    created = undefined;
  });

  test("journey: add an item typed with extra spaces and see it listed by its clean name", async ({ page: rawPage }) => {
    const page = newSkyrampPlaywrightPage(rawPage) as Page;
    const itemsPage = new ItemsPage(page);
    const name = `Journey Apple ${Date.now()}`;
    created = name;
    let before = 0;

    await test.step("1. open the items page and wait for the list to load", async () => {
      await itemsPage.goto();
      await expect.soft(itemsPage.status).toHaveText("");
      await expect(itemsPage.list).toHaveAttribute("data-count", /^\d+$/);
      before = Number(await itemsPage.list.getAttribute("data-count"));
      await expect.soft(itemsPage.countValue).toHaveText(String(before));
    });

    await test.step("2. type the name with surrounding spaces and click Add", async () => {
      await itemsPage.nameInput.fill(`  ${name}  `);
      const postRequest = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/items");
      await itemsPage.addButton.click();
      expect.soft((await postRequest).postDataJSON()).toEqual({ name });
      await expect(itemsPage.listWithCount(before + 1)).toBeVisible();
      expect.soft(await itemsPage.items.filter({ hasText: name }).evaluateAll((rows) => rows.map((r) => r.textContent))).toEqual([name]);
      await expect.soft(itemsPage.status).toHaveText(`Added "${name}"`);
      await expect.soft(itemsPage.status).toHaveAttribute("data-state", "ok");
      await expect.soft(itemsPage.nameInput).toHaveValue("");
      await expect.soft(itemsPage.countValue).toHaveText(String(before + 1));
    });

    await test.step("outcome: the new item is still listed by its clean name after a reload", async () => {
      await itemsPage.goto();
      await expect(itemsPage.listWithCount(before + 1)).toBeVisible();
      expect(await itemsPage.items.filter({ hasText: name }).evaluateAll((rows) => rows.map((r) => r.textContent))).toEqual([name]);
      await expect(itemsPage.countValue).toHaveText(String(before + 1));
    });
  });
});
