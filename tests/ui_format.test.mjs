import assert from 'node:assert/strict';
import test from 'node:test';

import { formatMenuLines, formatPanelLabel } from '../gnome-extension/format.mjs';

const signedIn = {
  auth: { state: 'signed_in', method: 'chatgpt' },
  checkedAt: '2026-10-05T16:00:00Z',
  usage: {
    state: 'available',
    plan: 'plus',
    primary: { remainingPercent: 80, windowDurationMins: 300, resetsAt: '2026-10-05T17:30:00Z' },
    secondary: { remainingPercent: 55, windowDurationMins: 10080, resetsAt: '2026-10-11T12:00:00Z' },
  },
};

test('panel label stays compact and shows the primary remaining allowance', () => {
  assert.equal(formatPanelLabel(signedIn), 'Codex 80%');
});

test('panel label exposes signed-out and failed-usage states', () => {
  assert.equal(formatPanelLabel({ auth: { state: 'signed_out' }, usage: { state: 'unavailable' } }), 'Codex off');
  assert.equal(formatPanelLabel({ auth: { state: 'signed_in' }, usage: { state: 'error' } }), 'Codex !');
});

test('menu details include sign-in method, both quota windows, and refresh time', () => {
  const lines = formatMenuLines(signedIn, { timeZone: 'UTC' });
  assert.equal(lines[0], 'Signed in with ChatGPT');
  assert.ok(lines.some((line) => line.includes('5-hour limit: 80% left')));
  assert.ok(lines.some((line) => line.includes('Weekly limit: 55% left')));
  assert.ok(lines.some((line) => line.includes('Checked at')));
});

test('menu explains unavailable usage without inventing an allowance', () => {
  const lines = formatMenuLines({
    auth: { state: 'signed_in', method: 'api_key' },
    checkedAt: '2026-10-05T16:00:00Z',
    usage: { state: 'unavailable', reason: 'Usage limits require ChatGPT sign-in' },
  });
  assert.ok(lines.includes('Usage limits require ChatGPT sign-in'));
  assert.ok(!lines.some((line) => line.includes('100%')));
});
