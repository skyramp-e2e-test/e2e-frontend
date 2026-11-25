// Removes items the add-item and journey browser tests create (names starting with "Apple-tb-", "Banana-tb-" or
// "Cherry-tb-"), through the items API.
// Exits 0 when there is nothing left to remove.
const apiUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || "http://localhost:3000").replace(/\/+$/, "");

async function main() {
  const res = await fetch(`${apiUrl}/api/items`);
  if (!res.ok) throw new Error(`GET /api/items answered ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data) ? data : (data.items ?? []);
  for (const item of items) {
    if (typeof item?.name === "string" && /^(Apple|Banana|Cherry)-tb-/.test(item.name)) {
      const del = await fetch(`${apiUrl}/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (del.status !== 204 && del.status !== 404) throw new Error(`DELETE ${item.id} answered ${del.status}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
