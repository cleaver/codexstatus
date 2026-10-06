import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import Module from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const originalLoad = Module._load;

test('Vicinae production bundle loads with its embedded local formatter', () => {
  Module._load = function loadWithHostModules(request, parent, isMain) {
    if (request === 'react') return { createElement() {} };
    if (request === '@vicinae/api') return {};
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const extension = require('../dist/codex-status-vicinae/codex-status.js');
    assert.equal(typeof extension.default, 'function');
  } finally {
    Module._load = originalLoad;
  }
});
