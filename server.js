const express = require('express');
const path = require('path');

const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const PORT = process.env.PORT || 8080;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Proxy /api/items* to the backend so the browser never needs CORS.
async function proxy(req, res) {
  try {
    const init = { method: req.method, headers: { Accept: 'application/json' } };
    if (req.method !== 'GET') {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(req.body ?? {});
    }
    const upstream = await fetch(`${API_BASE_URL}${req.path}`, init);
    const text = await upstream.text();
    res.status(upstream.status);
    res.type(upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (err) {
    res.status(502).json({ error: `Could not reach API at ${API_BASE_URL}: ${err.message}` });
  }
}

app.get('/api/items', proxy);
app.get('/api/items/count', proxy);
app.post('/api/items', proxy);

app.get('/healthz', (req, res) => res.json({ ok: true, apiBaseUrl: API_BASE_URL }));

app.listen(PORT, () => {
  console.log(`Frontend listening on http://localhost:${PORT} (API: ${API_BASE_URL})`);
});
