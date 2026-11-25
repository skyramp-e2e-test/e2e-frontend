// Shared by the item label tests: where the items page lives, how its /api/items answers are scripted,
// and the elements the tests read on it.
import type { Page, Route } from "@playwright/test";

export const frontendUrl = (
  process.env.SKYRAMP_TEST_SERVICE_URL_UI ||
  process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND ||
  "http://localhost:8080"
).replace(/\/+$/, "");

export const apiUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

/**
 * Answers GET /api/items with whatever listFor() gives at the time of the request (the e2e-api trims names on
 * write, so it never returns padded labels itself) and GET /api/items/count with that list's length.
 * Other methods go to `other`, or on to the real app when it is not given.
 */
export async function scriptItems(
  page: Page,
  listFor: () => unknown[],
  other?: (route: Route) => Promise<void>,
): Promise<void> {
  await page.route("**/api/items/count", (route) => route.fulfill({ json: { count: listFor().length } }));
  await page.route("**/api/items", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: listFor() });
    if (other) return other(route);
    return route.fallback();
  });
}

export function itemsPage(page: Page) {
  return {
    status: page.getByTestId("status"),
    list: page.getByTestId("item-list"),
    items: page.getByTestId("item"),
    emptyState: page.getByTestId("empty-state"),
    nameInput: page.getByTestId("item-name-input"),
    addButton: page.getByTestId("add-item-submit"),
    item: (id: string) => page.getByTestId("item-list").locator(`[data-item-id="${id}"]`),
    /** textContent, not innerText, so surrounding whitespace is kept as the page has it. */
    labels: () => page.getByTestId("item").evaluateAll((els) => els.map((el) => el.textContent)),
  };
}
