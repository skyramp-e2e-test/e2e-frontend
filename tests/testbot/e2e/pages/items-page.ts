import { expect, type Locator, type Page } from "@playwright/test";

/** The API the frontend proxies to; the tests delete what they add through it (the frontend proxies no DELETE). */
export const apiBaseUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

/** Prefix of the names the add-item tests type; cleanup-labelled-items.mjs removes items whose name starts with it. */
export const addedItemPrefix = "Labelled item ";

/** The items page at "/": the list, the count line, the add form and the status line. */
export class ItemsPage {
  readonly list: Locator;
  readonly items: Locator;
  readonly emptyState: Locator;
  readonly countValue: Locator;
  readonly nameInput: Locator;
  readonly submit: Locator;
  readonly status: Locator;

  constructor(readonly page: Page) {
    this.list = page.getByTestId("item-list");
    this.items = this.list.getByTestId("item");
    this.emptyState = page.getByTestId("empty-state");
    this.countValue = page.getByTestId("item-count-value");
    this.nameInput = page.getByTestId("item-name-input");
    this.submit = page.getByTestId("add-item-submit");
    this.status = page.getByTestId("status");
  }

  /** The row of the item with this id. */
  itemById(id: string): Locator {
    return this.list.locator(`[data-testid="item"][data-item-id="${id}"]`);
  }

  /** Answer GET /api/items with `body` and GET /api/items/count with `count`, in this page only. */
  async stubItems(body: unknown, count: number): Promise<void> {
    await this.page.route("**/api/items", (route) =>
      route.request().method() === "GET" ? route.fulfill({ status: 200, json: body }) : route.continue(),
    );
    await this.page.route("**/api/items/count", (route) => route.fulfill({ status: 200, json: { count } }));
  }

  /** Stop answering the item requests from the stub, so they reach the app again. */
  async unstubItems(): Promise<void> {
    await this.page.unroute("**/api/items");
    await this.page.unroute("**/api/items/count");
  }

  async open(): Promise<void> {
    await this.page.goto("/");
  }

  /** Wait until the list has rendered `count` rows. */
  async waitForListCount(count: number): Promise<void> {
    await expect(this.list).toHaveAttribute("data-count", String(count));
  }

  /** Each row's raw textContent, in list order (not innerText, which collapses whitespace). */
  async labels(): Promise<string[]> {
    return this.items.evaluateAll((els) => els.map((el) => el.textContent ?? ""));
  }

  /** The total shown in the count line, once it has loaded. */
  async shownCount(): Promise<number> {
    await expect(this.countValue).toHaveText(/^\d+$/);
    return Number(await this.countValue.textContent());
  }
}

/** Delete, through the API, every item whose name is `name`. */
export async function deleteItemsNamed(name: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/api/items`);
  if (!res.ok) return;
  const data = await res.json();
  const items: Array<{ id?: string; name?: string }> = Array.isArray(data) ? data : (data.items ?? []);
  for (const item of items) {
    if (item.id != null && item.name === name) {
      await fetch(`${apiBaseUrl}/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    }
  }
}
