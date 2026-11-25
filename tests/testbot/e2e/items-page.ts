// Page object for the items page (public/index.html), shared by the item-label browser tests.
import type { Locator, Page } from "@playwright/test";

export const apiBaseUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

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

  async goto() {
    await this.page.goto("/");
  }

  /** The list once it has rendered `count` rows. */
  listWithCount(count: number): Locator {
    return this.page.locator(`[data-testid="item-list"][data-count="${count}"]`);
  }

  /** Answers GET /api/items with `items` and GET /api/items/count with their number, inside this page only. */
  async stubItems(items: unknown[]) {
    await this.page.route("**/api/items/count", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ count: items.length }) }),
    );
    await this.page.route("**/api/items", (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) });
    });
  }

  /** textContent of every row, in order (textContent keeps whitespace that innerText collapses). */
  async rowTexts(): Promise<(string | null)[]> {
    return this.items.evaluateAll((rows) => rows.map((row) => row.textContent));
  }
}
