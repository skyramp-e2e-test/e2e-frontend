// The items page (/): its elements, and a stub of the items API it reads, shared by the item-label tests.
import type { Page, Route } from "@playwright/test";

export const uiUrl = (
  process.env.SKYRAMP_TEST_SERVICE_URL_UI ||
  process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND ||
  "http://localhost:8080"
).replace(/\/+$/, "");

export function itemListPage(page: Page) {
  return {
    list: page.getByTestId("item-list"),
    items: page.getByTestId("item"),
    itemById: (id: string) => page.getByTestId("item-list").locator(`[data-item-id="${id}"]`),
    emptyState: page.getByTestId("empty-state"),
    status: page.getByTestId("status"),
    countValue: page.getByTestId("item-count-value"),
    nameInput: page.getByTestId("item-name-input"),
    submit: page.getByTestId("add-item-submit"),
    open: () => page.goto(`${uiUrl}/`),
    // Exact textContent of each row, untouched: toHaveText would normalise the whitespace this checks.
    labels: () => page.getByTestId("item").evaluateAll((els) => els.map((el) => el.textContent)),
  };
}

// Answers GET /api/items with the items `itemsFor()` returns at the time, and GET /api/items/count with their number.
export async function stubItemsApi(page: Page, itemsFor: () => unknown[]) {
  await page.route("**/api/items/count", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ count: itemsFor().length }) }),
  );
  await page.route("**/api/items", (route: Route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(itemsFor()) });
  });
}
