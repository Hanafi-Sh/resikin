import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchWithAuthRetry } from '../src/lib/auth-fetch.js';

test('fetchWithAuthRetry retries once after a 401 response', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ ok: calls.length === 2 }), {
      status: calls.length === 1 ? 401 : 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const response = await fetchWithAuthRetry('/api/assignments');
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].init.credentials, 'same-origin');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchWithAuthRetry retries once after an initial fetch failure', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    if (calls.length === 1) {
      throw new TypeError('fetch failed');
    }
    return new Response('ok', { status: 200 });
  };

  try {
    const response = await fetchWithAuthRetry('/api/assignments');

    assert.equal(response.status, 200);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
