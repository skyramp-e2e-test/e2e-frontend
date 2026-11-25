// Journey against the real app: the user sees the item list with clean labels and adds an item.
import { test, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const baseUrl = getBaseUrl('SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND', 'http://localhost:8080');
const apiUrl = getBaseUrl('SKYRAMP_TEST_SERVICE_URL_E2E_API', 'http://localhost:3000');

// Names of items this test adds start with this; cleanup-label-items.mjs removes leftovers.
const ADDED_PREFIX = 'Zeta-labels-';

test.use({ viewport: { width: 1280, height: 900 } });

function itemLabels(page: Page) {
  return page.getByTestId('item').evaluateAll((lis) => lis.map((li) => li.textContent));
}

async function waitForList(page: Page) {
  await expect(page.getByTestId('item-list')).toHaveAttribute('data-count', /^\d+$/);
  await expect(page.getByTestId('status')).toHaveText('');
}

test('user sees the list with clean labels and adds an item', async ({ page, request }) => {
  page.setDefaultTimeout(15000);
  page = newSkyrampPlaywrightPage(page);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const seededName = `${ADDED_PREFIX}seed-${unique}`;
  const name = `${ADDED_PREFIX}${unique}`;
  const added: string[] = [];
  try {
    // An item the list will show, created with a padded name through the real API.
    const seeded = await request.post(`${apiUrl}/api/items`, { data: { name: `  ${seededName}  ` } });
    expect(seeded.status()).toBe(201);
    added.push(String((await seeded.json()).id));

    await test.step('1. open the items page and see labels without surrounding whitespace', async () => {
      await page.goto(`${baseUrl}/`);
      await waitForList(page);
      const seededLi = page.getByTestId('item-list').getByTestId('item').filter({ hasText: seededName });
      await expect.soft(seededLi).toHaveCount(1);
      expect.soft(await seededLi.textContent()).toBe(seededName);
      const labels = await itemLabels(page);
      expect.soft(labels.filter((l) => l !== (l ?? '').trim())).toEqual([]);
    });

    await test.step('2. add an item with a padded name', async () => {
      await page.getByTestId('item-name-input').fill(`  ${name}  `);
      const postSent = page.waitForResponse((r) => r.url().endsWith('/api/items') && r.request().method() === 'POST');
      await page.getByTestId('add-item-submit').click();
      const post = await postSent;
      expect.soft(post.request().postDataJSON()).toEqual({ name });
      if (post.ok()) added.push(String((await post.json()).id));
      await expect.soft(page.getByTestId('status')).toHaveText(`Added "${name}"`);
      await expect.soft(page.getByTestId('item-name-input')).toHaveValue('');
      const li = page.getByTestId('item-list').getByTestId('item').filter({ hasText: name }).filter({ hasNotText: 'seed-' });
      await expect.soft(li).toHaveCount(1);
      expect.soft(await li.textContent()).toBe(name);
    });

    await test.step('outcome: after a reload every label is shown without surrounding whitespace', async () => {
      await page.reload();
      await waitForList(page);
      const labels = await itemLabels(page);
      expect.soft(labels).toContain(name);
      expect.soft(labels).toContain(seededName);
      expect.soft(labels.filter((l) => l !== (l ?? '').trim())).toEqual([]);
    });
  } finally {
    for (const id of added) {
      await request.delete(`${apiUrl}/api/items/${encodeURIComponent(id)}`);
    }
  }
});
