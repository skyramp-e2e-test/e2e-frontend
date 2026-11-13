// User journeys through the items page against the real frontend and e2e-api: nothing on the page's network is stubbed.
import { test, expect } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { API_URL, UI_URL, deleteItems, itemsPage, openLoaded, readCount, uniqueName } from "../support/items-page";

test.use({ baseURL: UI_URL });

test.describe("user journeys", () => {
  const created: string[] = [];
  test.afterEach(async ({ request }) => {
    await deleteItems(request, created.splice(0));
  });

  test("add an item and see the list, prices and count update", async ({ page: rawPage }, testInfo) => {
    const page = newSkyrampPlaywrightPage(rawPage, testInfo);
    const ui = itemsPage(page);
    let before = NaN;

    await test.step("1. open the items page", async () => {
      await openLoaded(page);
      before = await readCount(page);
      await expect.soft(ui.list).not.toContainText("NaN");
      await expect.soft(ui.list).toHaveAttribute("data-count", String(await ui.items.count()));
    });

    const name = uniqueName("Journey add");
    let id = "";
    await test.step("2. add an item through the form", async () => {
      await ui.nameInput.fill(name);
      const posted = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/items");
      const answered = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/items");
      await ui.submit.click();
      expect.soft((await posted).postDataJSON()).toEqual({ name });
      const response = await answered;
      expect.soft(response.status()).toBe(201);
      ({ id } = await response.json());
      created.push(id);
      await expect.soft(ui.status).toHaveText(`Added "${name}"`);
      await expect.soft(ui.status).toHaveAttribute("data-state", "ok");
      await expect.soft(ui.item(name)).toHaveText(name, { useInnerText: true });
      await expect.soft(ui.item(name)).toHaveAttribute("data-item-id", id);
      await expect.soft(ui.item(name)).not.toContainText("$");
      await expect.soft(ui.nameInput).toHaveValue("");
      await expect.soft(ui.count).toHaveText(String(before + 1));
      await expect.soft(ui.list).toHaveAttribute("data-count", String(await ui.items.count()));
    });

    await test.step("outcome after reload", async () => {
      await page.reload();
      await expect(ui.list).toHaveAttribute("data-count", /\d+/);
      await expect.soft(ui.item(name)).toHaveText(name, { useInnerText: true });
      await expect.soft(ui.item(name)).toHaveAttribute("data-item-id", id);
      await expect.soft(ui.count).toHaveText(String(before + 1));
      await expect.soft(ui.list).toHaveAttribute("data-count", String(await ui.items.count()));
    });
  });

  test("see each item's price with its discounted price", async ({ page: rawPage, request }, testInfo) => {
    const page = newSkyrampPlaywrightPage(rawPage, testInfo);
    const ui = itemsPage(page);
    const seeded = [
      { name: uniqueName("Journey priced"), price: 20, shown: (n: string) => `${n} — $20.00 (discounted: $18.00)` },
      { name: uniqueName("Journey half-cent"), price: 1.15, shown: (n: string) => `${n} — $1.15 (discounted: $1.04)` },
      { name: uniqueName("Journey unpriced"), price: undefined, shown: (n: string) => n },
    ];
    for (const item of seeded) {
      const res = await request.post(`${API_URL}/api/items`, { data: item.price === undefined ? { name: item.name } : { name: item.name, price: item.price } });
      expect(res.status()).toBe(201);
      const { id } = await res.json();
      created.push(id);
    }

    const checkPrices = async () => {
      for (const item of seeded) {
        await expect.soft(ui.item(item.name)).toHaveText(item.shown(item.name), { useInnerText: true });
      }
      await expect.soft(ui.list).not.toContainText("NaN");
    };

    await test.step("1. open the items page with priced and unpriced items", async () => {
      await openLoaded(page);
      await checkPrices();
    });

    await test.step("2. reload the items page", async () => {
      await page.reload();
      await expect(ui.list).toHaveAttribute("data-count", /\d+/);
      await checkPrices();
    });
  });
});
