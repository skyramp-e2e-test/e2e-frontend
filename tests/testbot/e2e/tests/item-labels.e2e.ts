// Item labels in the list are shown trimmed of leading and trailing whitespace, and items
// from the real API (objects with a name) still show their names, including one just added.
import { test, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { APIRequestContext, Page } from '@playwright/test';

const baseUrl = getBaseUrl('SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND', 'http://localhost:8080');
const apiUrl = getBaseUrl('SKYRAMP_TEST_SERVICE_URL_E2E_API', 'http://localhost:3000');

// Names of items these tests add start with this; cleanup-label-items.mjs removes leftovers.
const ADDED_PREFIX = 'Zeta-labels-';

test.use({ viewport: { width: 1280, height: 900 } });

// Answers the page's GET /api/items and GET /api/items/count with the given items.
async function mockItems(page: Page, items: unknown[]) {
  await page.route('**/api/items/count', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: items.length }) }));
  await page.route('**/api/items', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(items) }));
}

// Opens the list and waits until it has rendered and the status area has been cleared.
async function openList(page: Page) {
  await page.goto(`${baseUrl}/`);
  await expect(page.getByTestId('item-list')).toHaveAttribute('data-count', /^\d+$/);
  await expect(page.getByTestId('status')).toHaveText('');
}

function itemLabels(page: Page) {
  return page.getByTestId('item').evaluateAll((lis) => lis.map((li) => li.textContent));
}

function itemById(page: Page, id: string) {
  return page.locator(`[data-testid="item"][data-item-id="${id}"]`);
}

async function deleteAdded(request: APIRequestContext, ids: string[]) {
  for (const id of ids) {
    await request.delete(`${apiUrl}/api/items/${encodeURIComponent(id)}`);
  }
}

test.describe('item labels in the list', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(15000);
  });

  test('bare string labels are shown without surrounding spaces, tabs or newlines', async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await mockItems(page, ['  Alpha  ', '\tBeta\n']);
    await openList(page);

    await expect(page.getByTestId('item-list')).toHaveAttribute('data-count', '2');
    expect(await itemLabels(page)).toEqual(['Alpha', 'Beta']);
  });

  test('an object item with a padded name or title is shown with its label trimmed', async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await mockItems(page, [{ id: '1', name: '  Gamma  ' }, { id: '2', title: '  Delta  ' }]);
    await openList(page);

    await expect(page.getByTestId('item-list')).toHaveAttribute('data-count', '2');
    expect.soft(await itemById(page, '1').textContent()).toBe('Gamma');
    expect.soft(await itemById(page, '2').textContent()).toBe('Delta');
  });

  test('an object item whose name ends in a tab is shown with its name trimmed', async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await mockItems(page, [{ id: '1', name: '   Gamma\t' }]);
    await openList(page);

    await expect(page.getByTestId('item-list')).toHaveAttribute('data-count', '1');
    expect(await itemById(page, '1').textContent()).toBe('Gamma');
  });

  test('whitespace inside a label is kept when its ends are trimmed', async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await mockItems(page, ['  Foo  Bar  ']);
    await openList(page);

    await expect(page.getByTestId('item-list')).toHaveAttribute('data-count', '1');
    expect(await itemLabels(page)).toEqual(['Foo  Bar']);
  });

  test('number and boolean items still render as their string form', async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await mockItems(page, [42, true]);
    await openList(page);

    await expect(page.getByTestId('item-list')).toHaveAttribute('data-count', '2');
    await expect(page.getByTestId('status')).toHaveAttribute('data-state', 'ok');
    await expect(page.getByTestId('status')).not.toHaveClass(/error/);
    expect(await itemLabels(page)).toEqual(['42', 'true']);
  });

  test('an item added through the form appears in the list under its trimmed name', async ({ page, request }) => {
    page = newSkyrampPlaywrightPage(page);
    const name = `${ADDED_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const added: string[] = [];
    try {
      await openList(page);
      await page.getByTestId('item-name-input').fill(`  ${name}  `);
      const postSent = page.waitForResponse((r) => r.url().endsWith('/api/items') && r.request().method() === 'POST');
      await page.getByTestId('add-item-submit').click();
      const post = await postSent;
      expect(post.request().postDataJSON()).toEqual({ name });
      expect(post.status()).toBe(201);
      added.push(String((await post.json()).id));

      await expect(page.getByTestId('status')).toHaveAttribute('data-state', 'ok');
      await expect(page.getByTestId('status')).toHaveText(`Added "${name}"`);
      await expect(page.getByTestId('item-name-input')).toHaveValue('');
      const li = page.getByTestId('item-list').getByTestId('item').filter({ hasText: name });
      await expect(li).toHaveCount(1);
      expect(await li.textContent()).toBe(name);
      await expect(li).toHaveAttribute('data-item-id', added[0]);
    } finally {
      await deleteAdded(request, added);
    }
  });
});
