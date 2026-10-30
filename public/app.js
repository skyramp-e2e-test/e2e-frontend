const form = document.getElementById('add-item-form');
const input = document.getElementById('item-name');
const list = document.getElementById('item-list');
const statusEl = document.getElementById('status');
const emptyState = document.getElementById('empty-state');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
  statusEl.dataset.state = isError ? 'error' : 'ok';
}

function itemLabel(item) {
  if (item == null) return '';
  if (typeof item !== 'object') return String(item);
  return item.name ?? item.title ?? JSON.stringify(item);
}

function render(items) {
  list.replaceChildren();
  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.dataset.testid = 'item';
    if (item && item.id != null) li.dataset.itemId = item.id;
    li.dataset.index = index;
    li.textContent = itemLabel(item);
    list.appendChild(li);
  });
  emptyState.hidden = items.length > 0;
  list.dataset.count = items.length;
}

async function readError(res) {
  try {
    const body = await res.json();
    return body.error || body.message || res.statusText;
  } catch {
    return res.statusText;
  }
}

async function loadItems() {
  setStatus('Loading…');
  try {
    const res = await fetch('/api/items');
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.items ?? []);
    render(items);
    setStatus('');
  } catch (err) {
    setStatus(`Failed to load items: ${err.message}`, true);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = input.value.trim();
  if (!name) return;
  form.querySelector('button').disabled = true;
  try {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(await readError(res));
    input.value = '';
    await loadItems();
    setStatus(`Added "${name}"`);
  } catch (err) {
    setStatus(`Failed to add item: ${err.message}`, true);
  } finally {
    form.querySelector('button').disabled = false;
  }
});

loadItems();
