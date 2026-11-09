import { test, expect, type APIRequestContext, type Page, type Request, type Route } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";

// The items page and the API it proxies to, read from the run's service variables.
const UI_URL = (
  process.env.SKYRAMP_TEST_SERVICE_URL_UI ||
  process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND ||
  "http://localhost:8080"
).replace(/\/+$/, "");
const API_URL = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

type Item = { id: number | string; name: string };

// Items a test creates, removed after it whether it passed or not.
let created: Array<Item["id"]> = [];

async function createItem(request: APIRequestContext, name: string): Promise<Item> {
  const res = await request.post(`${API_URL}/api/items`, { data: { name } });
  expect(res.status(), `POST /api/items ${name}`).toBe(201);
  const item = (await res.json()) as Item;
  created.push(item.id);
  return item;
}

async function apiItems(request: APIRequestContext): Promise<Item[]> {
  const res = await request.get(`${API_URL}/api/items`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as Item[];
}

async function apiCount(request: APIRequestContext): Promise<number> {
  const res = await request.get(`${API_URL}/api/items/count`);
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { count: number }).count;
}

const isItemsList = (url: string) => new URL(url).pathname === "/api/items";
const isItemsGet = (req: Request) => req.method() === "GET" && isItemsList(req.url());

class ItemsPage {
  constructor(readonly page: Page) {}
  readonly title = () => this.page.getByTestId("page-title");
  readonly form = () => this.page.getByTestId("add-item-form");
  readonly nameInput = () => this.page.getByTestId("item-name-input");
  readonly addButton = () => this.page.getByRole("button", { name: "Add" });
  readonly refreshButton = () => this.page.getByTestId("refresh-button");
  readonly status = () => this.page.getByTestId("status");
  readonly emptyState = () => this.page.getByTestId("empty-state");
  readonly list = () => this.page.getByTestId("item-list");
  readonly items = () => this.list().getByTestId("item");
  readonly item = (name: string) => this.items().filter({ hasText: name });
  readonly count = () => this.page.getByTestId("item-count");
  readonly countValue = () => this.page.getByTestId("item-count-value");

  async open() {
    await this.page.goto(`${UI_URL}/`);
    await this.loaded();
  }

  async loaded() {
    await expect(this.list()).toHaveAttribute("data-count", /^\d+$/);
    await expect(this.count()).toHaveAttribute("data-state", "ok");
    await expect(this.status()).toHaveAttribute("data-state", "ok");
    await expect(this.status()).toHaveText("");
  }

  async listCount(): Promise<number> {
    return Number(await this.list().getAttribute("data-count"));
  }

  async shownCount(): Promise<number> {
    return Number(await this.countValue().textContent());
  }

  /** Clicks Refresh and waits for the GET /api/items it sends. */
  async refresh() {
    const response = this.page.waitForResponse((res) => isItemsGet(res.request()));
    await this.refreshButton().click();
    return response;
  }
}

test.beforeEach(async ({ page }, testInfo) => {
  // Skyramp's page wrapper, kept on the fixture page so every test drives it.
  newSkyrampPlaywrightPage(page, testInfo);
  created = [];
});

test.afterEach(async ({ request }) => {
  for (const id of created) {
    await request.delete(`${API_URL}/api/items/${id}`);
  }
});

test("shows a Refresh button below the add form", async ({ page }) => {
  const items = new ItemsPage(page);
  await items.open();

  const button = items.refreshButton();
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await expect(button).toHaveAccessibleName("Refresh");
  await expect(button).toHaveText("Refresh");
  // The button found by its role and name is the one carrying the test id.
  await expect(page.getByRole("button", { name: "Refresh" })).toHaveAttribute("data-testid", "refresh-button");

  const follows = await page.evaluate(() => {
    const form = document.querySelector('[data-testid="add-item-form"]')!;
    const btn = document.querySelector('[data-testid="refresh-button"]')!;
    const status = document.querySelector('[data-testid="status"]')!;
    const list = document.querySelector('[data-testid="item-list"]')!;
    return {
      afterForm: Boolean(form.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING),
      beforeStatus: Boolean(btn.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING),
      beforeList: Boolean(btn.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING),
      insideForm: form.contains(btn),
    };
  });
  expect(follows).toEqual({ afterForm: true, beforeStatus: true, beforeList: true, insideForm: false });

  const formBox = await items.form().boundingBox();
  const buttonBox = await button.boundingBox();
  expect(buttonBox!.y).toBeGreaterThanOrEqual(formBox!.y + formBox!.height);
});

