// Removes the items the add-item browser tests create (names starting "Journey Apple "),
// for when a test stops before its own cleanup runs. Exits 0 when there is nothing to remove.
// Usage: node tests/testbot/e2e/cleanup-journey-items.mjs
const apiBase = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");
const prefix = "Journey Apple ";

const res = await fetch(`${apiBase}/api/items`);
if (!res.ok) {
  console.error(`GET /api/items answered ${res.status}`);
  process.exit(1);
}
const items = await res.json();
let removed = 0;
for (const item of items) {
  if (typeof item?.name === "string" && item.name.startsWith(prefix)) {
    const del = await fetch(`${apiBase}/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (!del.ok && del.status !== 404) {
      console.error(`DELETE /api/items/${item.id} answered ${del.status}`);
      process.exit(1);
    }
    removed += 1;
  }
}
console.log(`Removed ${removed} item(s)`);
