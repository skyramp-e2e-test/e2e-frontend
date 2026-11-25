import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { ItemsPage, addedItemPrefix, deleteItemsNamed } from "../pages/items-page";

const name = `${addedItemPrefix}${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

test.afterEach(async () => {
  await deleteItemsNamed(name);
});

test("see trimmed item labels in the list and add a new item", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const items = new ItemsPage(page);

  await test.step("1. the list shows each label without its surrounding whitespace", async () => {
    await items.stubItems(["  apple  ", "\t\nbanana\n\t", " red  apple ", "   ", 42], 5);
    await page.goto("/");
    await items.waitForListCount(5);
    expect.soft(await items.labels()).toEqual(["apple", "banana", "red  apple", "", "42"]);
    await expect.soft(items.emptyState).toBeHidden();
    await expect.soft(items.countValue).toHaveText("5");
  });

  await test.step("2. adding an item lists it by its trimmed name and the count goes up by one", async () => {
    await items.unstubItems();
    await page.goto("/");
    const before = await items.shownCount();

    await items.nameInput.fill(`  ${name}  `);
    const posted = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/items");
    await items.submit.click();
    expect.soft((await posted).postDataJSON()).toEqual({ name });

    await expect.soft(items.status).toHaveText(`Added "${name}"`);
    const row = items.items.filter({ hasText: name });
    await expect(row).toHaveCount(1);
    expect.soft(await row.textContent()).toBe(name);
    await expect.soft(items.countValue).toHaveText(String(before + 1));

    await page.reload();
    await expect(items.countValue).toHaveText(String(before + 1));
    await expect(row).toHaveCount(1);
    expect(await row.textContent()).toBe(name);
  });
});
