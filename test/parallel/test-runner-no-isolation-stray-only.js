'use strict';
require('../common');
const fixtures = require('../common/fixtures');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const fixture = fixtures.path('test-runner', 'stray-only', 'stray-only.test.js');

// Matches the substring of the warning emitted by test.js when a stray
// `.only` filters tests under --test-isolation=none without --test-only.
// See https://github.com/nodejs/node/issues/60917.
const kStrayOnlyWarning = /A test using 'only' was found while running with --test-isolation=none/;

test('warns about a stray .only under --test-isolation=none without --test-only', () => {
  const args = [
    '--test',
    '--test-reporter=tap',
    '--test-isolation=none',
    fixture,
  ];
  const child = spawnSync(process.execPath, args);
  const stdout = child.stdout.toString();
  const stderr = child.stderr.toString();

  assert.strictEqual(child.status, 0);
  assert.strictEqual(child.signal, null);

  // The diagnostic warning is emitted to stderr, not the TAP stream.
  assert.match(stderr, kStrayOnlyWarning);
  assert.doesNotMatch(stdout, kStrayOnlyWarning);

  // Behavior is unchanged: the `.only` test still filters out the normal test.
  assert.match(stdout, /ok 1 - only test/);
  assert.match(stdout, /# tests 1/);
  assert.match(stdout, /# pass 1/);
  assert.doesNotMatch(stdout, /normal test/);
});

test('does not warn when --test-only is passed under --test-isolation=none', () => {
  const args = [
    '--test',
    '--test-reporter=tap',
    '--test-isolation=none',
    '--test-only',
    fixture,
  ];
  const child = spawnSync(process.execPath, args);
  const stdout = child.stdout.toString();
  const stderr = child.stderr.toString();

  assert.strictEqual(child.status, 0);
  assert.strictEqual(child.signal, null);

  // No stray-only warning when --test-only is explicitly requested.
  assert.doesNotMatch(stderr, kStrayOnlyWarning);

  // Same filtering: only the `.only` test runs.
  assert.match(stdout, /ok 1 - only test/);
  assert.match(stdout, /# tests 1/);
  assert.match(stdout, /# pass 1/);
  assert.doesNotMatch(stdout, /normal test/);
});

test('emits the stray-only warning at most once with multiple .only tests', () => {
  const multipleOnlyFixture = fixtures.path(
    'test-runner', 'stray-only', 'multiple-only.test.js',
  );
  const args = [
    '--test',
    '--test-reporter=tap',
    '--test-isolation=none',
    multipleOnlyFixture,
  ];
  const child = spawnSync(process.execPath, args);
  const stderr = child.stderr.toString();

  const matches = stderr.match(new RegExp(kStrayOnlyWarning, 'g')) ?? [];
  assert.strictEqual(matches.length, 1);
});
