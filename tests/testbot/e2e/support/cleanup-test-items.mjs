// Removes items the item-labels tests add (names starting "Kiwi-tb-") if a run stopped before its own cleanup.
// Exits 0 when there is nothing to remove. Run: node tests/testbot/e2e/support/cleanup-test-items.mjs
const apiBaseUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

const res = await fetch(`${apiBaseUrl}/api/items`);
if (!res.ok) throw new Error(`GET /api/items answered ${res.status}`);
const data = await res.json();
const items = Array.isArray(data) ? data : (data.items ?? []);
const mine = items.filter((i) => typeof i.name === "string" && i.name.startsWith("Kiwi-tb-"));
for (const item of mine) {
  const del = await fetch(`${apiBaseUrl}/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
  if (!del.ok && del.status !== 404) throw new Error(`DELETE /api/items/${item.id} answered ${del.status}`);
}
console.log(`removed ${mine.length} test item(s)`);
