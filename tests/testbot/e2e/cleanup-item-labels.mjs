// Removes items the add-item journey test adds through the real API, if a run stopped before its own cleanup.
// Exits 0 when there is nothing to remove.
const apiUrl = process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000";
const PREFIX = "Kiwi Fruit testbot-";

const res = await fetch(`${apiUrl}/api/items`);
if (!res.ok) throw new Error(`GET /api/items answered ${res.status}`);
const data = await res.json();
const items = Array.isArray(data) ? data : (data.items ?? []);
for (const item of items) {
  if (typeof item?.name === "string" && item.name.startsWith(PREFIX)) {
    const del = await fetch(`${apiUrl}/api/items/${item.id}`, { method: "DELETE" });
    if (!del.ok && del.status !== 404) throw new Error(`DELETE ${item.id} answered ${del.status}`);
  }
}
