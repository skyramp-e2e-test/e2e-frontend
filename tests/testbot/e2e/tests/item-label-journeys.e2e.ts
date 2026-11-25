// User journeys through the real app: item labels in the list are shown trimmed.
import { test, expect, getBaseUrl, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { APIRequestContext } from "@playwright/test";

const baseUrl = getBaseUrl("SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND", "http://localhost:8080");
const apiUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

test.use({ viewport: { width: 1280, height: 900 } });

const uniqueName = (label: string) => `Mango tb-${Date.now()}-${Math.floor(Math.random() * 1e6)}${label}`;

const made: string[] = [];

async function removeMade(request: APIRequestContext) {
  const items: { id: string; name: string }[] = await (await request.get(`${apiUrl}/api/items`)).json();
  for (const it of items.filter((i) => made.includes(i.name))) {
    await request.delete(`${apiUrl}/api/items/${it.id}`);
  }
  made.length = 0;
}

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(15000);
});

test.afterEach(async ({ request }) => {
  await removeMade(request);
});

test("user opens the list and sees every label without stray spaces", async ({ page, request }) => {
  page = newSkyrampPlaywrightPage(page);
  // Saved through the API with outer spaces; the list must show each without them, inner spaces kept.
  const sent = [`  ${uniqueName(" apple")}  `, `\t${uniqueName("  green tea")}\n`];
  const expected = sent.map((s) => s.trim());
  const ids: string[] = [];
  for (const name of sent) {
    const res = await request.post(`${apiUrl}/api/items`, { data: { name } });
    expect(res.status()).toBe(201);
    const body = await res.json();
    made.push(body.name);
    ids.push(String(body.id));
  }

  await test.step("1. opens the items page", async () => {
    await page.goto(`${baseUrl}/`);
    await expect.soft(page.getByTestId("status")).toHaveText("");
    for (const id of ids) {
      await expect.soft(page.locator(`[data-testid="item"][data-item-id="${id}"]`)).toHaveCount(1);
    }
  });

  await test.step("2. reads the label of each item", async () => {
    for (const [i, id] of ids.entries()) {
      const item = page.locator(`[data-testid="item"][data-item-id="${id}"]`);
      await expect.soft(item).toHaveCount(1);
      expect.soft(await item.textContent()).toBe(expected[i]);
    }
    await expect.soft(page.getByTestId("empty-state")).toBeHidden();
  });
});

test("user adds an item typed with spaces and sees it listed trimmed", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const name = uniqueName("");
  made.push(name);
  const list = page.getByTestId("item-list");
  const input = page.getByTestId("item-name-input");
  const added = page.getByTestId("item").filter({ hasText: name });
  let before = 0;

  await page.goto(`${baseUrl}/`);
  await test.step("1. types the padded name in the Item name box", async () => {
    await expect(list).toHaveAttribute("data-count", /\d+/);
    before = Number(await list.getAttribute("data-count"));
    await input.fill(`  ${name}  `);
    await expect.soft(input).toHaveValue(`  ${name}  `);
    await expect.soft(list).toHaveAttribute("data-count", String(before));
    await expect.soft(added).toHaveCount(0);
  });

  await test.step("2. clicks Add and sees the item listed trimmed", async () => {
    const posted = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/items");
    await page.getByTestId("add-item-submit").click();
    expect.soft((await posted).postDataJSON()).toEqual({ name });
    await expect.soft(page.getByTestId("status")).toHaveText(`Added "${name}"`);
    await expect.soft(page.getByTestId("status")).toHaveAttribute("data-state", "ok");
    await expect(added).toHaveCount(1);
    expect.soft(await added.textContent()).toBe(name);
    await expect.soft(list).toHaveAttribute("data-count", String(before + 1));
    await expect.soft(page.getByTestId("item-count-value")).toHaveText(String(before + 1));
  });
});
