import type { Locator, Page } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";

/** Where the frontend's pages are served. */
export const uiBaseUrl = (
  process.env.SKYRAMP_TEST_SERVICE_URL_UI ||
  process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND ||
  "http://localhost:8080"
).replace(/\/+$/, "");

/** Where the backend API the frontend proxies to is served. */
export const apiBaseUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

/** The items page (public/index.html): the item list and the add-item form. */
export class ItemsPage {
  readonly page: Page;
  readonly list: Locator;
  readonly items: Locator;
  readonly emptyState: Locator;
  readonly nameInput: Locator;
  readonly submit: Locator;
  readonly status: Locator;

  constructor(page: Page) {
    // Wrap the Playwright page with the Skyramp page.
    this.page = newSkyrampPlaywrightPage(page);
    this.list = this.page.getByTestId("item-list");
    this.items = this.list.getByTestId("item");
    this.emptyState = this.page.getByTestId("empty-state");
    this.nameInput = this.page.getByTestId("item-name-input");
    this.submit = this.page.getByTestId("add-item-submit");
    this.status = this.page.getByTestId("status");
  }

  async goto(): Promise<void> {
    await this.page.goto(`${uiBaseUrl}/`);
  }

  /** The list entry for the item with this id. */
  item(id: string): Locator {
    return this.list.locator(`[data-testid="item"][data-item-id="${id}"]`);
  }

  /** Each list entry's raw textContent, in order (not normalised, so surrounding spaces stay visible). */
  async labels(): Promise<string[]> {
    return this.items.evaluateAll((els) => els.map((el) => el.textContent ?? ""));
  }
}
