// Removes items the item-label browser tests left in the e2e-api (names starting "label-trim-e2e-").
// Exits 0 when there is nothing to remove.
const API_URL = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");
const PREFIX = "label-trim-e2e-";

const res = await fetch(`${API_URL}/api/items`);
if (!res.ok) throw new Error(`GET /api/items answered ${res.status}`);
const data = await res.json();
const items = Array.isArray(data) ? data : (data.items ?? []);
for (const item of items) {
  if (typeof item?.name === "string" && item.name.startsWith(PREFIX)) {
    const del = await fetch(`${API_URL}/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (!del.ok && del.status !== 404) throw new Error(`DELETE /api/items/${item.id} answered ${del.status}`);
  }
}
