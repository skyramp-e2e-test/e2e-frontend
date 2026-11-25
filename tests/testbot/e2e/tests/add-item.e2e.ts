// Adding an item through the form, against the real items API, lists it by its trimmed name.
import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { itemListPage } from "../item-list-page";

const apiUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

test.use({ viewport: { width: 1280, height: 900 } });

test("adding an item with surrounding spaces lists it by its trimmed name", async ({ page, request }) => {
  const name = `Banana-tb-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  page.setDefaultTimeout(15000);
  page = newSkyrampPlaywrightPage(page);
  const items = itemListPage(page);
  try {
    await items.open();
    await expect(items.countValue).toHaveText(/^\d+$/);
    const before = Number(await items.countValue.textContent());

    await items.nameInput.fill(`  ${name}  `);
    const posted = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/items");
    await items.submit.click();
    expect((await posted).postDataJSON()).toEqual({ name });

    await expect(items.status).toHaveText(`Added "${name}"`);
    const row = items.items.filter({ hasText: name });
    await expect(row).toHaveCount(1);
    expect(await row.evaluate((el) => el.textContent)).toBe(name);
    await expect(items.countValue).toHaveText(String(before + 1));
  } finally {
    const res = await request.get(`${apiUrl}/api/items`);
    const data = await res.json();
    for (const item of Array.isArray(data) ? data : (data.items ?? [])) {
      if (item?.name === name) await request.delete(`${apiUrl}/api/items/${encodeURIComponent(item.id)}`);
    }
  }
});
