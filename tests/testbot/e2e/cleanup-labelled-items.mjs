// Removes, through the API, the items the item-label tests add ("Labelled item <run id>"), in case a test stopped
// before its own cleanup. Exits 0 when there is nothing to remove.
const api = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");
const res = await fetch(`${api}/api/items`);
if (!res.ok) throw new Error(`GET /api/items answered ${res.status}`);
const data = await res.json();
const items = Array.isArray(data) ? data : (data.items ?? []);
let removed = 0;
for (const item of items) {
  if (item && item.id != null && typeof item.name === "string" && /^Labelled item \d+-\d+$/.test(item.name)) {
    const del = await fetch(`${api}/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (del.ok || del.status === 404) removed++;
    else throw new Error(`DELETE /api/items/${item.id} answered ${del.status}`);
  }
}
console.log(`removed ${removed} item(s)`);
