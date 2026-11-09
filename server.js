const express = require('express');
const path = require('path');

const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const PORT = process.env.PORT || 8080;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Build the upstream URL, forwarding only the allowed query parameters (as sent, in order).
function upstreamUrl(req, forwardQuery) {
  const incoming = new URL(req.originalUrl, 'http://placeholder').searchParams;
  const outgoing = new URLSearchParams();
  for (const [key, value] of incoming) {
    if (forwardQuery.includes(key)) outgoing.append(key, value);
  }
  const qs = outgoing.toString();
  return `${API_BASE_URL}${req.path}${qs ? `?${qs}` : ''}`;
}

// Proxy /api/items* to the backend so the browser never needs CORS.
const proxy = ({ forwardQuery = [] } = {}) => async (req, res) => {
  try {
    const init = { method: req.method, headers: { Accept: 'application/json' } };
    if (req.method !== 'GET') {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(req.body ?? {});
    }
    const upstream = await fetch(upstreamUrl(req, forwardQuery), init);
    const text = await upstream.text();
    res.status(upstream.status);
    res.type(upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (err) {
    res.status(502).json({ error: `Could not reach API at ${API_BASE_URL}: ${err.message}` });
  }
};

app.get('/api/items', proxy({ forwardQuery: ['limit', 'offset'] }));
app.get('/api/items/count', proxy());
app.post('/api/items', proxy());

app.get('/healthz', (req, res) => res.json({ ok: true, apiBaseUrl: API_BASE_URL }));

app.listen(PORT, () => {
  console.log(`Frontend listening on http://localhost:${PORT} (API: ${API_BASE_URL})`);
});
