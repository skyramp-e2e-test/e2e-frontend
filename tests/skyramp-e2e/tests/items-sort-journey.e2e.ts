import { test, expect } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { created, deleteCreated, itemsPage, listApiItems, seed, UI_URL } from "../support/items";

// The user journey of the items page sorted by name, against the real app and API (no network stubs).

test.afterEach(async () => {
  await deleteCreated();
});

test("view the list A-Z and add an item that lands in its sorted place", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const ui = itemsPage(page);
  const seeded = await seed(["Cherry", "Apple", "Banana"]);
  const idOf = Object.fromEntries(seeded.map((i) => [i.name, i.id]));

  await test.step("1. open the items page and see Apple, Banana, Cherry", async () => {
    await ui.open();
    await expect.soft(ui.items).toHaveText(["Apple", "Banana", "Cherry"]);
    expect.soft(await ui.indexes()).toEqual(["0", "1", "2"]);
    for (const name of ["Apple", "Banana", "Cherry"]) {
      await expect.soft(ui.items.filter({ hasText: name })).toHaveAttribute("data-item-id", idOf[name]);
    }
    await expect.soft(ui.list).toHaveAttribute("data-count", "3");
    await expect.soft(ui.countValue).toHaveText("3");
    await expect.soft(ui.emptyState).toBeHidden();
    expect.soft((await listApiItems(UI_URL)).map((i) => i.name)).toEqual(["Cherry", "Apple", "Banana"]);
  });

  await test.step("2. add 'apricot' and see it in its sorted place", async () => {
    await expect(ui.nameInput).toBeVisible();
    await ui.nameInput.fill("apricot");
    const posted = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "POST");
    await ui.addButton.click();
    const res = await posted;
    expect.soft(res.request().postDataJSON()).toEqual({ name: "apricot" });
    expect.soft(res.status()).toBe(201);
    if (res.ok()) created.push((await res.json()).id);
    await expect.soft(ui.status).toHaveText('Added "apricot"');
    await expect.soft(ui.status).toHaveAttribute("data-state", "ok");
    await expect.soft(ui.items).toHaveText(["Apple", "apricot", "Banana", "Cherry"]);
    expect.soft(await ui.indexes()).toEqual(["0", "1", "2", "3"]);
    await expect.soft(ui.list).toHaveAttribute("data-count", "4");
    await expect.soft(ui.countValue).toHaveText("4");
    await expect.soft(ui.nameInput).toHaveValue("");
  });

  await test.step("outcome persists after a reload", async () => {
    await ui.open();
    await expect(ui.items).toHaveText(["Apple", "apricot", "Banana", "Cherry"]);
    expect(await ui.indexes()).toEqual(["0", "1", "2", "3"]);
    await expect(ui.list).toHaveAttribute("data-count", "4");
    await expect(ui.countValue).toHaveText("4");
    await expect(ui.status).toHaveAttribute("data-state", "ok");
  });
});
