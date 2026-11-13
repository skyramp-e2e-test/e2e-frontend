// Deletes the items the discounted-price browser tests create in the e2e API: every item whose name starts with the
// given prefix. Exits 0 when there is nothing left to delete.
// Usage: node tests/testbot/e2e/scripts/delete-test-items.mjs "Testbot price "
const prefix = process.argv[2];
if (!prefix) {
  console.error("usage: delete-test-items.mjs <name prefix>");
  process.exit(2);
}
const api = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");
const res = await fetch(`${api}/api/items`);
if (!res.ok) {
  console.error(`GET ${api}/api/items answered ${res.status}`);
  process.exit(1);
}
const items = await res.json();
let deleted = 0;
for (const item of items) {
  if (typeof item?.name === "string" && item.name.startsWith(prefix)) {
    const del = await fetch(`${api}/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (!del.ok && del.status !== 404) {
      console.error(`DELETE ${item.id} answered ${del.status}`);
      process.exit(1);
    }
    deleted += 1;
  }
}
console.log(`deleted ${deleted} item(s) named "${prefix}…"`);
