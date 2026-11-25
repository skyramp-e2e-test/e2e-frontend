// Journey: open the items page and see item names without stray spaces, then add one.
// Runs against the real frontend and API: items are seeded through the API with
// surrounding whitespace, and every item it makes is deleted at the end.
import { test, expect } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";

const baseUrl = (
  process.env.SKYRAMP_TEST_SERVICE_URL_UI ??
  process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND ??
  "http://localhost:8080"
).replace(/\/+$/, "");

const apiUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API ?? "http://localhost:3000").replace(/\/+$/, "");

// Every item the journey creates starts with this; cleanup-item-labels-journey.mjs deletes them.
const JOURNEY_PREFIX = "label-journey-";

type Item = { id: string; name: string };

test("open the items page and see item names without stray spaces, then add one", async ({ page, request }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(10000);
  page = newSkyrampPlaywrightPage(page);

  const run = `${JOURNEY_PREFIX}${Date.now().toString(36)}`;
  const apple = `${run} apple`;
  const banana = `${run} banana`;
  const greenApple = `${run} green apple`;
  const made: string[] = [];

  const create = async (name: string): Promise<Item> => {
    const res = await request.post(`${apiUrl}/api/items`, { data: { name } });
    expect(res.status()).toBe(201);
    const item = (await res.json()) as Item;
    made.push(item.id);
    return item;
  };
  const total = async (): Promise<number> =>
    ((await (await request.get(`${apiUrl}/api/items/count`)).json()) as { count: number }).count;

  try {
    const appleItem = await create(`  ${apple}  `);
    const bananaItem = await create(`\t${banana}\n`);
    const row = (id: string) => page.locator(`[data-testid="item"][data-item-id="${id}"]`);

    await test.step("1. open the items page: seeded rows read without stray spaces, total shown", async () => {
      const expectedTotal = await total();
      await page.goto(`${baseUrl}/`);
      await expect(row(appleItem.id)).toBeVisible();
      expect.soft(await row(appleItem.id).textContent()).toBe(apple);
      expect.soft(await row(bananaItem.id).textContent()).toBe(banana);
      await expect.soft(page.getByTestId("item-count-value")).toHaveText(String(expectedTotal));
    });

    await test.step('2. add "  green apple  ": status and trimmed row with inner space kept', async () => {
      const before = await total();
      await page.getByPlaceholder("Item name").fill(`  ${greenApple}  `);
      const posted = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/items");
      await page.getByRole("button", { name: "Add" }).click();
      expect.soft((await posted).postDataJSON()).toEqual({ name: greenApple });
      await expect.soft(page.getByTestId("status")).toHaveText(`Added "${greenApple}"`);

      const found = (await (await request.get(`${apiUrl}/api/items`, { params: { q: greenApple } })).json()) as Item[];
      made.push(...found.map((i) => i.id));
      expect(found).toHaveLength(1);
      await expect(row(found[0].id)).toBeVisible();
      expect.soft(await row(found[0].id).textContent()).toBe(greenApple);
      expect.soft(await row(appleItem.id).textContent()).toBe(apple);
      expect.soft(await row(bananaItem.id).textContent()).toBe(banana);
      await expect.soft(page.getByTestId("item-count-value")).toHaveText(String(before + 1));
    });
  } finally {
    for (const id of made) await request.delete(`${apiUrl}/api/items/${id}`);
  }
});