test("clicking Refresh does not submit the add form", async ({ page, request }) => {
  const items = new ItemsPage(page);
  await items.open();
  const draft = `Refresh e2e ${Date.now()} unsaved draft`;
  await items.nameInput().fill(draft);

  const posts: string[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && isItemsList(req.url())) posts.push(req.url());
  });
  const response = await items.refresh();
  expect(response.status()).toBe(200);
  await expect(items.status()).toHaveAttribute("data-state", "ok");

  expect(posts).toEqual([]);
  await expect(items.nameInput()).toHaveValue(draft);
  await expect(items.item(draft)).toHaveCount(0);
  expect((await apiItems(request)).map((i) => i.name)).not.toContain(draft);
});

test("Refresh shows items created since the page loaded, without reloading", async ({ page, request }) => {
  const items = new ItemsPage(page);
  await items.open();
  const before = await items.listCount();

  const name = `Refreshed from API ${Date.now()}`;
  const item = await createItem(request, name);
  await expect(items.item(name)).toHaveCount(0);

  await page.evaluate(() => {
    (window as unknown as { __marker: number }).__marker = 1;
  });
  const gets: string[] = [];
  page.on("request", (req) => {
    if (isItemsGet(req)) gets.push(req.url());
  });

  await items.refresh();
  const row = items.item(name);
  await expect(row).toHaveCount(1);
  await expect(row).toHaveText(name);
  await expect(row).toHaveAttribute("data-item-id", String(item.id));
  await expect(items.list()).toHaveAttribute("data-count", String(before + 1));
  await expect(items.items()).toHaveCount(before + 1);
  await expect(items.emptyState()).toBeHidden();
  expect(gets).toHaveLength(1);
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);
});

test("Refresh removes deleted items and shows the empty state when none remain", async ({ page, request }) => {
  const name = `Refresh e2e ${Date.now()} to delete`;
  await createItem(request, name);
  const items = new ItemsPage(page);
  await items.open();
  await expect(items.item(name)).toHaveCount(1);

  for (const item of await apiItems(request)) {
    const res = await request.delete(`${API_URL}/api/items/${item.id}`);
    expect(res.ok()).toBeTruthy();
  }
  expect(await apiItems(request)).toEqual([]);

  await items.refresh();
  await expect(items.list()).toHaveAttribute("data-count", "0");
  await expect(items.items()).toHaveCount(0);
  await expect(items.emptyState()).toBeVisible();
  await expect(items.emptyState()).toHaveText("No items yet.");
  await expect(items.countValue()).toHaveText("0");
  await expect(items.status()).toHaveAttribute("data-state", "ok");
});

test("a successful Refresh clears the Added message", async ({ page, request }) => {
  const items = new ItemsPage(page);
  await items.open();
  const name = `Refresh e2e ${Date.now()} added`;

  await items.nameInput().fill(name);
  await items.addButton().click();
  await expect(items.status()).toHaveText(`Added "${name}"`);
  const added = (await apiItems(request)).find((i) => i.name === name);
  if (added) created.push(added.id);

  await items.refresh();
  await expect(items.status()).toHaveText("");
  await expect(items.status()).toHaveAttribute("data-state", "ok");
});

test("a failed Refresh shows the error, keeps the list, and the next Refresh recovers", async ({ page, request }) => {
  const name = `Refresh e2e ${Date.now()} kept`;
  await createItem(request, name);
  const items = new ItemsPage(page);
  await items.open();
  await expect(items.item(name)).toHaveCount(1);
  const shown = await items.listCount();

  const failGet = async (route: Route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "boom" }) });
  };
  await page.route(isItemsList, failGet);
  await items.refresh();
  await expect(items.status()).toHaveText("Failed to load items: boom");
  await expect(items.status()).toHaveAttribute("data-state", "error");
  await expect(items.item(name)).toHaveCount(1);
  await expect(items.list()).toHaveAttribute("data-count", String(shown));
  await page.unroute(isItemsList, failGet);

  await items.refresh();
  await expect(items.status()).toHaveText("");
  await expect(items.status()).toHaveAttribute("data-state", "ok");
  const fromApi = await apiItems(request);
  await expect(items.list()).toHaveAttribute("data-count", String(fromApi.length));
  await expect(items.items()).toHaveText(fromApi.map((i) => i.name));
});

test("Refresh updates Total items to the current count", async ({ page, request }) => {
  const items = new ItemsPage(page);
  await items.open();
  const before = await items.shownCount();

  await createItem(request, `Refresh e2e ${Date.now()} counted`);
  await expect(items.countValue()).toHaveText(String(before));

  const countResponse = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/items/count");
  await items.refresh();
  await countResponse;
  const apiTotal = await apiCount(request);
  expect(apiTotal).toBe(before + 1);
  await expect(items.countValue()).toHaveText(String(before + 1));
  await expect(items.count()).toHaveAttribute("data-count", String(before + 1));
  await expect(items.count()).toHaveAttribute("data-state", "ok");
  await expect(items.list()).toHaveAttribute("data-count", String(apiTotal));
});

