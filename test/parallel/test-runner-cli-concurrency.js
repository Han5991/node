'use strict';
require('../common');
const fixtures = require('../common/fixtures');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const cwd = fixtures.path('test-runner', 'default-behavior');
const env = { ...process.env, 'NODE_DEBUG': 'test_runner' };

test('default concurrency', async () => {
  const args = ['--test'];
  const cp = spawnSync(process.execPath, args, { cwd, env });
  assert.match(cp.stderr.toString(), /concurrency: true,/);
});

test('concurrency of one', async () => {
  const args = ['--test', '--test-concurrency=1'];
  const cp = spawnSync(process.execPath, args, { cwd, env });
  assert.match(cp.stderr.toString(), /concurrency: 1,/);
});

test('concurrency of two', async () => {
  const args = ['--test', '--test-concurrency=2'];
  const cp = spawnSync(process.execPath, args, { cwd, env });
  assert.match(cp.stderr.toString(), /concurrency: 2,/);
});

test('isolation=none uses a concurrency of one', async () => {
  const args = ['--test', '--test-isolation=none'];
  const cp = spawnSync(process.execPath, args, { cwd, env });
  assert.match(cp.stderr.toString(), /concurrency: 1,/);
});

test('isolation=none overrides --test-concurrency', async () => {
  const args = [
    '--test', '--test-isolation=none', '--test-concurrency=2',
  ];
  const cp = spawnSync(process.execPath, args, { cwd, env });
  assert.match(cp.stderr.toString(), /concurrency: 1,/);
});

const kConcurrencyIgnoredWarning =
  '--test-concurrency is ignored when --test-isolation=none is set. ' +
  'See https://github.com/nodejs/node/issues/55939';

test('isolation=none warns when --test-concurrency is explicitly set', async () => {
  const args = [
    '--test', '--test-isolation=none', '--test-concurrency=4',
  ];
  const cp = spawnSync(process.execPath, args, { cwd, env });
  assert(
    cp.stderr.toString().includes(kConcurrencyIgnoredWarning),
    `expected warning not found in stderr:\n${cp.stderr}`,
  );
});

test('isolation=none does not warn without --test-concurrency', async () => {
  const args = ['--test', '--test-isolation=none'];
  const cp = spawnSync(process.execPath, args, { cwd, env });
  assert(
    !cp.stderr.toString().includes(kConcurrencyIgnoredWarning),
    `unexpected warning found in stderr:\n${cp.stderr}`,
  );
});

test('isolation=none does not warn with --test-concurrency=1', async () => {
  const args = [
    '--test', '--test-isolation=none', '--test-concurrency=1',
  ];
  const cp = spawnSync(process.execPath, args, { cwd, env });
  assert(
    !cp.stderr.toString().includes(kConcurrencyIgnoredWarning),
    `unexpected warning found in stderr:\n${cp.stderr}`,
  );
});
