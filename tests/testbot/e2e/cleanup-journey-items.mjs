// Removes items the item-labels journey test created (names starting "labels-journey-") through the e2e-api,
// for when that test stopped before its own cleanup. Exits 0 when there is nothing to remove.
const api = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");
const res = await fetch(`${api}/api/items?q=labels-journey-`);
if (!res.ok) throw new Error(`GET /api/items answered ${res.status}`);
const body = await res.json();
const items = Array.isArray(body) ? body : body.items ?? [];
for (const item of items.filter((i) => typeof i.name === "string" && i.name.startsWith("labels-journey-"))) {
  const del = await fetch(`${api}/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
  if (!del.ok && del.status !== 404) throw new Error(`DELETE ${item.id} answered ${del.status}`);
}
