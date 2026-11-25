import { test, expect, request, type APIRequestContext } from "@playwright/test";
import { checkRequestPayload } from "@skyramp/skyramp";
import { ItemsPage, apiBaseUrl } from "../pages/items-page";

// Names this test creates start with this prefix; scripts/cleanup-label-journey-items.cjs removes them.
const PREFIX = "label-journey-";

test.describe("item labels journey", () => {
  let api: APIRequestContext;
  const created: string[] = [];

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: apiBaseUrl });
  });

  test.afterAll(async () => {
    // Delete everything this test made, by the names it sent, whether it passed or not.
    const res = await api.get("/api/items");
    const all = (await res.json()) as { id: string; name: string }[];
    for (const item of all.filter((i) => created.includes(i.name))) {
      await api.delete(`/api/items/${item.id}`);
    }
    await api.dispose();
  });

  test("open the item list and add an item, seeing clean labels", async ({ page }) => {
    const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const seedName = `${PREFIX}${run}-seed`;
    const addName = `${PREFIX}${run}-pear`;
    created.push(seedName, addName);

    // An item already in the app, sent with surrounding spaces.
    const seeded = await api.post("/api/items", { data: { name: `  ${seedName}  ` } });
    expect(seeded.status()).toBe(201);
    const seedId = ((await seeded.json()) as { id: string }).id;

    const items = new ItemsPage(page);

    await test.step("1. open the items page and see each label without surrounding spaces", async () => {
      await items.goto();
      await expect(items.emptyState).toBeHidden();
      await expect(items.item(seedId)).toHaveCount(1);
      await expect.soft.poll(() => items.item(seedId).evaluate((el) => el.textContent)).toBe(seedName);
    });

    await test.step("2. type a name, click Add, and see it added with a clean label", async () => {
      await items.nameInput.fill(`  ${addName}  `);
      const posted = page.waitForRequest((req) => req.method() === "POST" && new URL(req.url()).pathname === "/api/items");
      await items.submit.click();
      checkRequestPayload((await posted).postDataJSON(), { name: addName });
      await expect.soft(items.status).toHaveText(`Added "${addName}"`);
      const addedItem = items.items.filter({ hasText: addName });
      await expect(addedItem).toHaveCount(1);
      await expect.soft.poll(() => addedItem.evaluate((el) => el.textContent)).toBe(addName);
    });

    await test.step("outcome: after a reload both labels are still shown trimmed", async () => {
      await page.reload();
      await expect(items.item(seedId)).toHaveCount(1);
      await expect.poll(() => items.item(seedId).evaluate((el) => el.textContent)).toBe(seedName);
      const addedItem = items.items.filter({ hasText: addName });
      await expect(addedItem).toHaveCount(1);
      await expect.poll(() => addedItem.evaluate((el) => el.textContent)).toBe(addName);
    });
  });
});
