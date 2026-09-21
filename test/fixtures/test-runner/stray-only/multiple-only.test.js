'use strict';
const { test } = require('node:test');

// Multiple stray `.only` tests, to verify the stray-only warning is emitted at
// most once. See https://github.com/nodejs/node/issues/60917.
test('only test a', { only: true }, () => {});

test('only test b', { only: true }, () => {});

test('normal test', () => {});