test("the Refresh button is disabled while its request is in flight", async ({ page }) => {
  const items = new ItemsPage(page);
  await items.open();

  let hits = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(isItemsList, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    hits += 1;
    await gate;
    return route.continue();
  });

  await items.refreshButton().click();
  await expect(items.refreshButton()).toBeDisabled();
  await expect.poll(() => hits).toBe(1);
  await items.refreshButton().click({ force: true });
  await page.waitForTimeout(300);
  expect(hits).toBe(1);
  await expect(items.refreshButton()).toBeDisabled();

  release();
  await expect(items.refreshButton()).toBeEnabled();
  await expect(items.status()).toHaveText("");
  await expect(items.status()).toHaveAttribute("data-state", "ok");
  await expect(items.list()).toHaveAttribute("data-count", /^\d+$/);
  expect(hits).toBe(1);
});

for (const failure of ["a 500 answer", "an aborted request"] as const) {
  test(`the Refresh button is enabled again after ${failure}`, async ({ page }) => {
    const items = new ItemsPage(page);
    await items.open();

    let failed = false;
    await page.route(isItemsList, async (route) => {
      if (route.request().method() !== "GET" || failed) return route.fallback();
      failed = true;
      if (failure === "an aborted request") return route.abort();
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "boom" }) });
    });

    await items.refreshButton().click();
    await expect(items.status()).toHaveAttribute("data-state", "error");
    await expect(items.refreshButton()).toBeEnabled();

    const next = await items.refresh();
    expect(next.status()).toBe(200);
    await expect(items.status()).toHaveText("");
    await expect(items.status()).toHaveAttribute("data-state", "ok");
  });
}

test("a user sees another user's item by clicking Refresh after adding one of their own", async ({ page, request }) => {
  const ts = Date.now();
  const own = `Journey item ${ts}`;
  const other = `From another user ${ts}`;
  const items = new ItemsPage(page);

  await test.step("1. open the items page", async () => {
    await page.goto(`${UI_URL}/`);
    await items.loaded();
    await expect.soft(items.title()).toHaveText("Items");
    await expect.soft(page.getByRole("button", { name: "Refresh" })).toBeVisible();
    await expect.soft(items.refreshButton()).toBeEnabled();
    const formBox = await items.form().boundingBox();
    const buttonBox = await items.refreshButton().boundingBox();
    expect.soft(buttonBox!.y).toBeGreaterThanOrEqual(formBox!.y + formBox!.height);
    const fromApi = await apiItems(request);
    await expect.soft(items.list()).toHaveAttribute("data-count", String(fromApi.length));
    await expect.soft(items.countValue()).toHaveText(String(await apiCount(request)));
    await expect.soft(items.status()).toHaveText("");
  });

  const start = await items.shownCount();

  await test.step("2. add an item through the form", async () => {
    await items.nameInput().fill(own);
    const post = page.waitForRequest((req) => req.method() === "POST" && isItemsList(req.url()));
    await items.addButton().click();
    expect.soft((await post).postDataJSON()).toEqual({ name: own });
    await expect.soft(items.status()).toHaveText(`Added "${own}"`);
    await expect.soft(items.nameInput()).toHaveValue("");
    await expect.soft(items.item(own)).toHaveCount(1);
    await expect.soft(items.countValue()).toHaveText(String(start + 1));
    const added = (await apiItems(request)).find((i) => i.name === own);
    if (added) created.push(added.id);
  });

  await test.step("3. another client creates an item", async () => {
    await createItem(request, other);
    await expect.soft(items.list()).not.toContainText(other);
  });

  await test.step("4. click Refresh", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const hold = async (route: Route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await gate;
      return route.continue();
    };
    await page.route(isItemsList, hold);
    const response = page.waitForResponse((res) => isItemsGet(res.request()));
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect.soft(items.refreshButton()).toBeDisabled();
    release();
    await response;
    await page.unroute(isItemsList, hold);

    await expect.soft(items.refreshButton()).toBeEnabled();
    await expect.soft(items.item(other)).toHaveCount(1);
    await expect.soft(items.item(own)).toHaveCount(1);
    const apiTotal = await apiCount(request);
    expect.soft(apiTotal).toBe(start + 2);
    await expect.soft(items.countValue()).toHaveText(String(apiTotal));
    await expect.soft(items.list()).toHaveAttribute("data-count", String(apiTotal));
    await expect.soft(items.status()).toHaveText("");
    await expect.soft(items.status()).toHaveAttribute("data-state", "ok");
  });

  await test.step("5. reload the page", async () => {
    await page.goto(`${UI_URL}/`);
    await items.loaded();
    await expect(items.item(other)).toHaveCount(1);
    await expect(items.item(own)).toHaveCount(1);
    await expect(items.countValue()).toHaveText(String(start + 2));
  });
});
