// Removes items the item-label tests add through the page (names starting "Journey widget "),
// for when a test stops before its own cleanup runs. Exits 0 when there is nothing to remove.
const apiUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

const res = await fetch(`${apiUrl}/api/items`);
if (!res.ok) throw new Error(`GET /api/items answered ${res.status}`);
const items = await res.json();
for (const item of items) {
  if (typeof item?.name === "string" && item.name.startsWith("Journey widget ")) {
    const del = await fetch(`${apiUrl}/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (!del.ok && del.status !== 404) throw new Error(`DELETE ${item.id} answered ${del.status}`);
  }
}
