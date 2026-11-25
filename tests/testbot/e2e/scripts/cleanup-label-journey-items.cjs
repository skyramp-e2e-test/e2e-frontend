// Removes items the item-labels journey test made (names starting "label-journey-"), if the test stopped before
// its own cleanup. Exits 0 when there is nothing to remove.
const apiBaseUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

(async () => {
  const res = await fetch(`${apiBaseUrl}/api/items`);
  if (!res.ok) throw new Error(`GET /api/items answered ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.items || [];
  for (const item of items.filter((i) => typeof i.name === "string" && i.name.startsWith("label-journey-"))) {
    const del = await fetch(`${apiBaseUrl}/api/items/${item.id}`, { method: "DELETE" });
    if (!del.ok && del.status !== 404) throw new Error(`DELETE /api/items/${item.id} answered ${del.status}`);
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
