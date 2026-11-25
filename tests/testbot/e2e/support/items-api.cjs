// Items the browser tests add through the page are removed straight from e2e-api:
// the frontend proxies only GET and POST, so DELETE goes to the API itself.
// Run directly (node tests/testbot/e2e/support/items-api.cjs) it removes every item
// whose name starts with TEST_ITEM_PREFIX, for a run that stopped before its own cleanup.
"use strict";

const TEST_ITEM_PREFIX = "Pear Trim tb-";

function apiBaseUrl() {
  return (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");
}

async function deleteItemsWhere(match) {
  const res = await fetch(`${apiBaseUrl()}/api/items`);
  if (!res.ok) throw new Error(`GET /api/items answered ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data) ? data : (data.items ?? []);
  let removed = 0;
  for (const item of items) {
    if (item && typeof item.name === "string" && match(item.name)) {
      const del = await fetch(`${apiBaseUrl()}/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (!del.ok && del.status !== 404) throw new Error(`DELETE /api/items/${item.id} answered ${del.status}`);
      removed += 1;
    }
  }
  return removed;
}

function deleteItemsNamed(name) {
  return deleteItemsWhere((n) => n === name);
}

module.exports = { TEST_ITEM_PREFIX, deleteItemsNamed, deleteItemsWhere };

if (require.main === module) {
  deleteItemsWhere((n) => n.startsWith(TEST_ITEM_PREFIX))
    .then((n) => console.log(`removed ${n} test item(s)`))
    .catch((err) => { console.error(err); process.exit(1); });
}
