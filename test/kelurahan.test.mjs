import test from 'node:test';
import assert from 'node:assert/strict';

import { KELURAHAN_IDS, KELURAHAN_OPTIONS } from '../src/lib/constants.js';

test('contains the 45 official Yogyakarta kelurahan options used by the bot flow', () => {
  assert.equal(KELURAHAN_OPTIONS.length, 45);
  assert.equal(KELURAHAN_IDS.has('kotabaru'), true);
  assert.equal(KELURAHAN_IDS.has('terban'), true);
  assert.equal(KELURAHAN_IDS.has('muja-muju'), true);
});

test('keeps kelurahan ids unique', () => {
  assert.equal(KELURAHAN_IDS.size, KELURAHAN_OPTIONS.length);
});
