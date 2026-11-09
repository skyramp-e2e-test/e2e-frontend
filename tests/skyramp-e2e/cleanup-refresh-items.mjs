// Removes the items tests/refresh-button.e2e.ts creates, if a run stopped before its own cleanup.
// Exits 0 when there is nothing to remove. Usage: node tests/skyramp-e2e/cleanup-refresh-items.mjs
const API_URL = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");
const CREATED_BY_TESTS = /^(Journey item|From another user|Refreshed from API|Refresh e2e) \d+/;

const res = await fetch(`${API_URL}/api/items`);
if (!res.ok) throw new Error(`GET /api/items answered ${res.status}`);
const items = await res.json();
let removed = 0;
for (const item of items) {
  if (typeof item?.name === "string" && CREATED_BY_TESTS.test(item.name)) {
    const del = await fetch(`${API_URL}/api/items/${item.id}`, { method: "DELETE" });
    if (!del.ok && del.status !== 404) throw new Error(`DELETE /api/items/${item.id} answered ${del.status}`);
    removed += 1;
  }
}
console.log(`removed ${removed} item(s)`);
