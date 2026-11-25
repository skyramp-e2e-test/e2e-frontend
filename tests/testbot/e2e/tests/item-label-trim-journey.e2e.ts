// Journey: see trimmed labels in the item list, before and after adding an item, against the real app.
// Items are seeded with padded names through the items API and removed through it when the test ends.
import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { itemListPage } from "../item-list-page";

const apiUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

test("item labels stay trimmed before and after adding an item", async ({ page, request }) => {
  const run = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const apple = `Apple-tb-${run}`;
  const banana = `Banana-tb-${run}`;
  const cherry = `Cherry-tb-${run}`;
  page = newSkyrampPlaywrightPage(page);
  const items = itemListPage(page);
  const labelOf = async (name: string) => {
    const row = items.items.filter({ hasText: name });
    await expect.soft(row).toHaveCount(1);
    return row.evaluate((el) => el.textContent);
  };

  try {
    for (const name of [`  ${apple}  `, ` ${banana}`]) {
      const res = await request.post(`${apiUrl}/api/items`, { data: { name } });
      expect(res.status()).toBe(201);
    }

    await test.step("1. open the items page and see the labels trimmed", async () => {
      await items.open();
      await expect(items.items.filter({ hasText: banana })).toHaveCount(1);
      expect.soft(await labelOf(apple)).toBe(apple);
      expect.soft(await labelOf(banana)).toBe(banana);
    });

    await test.step("2. add Cherry and see every label trimmed", async () => {
      const before = Number(await items.countValue.textContent());
      await items.nameInput.fill(`${cherry}  `);
      await items.submit.click();
      await expect.soft(items.status).toHaveText(`Added "${cherry}"`);
      expect.soft(await labelOf(apple)).toBe(apple);
      expect.soft(await labelOf(banana)).toBe(banana);
      expect.soft(await labelOf(cherry)).toBe(cherry);
      await expect.soft(items.countValue).toHaveText(String(before + 1));
    });

    await test.step("outcome: after a reload every label is still shown trimmed", async () => {
      await page.reload();
      await expect(items.items.filter({ hasText: cherry })).toHaveCount(1);
      expect.soft(await labelOf(apple)).toBe(apple);
      expect.soft(await labelOf(banana)).toBe(banana);
      expect.soft(await labelOf(cherry)).toBe(cherry);
    });
  } finally {
    const res = await request.get(`${apiUrl}/api/items`);
    const data = await res.json();
    for (const item of Array.isArray(data) ? data : (data.items ?? [])) {
      if ([apple, banana, cherry].includes(item?.name)) {
        await request.delete(`${apiUrl}/api/items/${encodeURIComponent(item.id)}`);
      }
    }
  }
});
