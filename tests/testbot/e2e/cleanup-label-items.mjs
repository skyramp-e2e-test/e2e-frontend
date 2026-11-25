// Removes items the item-labels tests added (names starting "Zeta-labels-") if a run stopped
// before its own cleanup. Exits 0 when there is nothing to remove.
const apiUrl = (process.env.SKYRAMP_TEST_SERVICE_URL_E2E_API || 'http://localhost:3000').replace(/\/+$/, '');
const PREFIXES = ['Zeta-labels-', 'Zeta-walk-'];

const res = await fetch(`${apiUrl}/api/items`);
if (!res.ok) throw new Error(`GET /api/items answered ${res.status}`);
const data = await res.json();
const items = Array.isArray(data) ? data : (data.items ?? []);
const leftovers = items.filter((item) => typeof item?.name === 'string' && PREFIXES.some((p) => item.name.startsWith(p)));
for (const item of leftovers) {
  const del = await fetch(`${apiUrl}/api/items/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
  if (!del.ok && del.status !== 404) throw new Error(`DELETE /api/items/${item.id} answered ${del.status}`);
}
console.log(`removed ${leftovers.length} item(s)`);
