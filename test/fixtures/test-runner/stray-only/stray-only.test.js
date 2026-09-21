'use strict';
const { test } = require('node:test');

// A stray `.only` test alongside a normal test. Under --test-isolation=none
// the `.only` is honored even without --test-only, silently filtering out the
// normal test. See https://github.com/nodejs/node/issues/60917.
test('only test', { only: true }, () => {});

test('normal test', () => {});
