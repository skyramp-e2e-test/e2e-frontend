// User journeys through the items page against the real app (no stubbed network):
// items added with padded names are listed under their trimmed names.
import { test, expect, type Page } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";

const baseUrl = (
  process.env.SKYRAMP_TEST_SERVICE_URL_UI ||
  process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND ||
  "http://localhost:8080"
).replace(/\/+$/, "");
const apiUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

test.use({ viewport: { width: 1280, height: 900 } });

/** Ids of items the test added, deleted through the API when it ends. */
let createdIds: string[] = [];

test.beforeEach(async ({ page }) => {
  createdIds = [];
  page.setDefaultTimeout(15000);
});

test.afterEach(async ({ request }) => {
  for (const id of createdIds) {
    await request.delete(`${apiUrl}/api/items/${encodeURIComponent(id)}`);
  }
});

/** Type a name into the add form, submit it, and check the POST body; returns the created item's id. */
async function addItem(page: Page, typed: string, expectedName: string) {
  const postRequest = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/items");
  const postResponse = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/items");
  await page.getByTestId("item-name-input").fill(typed);
  await page.getByTestId("add-item-submit").click();
  expect((await postRequest).postDataJSON()).toEqual({ name: expectedName });
  const response = await postResponse;
  expect(response.status()).toBe(201);
  const created = await response.json();
  createdIds.push(created.id);
  expect(created.name).toBe(expectedName);
  return created.id as string;
}

test("journey: add an item and see it listed under its trimmed name", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const name = `Journey widget ${Date.now()}`;

  await test.step("1. open the items page: the list loads and Total items shows a number", async () => {
    await page.goto(`${baseUrl}/`);
    await expect.soft(page.getByTestId("status")).toHaveAttribute("data-state", "ok");
    await expect.soft(page.getByTestId("status")).toHaveText("");
    await expect.soft(page.getByTestId("item-count-value")).toHaveText(/^\d+$/);
  });

  await test.step("2. type a padded name and click Add: status reads Added with the trimmed name", async () => {
    await addItem(page, `  ${name}  `, name);
    await expect.soft(page.getByTestId("status")).toHaveText(`Added "${name}"`);
    await expect.soft(page.getByTestId("status")).toHaveAttribute("data-state", "ok");
  });

  await test.step("3. the list shows the item under its trimmed name and Total items matches the list", async () => {
    const added = page.getByTestId("item-list").getByTestId("item").filter({ hasText: name });
    await expect(added).toHaveCount(1);
    expect.soft(await added.textContent()).toBe(name);
    const listCount = await page.getByTestId("item-list").getAttribute("data-count");
    await expect.soft(page.getByTestId("item-count-value")).toHaveText(listCount ?? "missing data-count");
  });
});

test("journey: open the items page when the API holds items saved with padded names", async ({ page, request }) => {
  page = newSkyrampPlaywrightPage(page);
  const stamp = Date.now();
  const apple = `Journey widget Apple ${stamp}`;
  const banana = `Journey widget Banana split ${stamp}`;
  const ids: Record<string, string> = {};
  for (const [label, sent] of [[apple, `  ${apple}  `], [banana, `\t${banana}\n`]]) {
    const res = await request.post(`${apiUrl}/api/items`, { data: { name: sent } });
    expect(res.status()).toBe(201);
    const created = await res.json();
    createdIds.push(created.id);
    ids[label] = created.id;
  }

  await test.step("1. open the items page: both items are listed", async () => {
    await page.goto(`${baseUrl}/`);
    await expect.soft(page.getByTestId("status")).toHaveAttribute("data-state", "ok");
    await expect.soft(page.getByTestId("item-list").locator(`[data-item-id="${ids[apple]}"]`)).toHaveCount(1);
    await expect.soft(page.getByTestId("item-list").locator(`[data-item-id="${ids[banana]}"]`)).toHaveCount(1);
  });

  await test.step("2. read the item labels: they have no leading or trailing whitespace", async () => {
    expect.soft(await page.getByTestId("item-list").locator(`[data-item-id="${ids[apple]}"]`).textContent()).toBe(apple);
    expect.soft(await page.getByTestId("item-list").locator(`[data-item-id="${ids[banana]}"]`).textContent()).toBe(banana);
  });
});
