// Removes the items the item-label tests create in the API: every item whose name starts with
// one of their run prefixes. Exits 0 when there is nothing left to remove.
// Usage: node tests/testbot/e2e/item-label-data.cjs
"use strict";

const API_URL = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");
const PREFIXES = ["Plan Trim Kiwi ", "Journey Label "];

async function main() {
  const res = await fetch(`${API_URL}/api/items`);
  if (!res.ok) throw new Error(`GET /api/items answered ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data) ? data : (data.items ?? []);
  const ours = items.filter((item) => typeof item?.name === "string" && PREFIXES.some((p) => item.name.startsWith(p)));
  for (const item of ours) {
    const del = await fetch(`${API_URL}/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (!del.ok && del.status !== 404) throw new Error(`DELETE /api/items/${item.id} answered ${del.status}`);
  }
  console.log(`removed ${ours.length} item(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
