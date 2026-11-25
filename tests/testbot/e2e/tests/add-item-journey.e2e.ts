// Journey against the real frontend and API: a user adds an item and sees it listed under its name.
import { test, expect, type Page } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";

const uiUrl = process.env.SKYRAMP_TEST_SERVICE_URL_UI || "http://localhost:8080";
const apiUrl = process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000";

// Prefix of every item this test adds through the real API; cleanup-item-labels.mjs removes them.
const ADDED_PREFIX = "Kiwi Fruit testbot-";

test.use({ viewport: { width: 1280, height: 900 } });

const added: string[] = [];

test.afterEach(async ({ request }) => {
  while (added.length) {
    const id = added.pop();
    await request.delete(`${apiUrl}/api/items/${id}`);
  }
});

/** Fill the form with `typed`, click Add, and return the id the API gave the new item. */
async function addThroughForm(page: Page, typed: string, trimmed: string) {
  await page.getByTestId("item-name-input").fill(typed);
  const [request, response] = await Promise.all([
    page.waitForRequest((r) => r.url().endsWith("/api/items") && r.method() === "POST"),
    page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "POST"),
    page.getByTestId("add-item-submit").click(),
  ]);
  expect(request.postDataJSON()).toEqual({ name: trimmed });
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.name).toBe(trimmed);
  added.push(body.id);
  return String(body.id);
}

test("user adds an item and sees it listed under its name, also after reload", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const name = `${ADDED_PREFIX}journey-${Date.now()}`;
  const countValue = page.getByTestId("item-count-value");
  let countBefore = NaN;
  let id = "";

  await test.step("1. open the items page and see the list load", async () => {
    await page.goto(`${uiUrl}/`);
    await expect(page.getByTestId("status")).toHaveText("");
    await expect(page.getByTestId("item-count")).toHaveAttribute("data-state", "ok");
    await expect(countValue).toHaveText(/^\d+$/);
    countBefore = Number(await countValue.textContent());
  });

  await test.step("2. type a padded name and click Add", async () => {
    id = await addThroughForm(page, `  ${name}  `, name);
    await expect.soft(page.getByTestId("status")).toHaveText(`Added "${name}"`);
  });

  await test.step("3. see the item listed under its trimmed name, also after reload", async () => {
    const item = page.getByTestId("item").filter({ hasText: name });
    await expect.soft(item).toHaveCount(1);
    expect.soft(await item.evaluate((el) => el.textContent)).toBe(name);
    await expect.soft(item).toHaveAttribute("data-item-id", id);
    await expect.soft(countValue).toHaveText(String(countBefore + 1));

    await page.reload();
    await expect(item).toHaveCount(1);
    expect(await item.evaluate((el) => el.textContent)).toBe(name);
    await expect(item).toHaveAttribute("data-item-id", id);
    await expect(countValue).toHaveText(String(countBefore + 1));
  });
});
