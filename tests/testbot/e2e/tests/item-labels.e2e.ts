// Drafted with the Skyramp walk helper against the running e2e-frontend + e2e-api, then strengthened.
import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { ItemsPage, apiUrl } from "../support/items-page";

const pageTimeout = 15000;

async function deleteItemsNamed(name: string): Promise<void> {
  const res = await fetch(`${apiUrl}/api/items?q=${encodeURIComponent(name)}`);
  if (!res.ok) return;
  const items: { id: string; name: string }[] = await res.json();
  for (const item of items.filter((i) => i.name === name)) {
    await fetch(`${apiUrl}/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
  }
}

test("adding an item with spaces around its name lists it with a trimmed label", async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const items = new ItemsPage(page);
  const name = `Trim Journey ${Date.now()}`;
  let listCountBefore = NaN;
  let totalBefore = NaN;

  try {
    await test.step("1. open the Items page and see the list load", async () => {
      await items.goto();
      await expect(items.status).toHaveAttribute("data-state", "ok");
      await expect(page.getByTestId("item-count")).toHaveAttribute("data-state", "ok");
      await expect(items.countValue).toHaveText(/^\d+$/);
      listCountBefore = Number(await items.list.getAttribute("data-count"));
      totalBefore = Number(await items.countValue.textContent());
      expect.soft(Number.isInteger(listCountBefore)).toBe(true);
    });

    await test.step("2. type the name with surrounding spaces and click Add", async () => {
      await items.nameInput.fill(`  ${name}  `);
      const postRequest = page.waitForRequest(
        (req) => req.method() === "POST" && new URL(req.url()).pathname === "/api/items",
      );
      await items.addButton.click();
      expect.soft((await postRequest).postDataJSON()).toEqual({ name });
      await expect.soft(items.status).toHaveText(`Added "${name}"`);
      await expect.soft(items.status).toHaveAttribute("data-state", "ok");
    });

    await test.step("3. see the new entry with a trimmed label and the counts one higher", async () => {
      await expect.soft(items.list).toHaveAttribute("data-count", String(listCountBefore + 1));
      const texts = await items.allTexts();
      expect.soft(texts.filter((t) => t === name)).toHaveLength(1);
      expect.soft(texts.filter((t) => t !== null && t.trim() === name && t !== name)).toEqual([]);
      await expect.soft(items.countValue).toHaveText(String(totalBefore + 1));
      await expect.soft(items.status).not.toHaveClass(/error/);
    });
  } finally {
    await deleteItemsNamed(name);
  }
});
