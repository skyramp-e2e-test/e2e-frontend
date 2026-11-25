// Removes the items tests/item-labels.e2e.ts creates (their names start with "Testbot label "), for a run that
// stopped before its own cleanup. Exits 0 when there is nothing to remove.
const apiUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/$/, "");
const res = await fetch(`${apiUrl}/api/items`);
if (!res.ok) throw new Error(`GET /api/items answered ${res.status}`);
const data = await res.json();
const items = Array.isArray(data) ? data : (data.items ?? []);
for (const item of items) {
  if (typeof item?.name === "string" && item.name.startsWith("Testbot label ")) {
    const del = await fetch(`${apiUrl}/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (del.status !== 204 && del.status !== 404) throw new Error(`DELETE ${item.id} answered ${del.status}`);
  }
}
