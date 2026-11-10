'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const express = require('express');

const API_BASE_URL = 'http://api.example';

// Load server.js in this process: keep app.listen from opening a port and capture the app instead.
function loadApp() {
  const originalListen = express.application.listen;
  const originalApiBase = process.env.API_BASE_URL;
  let app;
  express.application.listen = function captureApp() {
    app = this;
    return { close() {} };
  };
  process.env.API_BASE_URL = API_BASE_URL;
  try {
    delete require.cache[require.resolve('../server.js')];
    require('../server.js');
  } finally {
    express.application.listen = originalListen;
    if (originalApiBase === undefined) delete process.env.API_BASE_URL;
    else process.env.API_BASE_URL = originalApiBase;
  }
  return app;
}

// Stand-in for the API: replaces global fetch, records each call and answers a configurable status/body.
const upstream = {
  requests: [],
  status: 200,
  body: '[]',
  contentType: 'application/json',
  unreachable: false,
  reset() {
    this.requests = [];
    this.status = 200;
    this.body = '[]';
    this.contentType = 'application/json';
    this.unreachable = false;
  },
  async fetch(url, init = {}) {
    const headers = init.headers || {};
    upstream.requests.push({
      method: init.method || 'GET',
      url: String(url).startsWith(API_BASE_URL) ? String(url).slice(API_BASE_URL.length) : String(url),
      body: init.body === undefined ? '' : String(init.body),
      contentType: headers['Content-Type'],
    });
    if (upstream.unreachable) throw new TypeError('fetch failed');
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.contentType },
    });
  },
};

// Send one request through the Express app without a socket and collect the response.
function request(app, method, url, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(body);
    const req = new Readable({
      read() {
        if (payload) this.push(payload);
        this.push(null);
      },
    });
    req.method = method;
    req.url = url;
    req.headers = {};
    for (const [k, v] of Object.entries(headers)) req.headers[k.toLowerCase()] = v;
    if (payload) req.headers['content-length'] = String(payload.length);
    req.connection = req.socket = { encrypted: false };

    const resHeaders = {};
    const res = {
      statusCode: 200,
      headersSent: false,
      setHeader(name, value) {
        resHeaders[name.toLowerCase()] = value;
      },
      getHeader(name) {
        return resHeaders[name.toLowerCase()];
      },
      getHeaders() {
        return { ...resHeaders };
      },
      removeHeader(name) {
        delete resHeaders[name.toLowerCase()];
      },
      writeHead(status) {
        this.statusCode = status;
      },
      write() {
        return true;
      },
      end(chunk) {
        this.headersSent = true;
        let text = '';
        if (chunk !== undefined && chunk !== null) text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        resolve({ status: this.statusCode, headers: resHeaders, text });
      },
      on() {
        return this;
      },
      once() {
        return this;
      },
      emit() {
        return false;
      },
    };
    app.handle(req, res, (err) => reject(err || new Error(`no route answered ${method} ${url}`)));
  });
}

