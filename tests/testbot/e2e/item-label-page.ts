// Shared by the item-label browser tests: app addresses, the items page's elements and API cleanup.
import type { Page, Locator } from "@playwright/test";

export const UI_URL = (
  process.env.SKYRAMP_TEST_SERVICE_URL_UI ||
  process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND ||
  "http://localhost:8080"
).replace(/\/+$/, "");
export const API_URL = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

export function runId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Elements of the items page, by their data-testid.
export function itemsPage(page: Page) {
  return {
    list: page.getByTestId("item-list"),
    items: page.getByTestId("item-list").getByTestId("item"),
    itemById: (id: string): Locator => page.getByTestId("item-list").locator(`[data-item-id="${id}"]`),
    status: page.getByTestId("status"),
    nameInput: page.getByTestId("item-name-input"),
    submit: page.getByTestId("add-item-submit"),
  };
}

// Exact textContent, without Playwright's whitespace normalisation (which would hide untrimmed labels).
export const textOf = (locator: Locator) => () => locator.textContent();
export const textsOf = (locator: Locator) => () => locator.allTextContents();

export async function deleteItemsNamed(names: string[]) {
  const res = await fetch(`${API_URL}/api/items`);
  if (!res.ok) return;
  const data = await res.json();
  const items: Array<{ id: string; name?: string }> = Array.isArray(data) ? data : (data.items ?? []);
  for (const item of items.filter((i) => i.name !== undefined && names.includes(i.name))) {
    await fetch(`${API_URL}/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
  }
}
