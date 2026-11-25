// Calls to the items API behind the frontend, for test setup and cleanup.
// The frontend proxies only GET and POST, so deletes go to the API itself.

export const ITEM_NAME_PREFIX = "Kiwi-tb-";

export const apiBaseUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

type Item = { id: string; name: string };

export async function listItems(): Promise<Item[]> {
  const res = await fetch(`${apiBaseUrl}/api/items`);
  if (!res.ok) throw new Error(`GET /api/items answered ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.items ?? []);
}

/** Deletes every item whose name is exactly one of `names`. */
export async function deleteItemsNamed(...names: string[]): Promise<void> {
  const items = await listItems();
  for (const item of items.filter((i) => names.includes(i.name))) {
    await fetch(`${apiBaseUrl}/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
  }
}

/** Creates an item through the API and returns it as the API answered. */
export async function createItem(name: string): Promise<Item> {
  const res = await fetch(`${apiBaseUrl}/api/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (res.status !== 201 && res.status !== 200) throw new Error(`POST /api/items answered ${res.status}`);
  return res.json();
}
