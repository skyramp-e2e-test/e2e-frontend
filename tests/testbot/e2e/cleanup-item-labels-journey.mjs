// Deletes every item the item labels journey made (names starting with "label-journey-").
// Exits 0 when there is nothing to delete.
const apiUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API ?? "http://localhost:3000").replace(/\/+$/, "");
const prefix = "label-journey-";

const res = await fetch(`${apiUrl}/api/items?q=${encodeURIComponent(prefix)}`);
if (!res.ok) throw new Error(`GET /api/items: ${res.status}`);
const items = await res.json();
for (const item of items.filter((i) => String(i.name).startsWith(prefix))) {
  const del = await fetch(`${apiUrl}/api/items/${item.id}`, { method: "DELETE" });
  if (!del.ok && del.status !== 404) throw new Error(`DELETE ${item.id}: ${del.status}`);
}
