import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { formatAuth, formatQuotaWindow } = require('../vicinae-extension/src/format.js');

test('Vicinae auth row hides credentials and names the auth method', () => {
  assert.equal(formatAuth({ state: 'signed_in', method: 'chatgpt' }), 'Signed in with ChatGPT');
  assert.equal(formatAuth({ state: 'signed_in', method: 'api_key' }), 'Signed in with API key');
  assert.equal(formatAuth({ state: 'signed_out' }), 'Not signed in to Codex CLI');
});

test('Vicinae quota rows show remaining usage and localizable reset time', () => {
  assert.deepEqual(
    formatQuotaWindow(
      { remainingPercent: 80, windowDurationMins: 300, resetsAt: '2026-10-05T17:30:00Z' },
      0,
      { timeZone: 'UTC', locale: 'en-US' },
    ),
    { title: '5-hour limit', accessory: '80% left', subtitle: 'Resets at 5:30 PM' },
  );
});

test('Vicinae does not invent quota values for an absent window', () => {
  assert.equal(formatQuotaWindow(null, 0), null);
  assert.equal(formatQuotaWindow({ windowDurationMins: 300 }, 0), null);
});
