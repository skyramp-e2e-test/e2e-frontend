import type { Locator, Page } from "@playwright/test";

export const frontendUrl = (
  process.env.SKYRAMP_TEST_SERVICE_URL_UI ||
  process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND ||
  "http://localhost:8080"
).replace(/\/+$/, "");

export const apiUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

/** The Items page (public/index.html). */
export class ItemsPage {
  readonly list: Locator;
  readonly items: Locator;
  readonly emptyState: Locator;
  readonly status: Locator;
  readonly countValue: Locator;
  readonly nameInput: Locator;
  readonly addButton: Locator;

  constructor(readonly page: Page) {
    this.list = page.getByTestId("item-list");
    this.items = this.list.getByTestId("item");
    this.emptyState = page.getByTestId("empty-state");
    this.status = page.getByTestId("status");
    this.countValue = page.getByTestId("item-count-value");
    this.nameInput = page.getByTestId("item-name-input");
    this.addButton = page.getByTestId("add-item-submit");
  }

  async goto(): Promise<void> {
    await this.page.goto(`${frontendUrl}/`);
  }

  /** Answers the page's GET /api/items with the given JSON body; other requests reach the app. */
  async stubItems(body: unknown): Promise<void> {
    await this.page.route("**/api/items", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
        : route.continue(),
    );
  }

  itemById(id: string): Locator {
    return this.list.locator(`[data-testid="item"][data-item-id="${id}"]`);
  }

  /** The exact text shown, whitespace included (innerText would collapse it). */
  static textOf(locator: Locator): Promise<string | null> {
    return locator.evaluate((el) => el.textContent);
  }

  async allTexts(): Promise<(string | null)[]> {
    return this.items.evaluateAll((els) => els.map((el) => el.textContent));
  }
}
