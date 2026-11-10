// Functional checks of the frontend server's /api proxy routes against a running API.
import { test, expect, APIRequestContext } from "@playwright/test";

const apiBase = process.env.SKYRAMP_TEST_SERVICE_URL_API || "http://localhost:3000";
const frontendBase = process.env.SKYRAMP_TEST_SERVICE_URL_FRONTEND || "http://localhost:8080";
const frontendNoApi = process.env.SKYRAMP_TEST_SERVICE_URL_FRONTENDNOAPI || "http://localhost:8081";

// The items checks read the shared list and count, so they must not interleave.
test.describe.configure({ mode: "serial" });

function mediaType(contentType: string | undefined): string {
  return (contentType ?? "").split(";")[0].trim().toLowerCase();
}

async function getJson(request: APIRequestContext, url: string) {
  const res = await request.get(url);
  return { res, body: await res.json() };
}

test.describe("GET /api/health proxies the API's GET /health", () => {
  test("returns the API health body unchanged", async ({ request }) => {
    const direct = await getJson(request, `${apiBase}/health`);
    const proxied = await getJson(request, `${frontendBase}/api/health`);

    expect(Object.keys(proxied.body).sort()).toEqual(Object.keys(direct.body).sort());
    expect(Object.keys(proxied.body).sort()).toEqual(["status", "uptime"]);
    expect(proxied.body.status).toBe("ok");
    expect(proxied.body.status).toBe(direct.body.status);
    expect(typeof proxied.body.uptime).toBe("number");
    expect(proxied.body.uptime).toBeGreaterThanOrEqual(direct.body.uptime - 1);
    expect(proxied.body).not.toHaveProperty("error");
    expect(proxied.body).not.toHaveProperty("ok");
    expect(proxied.body).not.toHaveProperty("apiBaseUrl");
  });

  test("returns the API health status code unchanged", async ({ request }) => {
    const direct = await request.get(`${apiBase}/health`);
    const proxied = await request.get(`${frontendBase}/api/health`);

    expect(direct.status()).toBe(200);
    expect(proxied.status()).toBe(200);
    expect(proxied.status()).toBe(direct.status());
  });

  test("returns the API health content type unchanged", async ({ request }) => {
    const direct = await request.get(`${apiBase}/health`);
    const proxied = await request.get(`${frontendBase}/api/health`);

    expect(mediaType(direct.headers()["content-type"])).toBe("application/json");
    expect(mediaType(proxied.headers()["content-type"])).toBe(mediaType(direct.headers()["content-type"]));
    expect(proxied.headers()["content-type"].toLowerCase()).toContain("charset=utf-8");
  });

  test("reaches the API's /health path rather than /api/health on the API", async ({ request }) => {
    const control = await getJson(request, `${apiBase}/api/health`);
    expect(control.res.status()).toBe(404);
    expect(control.body).toEqual({ error: "Not found" });

    const proxied = await getJson(request, `${frontendBase}/api/health`);
    expect(proxied.res.status()).toBe(200);
    expect(proxied.body).not.toEqual({ error: "Not found" });
    expect(proxied.body.status).toBe("ok");
    expect(typeof proxied.body.uptime).toBe("number");
  });
});

test.describe("proxied routes with the API unreachable", () => {
  test("GET /api/health answers 502 with an error JSON", async ({ request }) => {
    const { res, body } = await getJson(request, `${frontendNoApi}/api/health`);

    expect(res.status()).toBe(502);
    expect(mediaType(res.headers()["content-type"])).toBe("application/json");
    expect(Object.keys(body)).toEqual(["error"]);
    expect(typeof body.error).toBe("string");
    expect(body.error.startsWith("Could not reach API at ")).toBe(true);
  });

  test("GET /api/health 502 has the same shape as GET /api/items 502", async ({ request }) => {
    const health = await getJson(request, `${frontendNoApi}/api/health`);
    const items = await getJson(request, `${frontendNoApi}/api/items`);

    expect(health.res.status()).toBe(502);
    expect(items.res.status()).toBe(502);
    expect(mediaType(items.res.headers()["content-type"])).toBe("application/json");
    expect(Object.keys(health.body)).toEqual(["error"]);
    expect(Object.keys(items.body)).toEqual(["error"]);
    expect(items.body.error.startsWith("Could not reach API at ")).toBe(true);
    // "Could not reach API at http://host:port: reason" — compare everything before the reason.
    const prefix = (msg: string) => msg.slice(0, msg.lastIndexOf(": "));
    expect(prefix(health.body.error)).toBe(prefix(items.body.error));
  });
});

test.describe("existing /api/items proxy routes", () => {
  test("GET /api/items returns the API's list", async ({ request }) => {
    const direct = await getJson(request, `${apiBase}/api/items`);
    const proxied = await getJson(request, `${frontendBase}/api/items`);

    expect(direct.res.status()).toBe(200);
    expect(proxied.res.status()).toBe(200);
    expect(mediaType(proxied.res.headers()["content-type"])).toBe("application/json");
    expect(Array.isArray(proxied.body)).toBe(true);
    expect(proxied.body).toEqual(direct.body);
  });
});

test("GET /healthz still reports ok and the API base URL", async ({ request }) => {
  const { res, body } = await getJson(request, `${frontendBase}/healthz`);
  expect(res.status()).toBe(200);
  expect(body).toEqual({ ok: true, apiBaseUrl: apiBase });
});
