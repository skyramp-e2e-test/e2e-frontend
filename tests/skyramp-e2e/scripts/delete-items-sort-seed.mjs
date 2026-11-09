// Removes the items tests/items-sort.e2e.ts creates, if a run stopped before its own cleanup.
// Deletes, through the API, every item whose name is one of the names those tests seed. Exits 0 when none are left.
const API_URL = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");
const NAMES = new Set([
  "Cherry", "Apple", "Banana", "banana", "cherry", "apricot",
  "item 10", "item 2", "item 1", "Item 10", "item 9", "ITEM 1", "apple",
]);

const res = await fetch(`${API_URL}/api/items`);
if (!res.ok) throw new Error(`GET /api/items answered ${res.status}`);
const items = await res.json();
for (const item of items) {
  if (!NAMES.has(item.name)) continue;
  const del = await fetch(`${API_URL}/api/items/${item.id}`, { method: "DELETE" });
  if (del.status !== 204 && del.status !== 404) throw new Error(`DELETE ${item.id} answered ${del.status}`);
}
