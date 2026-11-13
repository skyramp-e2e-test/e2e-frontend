// The items page (e2e-frontend public/index.html) and the e2e API it lists, shared by the discounted-price tests.
import { expect, type Page, type APIRequestContext } from "@playwright/test";

export const UI_URL = process.env.SKYRAMP_TEST_SERVICE_URL_UI || process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND || "http://localhost:8080";
export const API_URL = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");
// Every item these tests create is named with this prefix; scripts/delete-test-items.mjs removes them by it.
export const NAME_PREFIX = "Testbot price ";

export function uniqueName(label: string): string {
  return `${NAME_PREFIX}${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function itemsPage(page: Page) {
  const list = page.getByTestId("item-list");
  const items = list.getByTestId("item");
  return {
    list,
    items,
    // An item's entry, found among the list's items by its name (each test gives its items distinct names).
    item: (name: string) => items.filter({ hasText: name }),
    count: page.getByTestId("item-count-value"),
    emptyState: page.getByTestId("empty-state"),
    nameInput: page.getByTestId("item-name-input"),
    submit: page.getByTestId("add-item-submit"),
    status: page.getByTestId("status"),
  };
}

export async function openLoaded(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("item-list")).toHaveAttribute("data-count", /\d+/);
}

export async function readCount(page: Page): Promise<number> {
  const count = itemsPage(page).count;
  await expect(count).toHaveText(/^\d+$/);
  return Number(await count.textContent());
}

export async function deleteItems(request: APIRequestContext, ids: string[]) {
  for (const id of ids) {
    await request.delete(`${API_URL}/api/items/${encodeURIComponent(id)}`);
  }
}