describe('frontend proxy to the items API', () => {
  let app;
  let originalFetch;

  before(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = upstream.fetch;
    app = loadApp();
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => upstream.reset());

  async function upstreamUrlFor(pathAndQuery) {
    upstream.requests = [];
    const res = await request(app, 'GET', pathAndQuery);
    assert.equal(upstream.requests.length, 1, `one upstream request for ${pathAndQuery}`);
    return { url: upstream.requests[0].url, status: res.status };
  }

  it('GET /api/items forwards both limit and offset', async () => {
    const res = await request(app, 'GET', '/api/items?limit=5&offset=10');
    assert.equal(res.status, 200);
    assert.equal(upstream.requests.length, 1);
    assert.equal(upstream.requests[0].method, 'GET');
    assert.equal(upstream.requests[0].url, '/api/items?limit=5&offset=10');
  });

  it('GET /api/items forwards limit or offset alone', async () => {
    assert.equal((await upstreamUrlFor('/api/items?limit=5')).url, '/api/items?limit=5');
    assert.equal((await upstreamUrlFor('/api/items?offset=10')).url, '/api/items?offset=10');
  });

  it('GET /api/items without paging params calls the plain upstream path', async () => {
    for (const p of ['/api/items', '/api/items?']) {
      const { url, status } = await upstreamUrlFor(p);
      assert.equal(url, '/api/items', `upstream url for ${p}`);
      assert.equal(status, 200, `status for ${p}`);
    }
  });

  it('GET /api/items relays the API answer to a paged request unchanged', async () => {
    upstream.body = '[{"id":"a","name":"A"}]';
    const res = await request(app, 'GET', '/api/items?limit=1');
    assert.equal(res.status, 200);
    assert.equal(res.text, '[{"id":"a","name":"A"}]');
    assert.match(res.headers['content-type'], /application\/json/);
    assert.equal(upstream.requests[0].url, '/api/items?limit=1');
  });

  it('GET /api/items drops other params mixed with limit and offset', async () => {
    assert.equal(
      (await upstreamUrlFor('/api/items?limit=5&offset=10&foo=bar&sort=name')).url,
      '/api/items?limit=5&offset=10',
    );
    assert.equal(
      (await upstreamUrlFor('/api/items?foo=bar&offset=2&page=3&limit=1')).url,
      '/api/items?offset=2&limit=1',
    );
  });

  it('GET /api/items forwards nothing when only other params are sent', async () => {
    assert.equal((await upstreamUrlFor('/api/items?foo=bar&page=2')).url, '/api/items');
  });

  it('GET /api/items drops case variants and bracket forms of limit and offset', async () => {
    assert.equal((await upstreamUrlFor('/api/items?Limit=5&OFFSET=1')).url, '/api/items');
    assert.equal((await upstreamUrlFor('/api/items?limit[]=5&offset[x]=1')).url, '/api/items');
  });

  it('GET /api/items forwards invalid paging values verbatim without rejecting them', async () => {
    for (const q of ['?limit=abc&offset=-1', '?limit=0', '?limit=1000', '?limit=']) {
      const { url, status } = await upstreamUrlFor(`/api/items${q}`);
      assert.equal(url, `/api/items${q}`, `upstream url for ${q}`);
      assert.equal(status, 200, `frontend status for ${q}`);
    }
  });

  it('GET /api/items relays the API rejection of a bad paging value', async () => {
    upstream.status = 400;
    upstream.body = '{"error":"limit must be a positive integer"}';
    const res = await request(app, 'GET', '/api/items?limit=abc');
    assert.equal(res.status, 400);
    assert.equal(res.text, '{"error":"limit must be a positive integer"}');
    assert.equal(upstream.requests.length, 1);
    assert.equal(upstream.requests[0].url, '/api/items?limit=abc');
  });

  it('GET /api/items passes a repeated parameter through as sent', async () => {
    assert.equal((await upstreamUrlFor('/api/items?limit=5&limit=7')).url, '/api/items?limit=5&limit=7');
  });

  it('GET /api/items keeps the decoded value of percent-encoded params', async () => {
    const cases = [
      ['?limit=1%202&offset=%2B3', [['limit', '1 2'], ['offset', '+3']]],
      ['?limit=%E2%82%AC&offset=a%26b%3Dc', [['limit', '€'], ['offset', 'a&b=c']]],
    ];
    for (const [q, expected] of cases) {
      const { url } = await upstreamUrlFor(`/api/items${q}`);
      const forwarded = new URL(url, 'http://x');
      assert.equal(forwarded.pathname, '/api/items');
      assert.deepEqual([...forwarded.searchParams], expected, `decoded params for ${q}`);
    }
  });

  it('GET /api/items/count forwards no query parameters', async () => {
    const count = await upstreamUrlFor('/api/items/count?limit=5&offset=10&foo=1');
    assert.equal(count.url, '/api/items/count');
    assert.equal(upstream.requests[0].method, 'GET');
    assert.equal(count.status, 200);
  });

  it('answers 502 with an error for a paged list request and for count when the API is unreachable', async () => {
    upstream.unreachable = true;
    for (const p of ['/api/items?limit=5&offset=1', '/api/items/count']) {
      const res = await request(app, 'GET', p);
      assert.equal(res.status, 502, `status for ${p}`);
      const body = JSON.parse(res.text);
      assert.ok(body.error.startsWith(`Could not reach API at ${API_BASE_URL}: `), `error for ${p}: ${body.error}`);
    }
  });
});
