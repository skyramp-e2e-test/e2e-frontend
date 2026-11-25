// Journey: see the item list with trimmed labels, then add an item, against the real app and API.
// The API trims names on write, so the item it lists for a padded name comes back as the trimmed label.
import { test, expect } from "@playwright/test";
import { checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { apiUrl, frontendUrl, itemsPage } from "../support/items-page";

// Names start with this prefix so cleanup-journey-items.mjs can find what a stopped run left behind.
const PREFIX = "labels-journey-";

test("see the item list with trimmed labels, then add an item", async ({ page, request }) => {
  test.setTimeout(30_000);
  page = newSkyrampPlaywrightPage(page);
  const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const oldName = `${PREFIX}old-${run}`;
  const newName = `${PREFIX}new-${run}`;
  const created: string[] = [];
  const ui = itemsPage(page);
  const ours = async () => (await ui.labels()).filter((l) => l?.includes(run));

  try {
    const seeded = await request.post(`${apiUrl}/api/items`, { data: { name: `  ${oldName}  ` } });
    expect(seeded.status()).toBe(201);
    created.push((await seeded.json()).id);

    await test.step("1. open the items page: the item is listed with its label trimmed", async () => {
      await page.goto(`${frontendUrl}/`);
      await expect.soft(ui.status).toHaveText("");
      await expect.soft(ui.emptyState).toBeHidden();
      await expect.soft(ui.items.filter({ hasText: oldName })).toHaveCount(1);
      expect.soft(await ours()).toEqual([oldName]);
      await page.evaluate(() => ((window as unknown as { __sameDocument: boolean }).__sameDocument = true));
    });

    await test.step("2. add an item: status confirms it and the list shows both labels, trimmed", async () => {
      await ui.nameInput.fill(`  ${newName}  `);
      const postDone = page.waitForResponse(
        (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/items",
      );
      await ui.addButton.click();
      const post = await postDone;
      checkRequestPayload(post.request().postDataJSON(), { name: newName });
      expect.soft(post.status()).toBe(201);
      created.push((await post.json()).id);
      await expect.soft(ui.status).toHaveText(`Added "${newName}"`);
      await expect.soft(ui.status).toHaveAttribute("data-state", "ok");
      await expect.soft(ui.items.filter({ hasText: newName })).toHaveCount(1);
      expect.soft(await ours()).toEqual([oldName, newName]);
      expect
        .soft(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument))
        .toBe(true);
    });
  } finally {
    for (const id of created) await request.delete(`${apiUrl}/api/items/${encodeURIComponent(id)}`);
  }
});
