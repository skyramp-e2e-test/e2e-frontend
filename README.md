# e2e-frontend

A small web frontend (Node.js + Express serving static HTML/JS) that lists items from
an API and lets you add new ones.

- `GET /api/items` — shown as a list (the proxy forwards the `limit` and `offset` query
  parameters to the API; other query parameters are dropped)
- `POST /api/items` with `{"name": "..."}` — sent by the "Add" form
- `GET /api/items/count` — shown as "Total items" above the list

The Express server proxies `/api/items` and `/api/items/count` to the API at `API_BASE_URL`, so the browser
talks only to the frontend's origin and the API does not need CORS.

## Requirements

- Node.js 18+ (uses the built-in `fetch`)
- A running API that exposes `GET /api/items` and `POST /api/items`

## Run against the API

```bash
npm install
API_BASE_URL=http://localhost:3000 npm start
```

Then open http://localhost:8080.

| Env var        | Default                 | Description                       |
| -------------- | ----------------------- | --------------------------------- |
| `API_BASE_URL` | `http://localhost:3000` | Base URL of the backend API       |
| `PORT`         | `8080`                  | Port the frontend listens on      |

`GET /healthz` returns `{ ok: true, apiBaseUrl }` so you can check which API the
frontend is configured for. If the API is unreachable, `/api/items` returns `502`
and the page shows an error in the status area.

### Expected API shapes

- `GET /api/items` returns an array of items (or `{ "items": [...] }`). Each item is
  displayed using its `name` (falling back to `title`, then the raw JSON).
- `POST /api/items` accepts `{ "name": "<string>" }` and returns a 2xx status on success.
  After a successful add, the list is reloaded.
- `GET /api/items/count` returns `{ "count": <number> }` (also accepts `{ "total": <number> }`
  or a bare number). It is fetched on page load and after each add; on failure the
  count shows "unavailable".

## Test IDs

Key elements carry `data-testid` attributes for testing:

| `data-testid`       | Element                                                        |
| ------------------- | -------------------------------------------------------------- |
| `app`               | Main container                                                 |
| `page-title`        | Page heading                                                   |
| `item-count`        | Total count line (`data-count` = count, `data-state` = `ok`/`error`) |
| `item-count-value`  | The count number (or "unavailable")                            |
| `add-item-form`     | The add-item form                                              |
| `item-name-input`   | Name text input                                                |
| `add-item-submit`   | Submit button                                                  |
| `status`            | Status/error message (`data-state` is `ok` or `error`)         |
| `empty-state`       | "No items yet." message (hidden when items exist)              |
| `item-list`         | The `<ul>` of items (`data-count` = number of items)           |
| `item`              | Each `<li>` (`data-item-id` = item `id` when present)          |
