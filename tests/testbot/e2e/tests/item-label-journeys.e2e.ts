// User journeys through the items page against the real app (e2e-frontend#42): no network stubs.
import { test, expect } from "@playwright/test";
import { checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { API_URL, UI_URL, deleteItemsNamed, itemsPage, runId, textOf } from "../item-label-page";

test.describe.configure({ timeout: 60_000 });

test.describe("item label journeys", () => {
  const created: string[] = [];
  test.afterEach(async () => {
    await deleteItemsNamed(created.splice(0));
  });

  test("journey: open the items page and read the item labels", async ({ page, request }) => {
    page = newSkyrampPlaywrightPage(page);
    const ui = itemsPage(page);
    const id = runId();
    // The API trims names when it stores them, so the labels it serves are already clean.
    const sent = [`  Journey Label ${id} A  `, `\tJourney Label ${id} B  two\n`];
    const expected = [`Journey Label ${id} A`, `Journey Label ${id} B  two`];
    created.push(...expected);
    const ids: string[] = [];
    for (const name of sent) {
      const res = await request.post(`${API_URL}/api/items`, { data: { name } });
      expect(res.status()).toBe(201);
      ids.push((await res.json()).id);
    }

    await test.step("1. open the items page", async () => {
      await page.goto(`${UI_URL}/`);
      await expect.soft(ui.status).toHaveAttribute("data-state", "ok");
      await expect.soft.poll(textOf(ui.status)).toBe("");
      const count = Number(await ui.list.getAttribute("data-count"));
      await expect.soft(ui.items).toHaveCount(count);
      for (const itemId of ids) await expect.soft(ui.itemById(itemId)).toHaveCount(1);
    });

    await test.step("2. read each item in the list", async () => {
      for (const [i, itemId] of ids.entries()) {
        await expect.soft.poll(textOf(ui.itemById(itemId))).toBe(expected[i]);
      }
    });

    await test.step("outcome: labels stay trimmed after a reload", async () => {
      await page.reload();
      for (const [i, itemId] of ids.entries()) {
        await expect.soft.poll(textOf(ui.itemById(itemId))).toBe(expected[i]);
      }
    });
  });

  test("journey: add an item and see it in the list", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const ui = itemsPage(page);
    const name = `Plan Trim Kiwi journey ${runId()}`;
    created.push(name);

    await test.step("1. type a unique name and click Add", async () => {
      await page.goto(`${UI_URL}/`);
      await ui.nameInput.fill(name);
      const postPromise = page.waitForResponse(
        (r) => r.url().endsWith("/api/items") && r.request().method() === "POST",
      );
      await ui.submit.click();
      const post = await postPromise;
      checkRequestPayload(post.request().postDataJSON(), { name });
      await expect.soft(ui.status).toHaveText(`Added "${name}"`);
      await expect.soft(ui.status).toHaveAttribute("data-state", "ok");
    });

    await test.step("2. look at the reloaded list", async () => {
      const listed = ui.items.filter({ hasText: name });
      await expect.soft(listed).toHaveCount(1);
      await expect.soft.poll(textOf(listed)).toBe(name);
      await expect.soft(ui.nameInput).toHaveValue("");
    });

    await test.step("outcome: the item is still listed after a page reload", async () => {
      await page.reload();
      const listed = ui.items.filter({ hasText: name });
      await expect.soft(listed).toHaveCount(1);
      await expect.soft.poll(textOf(listed)).toBe(name);
    });
  });
});
