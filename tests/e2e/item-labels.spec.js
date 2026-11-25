// Playwright journey: add an item with spaces around its name and see it listed trimmed.
const { test, expect } = require('@playwright/test');

const UI = process.env.SKYRAMP_TEST_SERVICE_URL_UI || process.env.SKYRAMP_TEST_SERVICE_URL_E2E_FRONTEND || 'http://localhost:8080';
const API = process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || 'http://localhost:3000';

test('adding an item with spaces around its name lists it trimmed and raises the count', async ({ page, request }) => {
  const trimmed = `Spaced ${Date.now()}`;
  let createdId;
  let before;
  try {
    await test.step('1. open the Items page', async () => {
      await page.goto(`${UI}/`);
      await expect(page.getByTestId('item-count')).toHaveAttribute('data-count', /^\d+$/);
      await expect(page.getByTestId('status')).toHaveText('');
      before = Number(await page.getByTestId('item-count').getAttribute('data-count'));
    });

    await test.step('2. type the name with spaces and click Add', async () => {
      await page.getByTestId('item-name-input').fill(`  ${trimmed}  `);
      const [req] = await Promise.all([
        page.waitForRequest((r) => r.url().endsWith('/api/items') && r.method() === 'POST'),
        page.getByTestId('add-item-submit').click(),
      ]);
      expect(req.postDataJSON()).toEqual({ name: trimmed });
      await expect.soft(page.getByTestId('status')).toHaveText(`Added "${trimmed}"`);
    });

    await test.step('3. see the new item listed trimmed and the count up by one', async () => {
      const item = page.getByTestId('item').filter({ hasText: trimmed });
      await expect(item).toHaveCount(1);
      createdId = await item.getAttribute('data-item-id');
      expect.soft(await item.evaluate((el) => el.textContent)).toBe(trimmed);
      await expect.soft(page.getByTestId('item-count-value')).toHaveText(String(before + 1));
    });
  } finally {
    if (createdId) await request.delete(`${API}/api/items/${createdId}`);
  }
});
