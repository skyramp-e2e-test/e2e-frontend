// Journey: a user opens the items page, reads the list labels, and adds an item, which the real
// e2e-api lists by its trimmed name with the total updated. Runs against the real app: nothing is stubbed.
import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";

const FRONTEND_URL = (
  process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND ||
  process.env.SKYRAMP_TEST_SERVICE_URL_UI ||
  "http://localhost:8080"
).replace(/\/+$/, "");
// The frontend proxies only list, count and create, so items are deleted at the API itself.
const API_URL = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");
// Every item these tests create starts with this; cleanup-label-items.mjs removes leftovers by it.
const ITEM_NAME_PREFIX = "label-trim-e2e-";

async function deleteItem(id: string) {
  const res = await fetch(`${API_URL}/api/items/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`DELETE /api/items/${id} answered ${res.status}`);
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe("item labels against the running API", () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(15000);
  });

  const created: string[] = [];

  test.afterEach(async () => {
    while (created.length) await deleteItem(created.pop()!);
  });

  test("user opens the item list and adds an item, which shows by its trimmed name", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const name = `${ITEM_NAME_PREFIX}Journey-${Date.now()}`;
    let before = NaN;

    await test.step("1. open the items page and read the list labels", async () => {
      const listed = page.waitForResponse((r) => r.request().method() === "GET" && new URL(r.url()).pathname === "/api/items");
      await page.goto(`${FRONTEND_URL}/`);
      const items = (await (await listed).json()) as Array<{ name: string }>;
      await expect(page.getByTestId("item-list")).toHaveAttribute("data-count", String(items.length));
      const labels = await page.getByTestId("item").allTextContents();
      expect.soft(labels).toEqual(items.map((i) => i.name.trim()));
      for (const label of labels) expect.soft(label).toBe(label.trim());
      const countEl = page.getByTestId("item-count");
      await expect(countEl).toHaveAttribute("data-state", "ok");
      before = Number(await countEl.getAttribute("data-count"));
    });

    await test.step("2. type a name with surrounding spaces and click Add", async () => {
      await page.getByTestId("item-name-input").fill(`  ${name}  `);
      const posted = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/items");
      const answered = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/items");
      await page.getByTestId("add-item-submit").click();
      expect.soft((await posted).postDataJSON()).toEqual({ name });
      const body = await (await answered).json();
      created.push(body.id);
      await expect.soft(page.getByTestId("status")).toHaveText(`Added "${name}"`);
      await expect.soft(page.getByTestId("status")).toHaveAttribute("data-state", "ok");
      const item = page.locator(`[data-testid="item"][data-item-id="${body.id}"]`);
      await expect(item).toHaveCount(1);
      expect.soft(await item.textContent()).toBe(name);
      await expect.soft(page.getByTestId("item-count-value")).toHaveText(String(before + 1));
    });

    await test.step("outcome after a reload: the new item is listed by name and the total is updated", async () => {
      await page.reload();
      const item = page.locator(`[data-testid="item"][data-item-id="${created[0]}"]`);
      await expect(item).toHaveCount(1);
      expect(await item.textContent()).toBe(name);
      const labels = await page.getByTestId("item").allTextContents();
      for (const label of labels) expect.soft(label).toBe(label.trim());
      await expect(page.getByTestId("item-count-value")).toHaveText(String(before + 1));
    });
  });
});
