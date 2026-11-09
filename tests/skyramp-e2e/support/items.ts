import { expect, type Page } from "@playwright/test";

// Items API and items page helpers shared by the items-sort browser tests.

export const API_URL = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");
export const UI_URL = (process.env.SKYRAMP_TEST_SERVICE_URL_UI || process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND || "http://localhost:8080").replace(/\/+$/, "");

export type Item = { id: string; name: string };

export const created: string[] = [];

export async function listApiItems(base = API_URL): Promise<Item[]> {
  const res = await fetch(`${base}/api/items`);
  expect(res.status).toBe(200);
  return res.json();
}

export async function clearItems(): Promise<void> {
  for (const item of await listApiItems()) {
    await fetch(`${API_URL}/api/items/${item.id}`, { method: "DELETE" });
  }
}

export async function createItem(name: string): Promise<Item> {
  const res = await fetch(`${API_URL}/api/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  expect(res.status).toBe(201);
  const item: Item = await res.json();
  created.push(item.id);
  return item;
}

export async function seed(names: string[]): Promise<Item[]> {
  await clearItems();
  const items: Item[] = [];
  for (const name of names) items.push(await createItem(name));
  return items;
}

export async function deleteCreated(): Promise<void> {
  while (created.length) {
    const id = created.pop();
    await fetch(`${API_URL}/api/items/${id}`, { method: "DELETE" });
  }
}

export function itemsPage(page: Page) {
  return {
    status: page.getByTestId("status"),
    list: page.getByTestId("item-list"),
    items: page.getByTestId("item-list").getByTestId("item"),
    emptyState: page.getByTestId("empty-state"),
    countValue: page.getByTestId("item-count-value"),
    nameInput: page.getByTestId("item-name-input"),
    addButton: page.getByTestId("add-item-submit"),
    async open() {
      await page.goto(`${UI_URL}/`);
      await expect(this.status).not.toHaveText("Loading…");
    },
    async indexes(): Promise<(string | null)[]> {
      return this.items.evaluateAll((els) => els.map((el) => el.getAttribute("data-index")));
    },
  };
}
