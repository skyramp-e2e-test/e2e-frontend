// Removes items the item-label journey test creates ("Trim Journey <ts>"), if a run stopped before its own cleanup.
// Exits 0 when there is nothing to remove.
const apiUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

const res = await fetch(`${apiUrl}/api/items?q=${encodeURIComponent("Trim Journey ")}`);
if (!res.ok) throw new Error(`GET /api/items answered ${res.status}`);
const items = await res.json();
for (const item of items) {
  if (typeof item.name !== "string" || !item.name.startsWith("Trim Journey ")) continue;
  const del = await fetch(`${apiUrl}/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
  if (!del.ok && del.status !== 404) throw new Error(`DELETE /api/items/${item.id} answered ${del.status}`);
}
