'use strict';

require('../common');
const tmpdir = require('../common/tmpdir');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { describe, it } = require('node:test');
const fixtures = require('../common/fixtures');

const testFixtures = fixtures.path('test-runner');
const internalOrderFixture = fixtures.path('test-runner', 'randomize', 'internal-order.cjs');
const kShardFiles = ['a.cjs', 'b.cjs', 'c.cjs', 'd.cjs', 'e.cjs', 'f.cjs', 'g.cjs', 'h.cjs', 'i.cjs', 'j.cjs'];
const kInternalTests = ['a', 'b', 'c', 'd', 'e'];

tmpdir.refresh();
let rerunStateCounter = 0;
function freshRerunStateFile() {
  return tmpdir.resolve(`rerun-state-${rerunStateCounter++}.json`);
}

function getShardOrder(stdout) {
  return Array.from(stdout.matchAll(/ok \d+ - ([a-j]\.cjs) this should pass/g), ({ 1: name }) => name);
}

function getInternalExecutionOrder(stdout) {
  const match = stdout.match(/EXECUTION_ORDER:([a-e](?:,[a-e])*)/);
  assert(match, `Missing EXECUTION_ORDER marker in output: ${stdout}`);
  return match[1].split(',');
}

describe('test runner randomize flags via command line', () => {
  it('should be deterministic with --test-random-seed', () => {
    const args = [
      '--test',
      '--test-reporter=tap',
      '--test-concurrency=1',
      '--test-randomize',
      '--test-random-seed=12345',
      join(testFixtures, 'shards/*.cjs'),
    ];
    const first = spawnSync(process.execPath, args);
    const second = spawnSync(process.execPath, args);

    assert.strictEqual(first.stderr.toString(), '');
    assert.strictEqual(second.stderr.toString(), '');
    assert.strictEqual(first.status, 0);
    assert.strictEqual(second.status, 0);

    const firstOrder = getShardOrder(first.stdout.toString());
    const secondOrder = getShardOrder(second.stdout.toString());
    assert.deepStrictEqual(firstOrder, secondOrder);
    assert.deepStrictEqual([...firstOrder].sort(), kShardFiles);
  });

  it('should use different orders for different seeds', () => {
    const first = spawnSync(process.execPath, [
      '--test',
      '--test-reporter=tap',
      '--test-concurrency=1',
      '--test-randomize',
      '--test-random-seed=11111',
      join(testFixtures, 'shards/*.cjs'),
    ]);
    const second = spawnSync(process.execPath, [
      '--test',
      '--test-reporter=tap',
      '--test-concurrency=1',
      '--test-randomize',
      '--test-random-seed=22222',
      join(testFixtures, 'shards/*.cjs'),
    ]);

    assert.strictEqual(first.stderr.toString(), '');
    assert.strictEqual(second.stderr.toString(), '');
    assert.strictEqual(first.status, 0);
    assert.strictEqual(second.status, 0);

    const firstOrder = getShardOrder(first.stdout.toString());
    const secondOrder = getShardOrder(second.stdout.toString());
    assert.notDeepStrictEqual(firstOrder, secondOrder);
    assert.deepStrictEqual([...firstOrder].sort(), kShardFiles);
    assert.deepStrictEqual([...secondOrder].sort(), kShardFiles);
  });

  it('should randomize deterministically with --test-random-seed alone', () => {
    const args = [
      '--test',
      '--test-reporter=tap',
      '--test-concurrency=1',
      '--test-random-seed=24680',
      join(testFixtures, 'shards/*.cjs'),
    ];
    const first = spawnSync(process.execPath, args);
    const second = spawnSync(process.execPath, args);

    assert.strictEqual(first.stderr.toString(), '');
    assert.strictEqual(second.stderr.toString(), '');
    assert.strictEqual(first.status, 0);
    assert.strictEqual(second.status, 0);

    const firstOrder = getShardOrder(first.stdout.toString());
    const secondOrder = getShardOrder(second.stdout.toString());
    assert.deepStrictEqual(firstOrder, secondOrder);
    assert.deepStrictEqual([...firstOrder].sort(), kShardFiles);
    assert.match(first.stdout.toString(), /# Randomized test order seed: 24680/);
  });

  it('should print the randomization seed when --test-randomize is used', () => {
    const child = spawnSync(process.execPath, [
      '--test',
      '--test-reporter=tap',
      '--test-concurrency=1',
      '--test-randomize',
      join(testFixtures, 'shards/*.cjs'),
    ]);

    assert.strictEqual(child.stderr.toString(), '');
    assert.strictEqual(child.status, 0);
    assert.match(child.stdout.toString(), /# Randomized test order seed: \d+/);
  });

  it('should randomize internal test order deterministically with --test-random-seed', () => {
    const args = [
      '--test',
      '--test-reporter=tap',
      '--test-random-seed=12345',
      internalOrderFixture,
    ];
    const first = spawnSync(process.execPath, args);
    const second = spawnSync(process.execPath, args);

    assert.strictEqual(first.stderr.toString(), '');
    assert.strictEqual(second.stderr.toString(), '');
    assert.strictEqual(first.status, 0);
    assert.strictEqual(second.status, 0);

    const firstOrder = getInternalExecutionOrder(first.stdout.toString());
    const secondOrder = getInternalExecutionOrder(second.stdout.toString());
    assert.deepStrictEqual(firstOrder, secondOrder);
    assert.deepStrictEqual([...firstOrder].sort(), kInternalTests);
  });

  it('should randomize internal test order differently across seeds', () => {
    const orders = [];
    for (const seed of [11111, 22222, 33333, 44444]) {
      const child = spawnSync(process.execPath, [
        '--test',
        '--test-reporter=tap',
        `--test-random-seed=${seed}`,
        internalOrderFixture,
      ]);
      assert.strictEqual(child.stderr.toString(), '');
      assert.strictEqual(child.status, 0);

      const order = getInternalExecutionOrder(child.stdout.toString());
      assert.deepStrictEqual([...order].sort(), kInternalTests);
      orders.push(order.join(','));
    }

    assert.notStrictEqual(new Set(orders).size, 1);
  });

  it('should reject --test-randomize with --watch', () => {
    const child = spawnSync(process.execPath, [
      '--test',
      '--watch',
      '--test-randomize',
      join(testFixtures, 'shards/*.cjs'),
    ]);

    assert.strictEqual(child.stdout.toString(), '');
    assert.match(child.stderr.toString(), /The property 'options\.randomize' is not supported with watch mode\./);
    assert.strictEqual(child.status, 1);
    assert.strictEqual(child.signal, null);
  });

  it('should reject --test-random-seed with --watch', () => {
    const child = spawnSync(process.execPath, [
      '--test',
      '--watch',
      '--test-random-seed=12345',
      join(testFixtures, 'shards/*.cjs'),
    ]);

    assert.strictEqual(child.stdout.toString(), '');
    assert.match(child.stderr.toString(), /The property 'options\.randomSeed' is not supported with watch mode\./);
    assert.strictEqual(child.status, 1);
    assert.strictEqual(child.signal, null);
  });

  it('should allow --test-randomize with --test-rerun-failures', () => {
    const child = spawnSync(process.execPath, [
      '--test',
      '--test-reporter=tap',
      '--test-concurrency=1',
      '--test-randomize',
      '--test-rerun-failures',
      freshRerunStateFile(),
      join(testFixtures, 'shards/*.cjs'),
    ]);

    assert.strictEqual(child.stderr.toString(), '');
    assert.strictEqual(child.status, 0);
    assert.strictEqual(child.signal, null);
    assert.match(child.stdout.toString(), /# Randomized test order seed: \d+/);
  });

  it('should allow --test-random-seed with --test-rerun-failures', () => {
    const child = spawnSync(process.execPath, [
      '--test',
      '--test-reporter=tap',
      '--test-concurrency=1',
      '--test-random-seed=12345',
      '--test-rerun-failures',
      freshRerunStateFile(),
      join(testFixtures, 'shards/*.cjs'),
    ]);

    assert.strictEqual(child.stderr.toString(), '');
    assert.strictEqual(child.status, 0);
    assert.strictEqual(child.signal, null);
    assert.match(child.stdout.toString(), /# Randomized test order seed: 12345/);
  });

  it('should persist the seed and reproduce the order on a rerun', () => {
    const stateFile = freshRerunStateFile();
    const args = [
      '--test',
      '--test-reporter=tap',
      '--test-concurrency=1',
      '--test-randomize',
      '--test-rerun-failures',
      stateFile,
      join(testFixtures, 'shards/*.cjs'),
    ];

    // First run randomizes with a fresh seed and persists it.
    const first = spawnSync(process.execPath, args);
    assert.strictEqual(first.stderr.toString(), '');
    assert.strictEqual(first.status, 0);
    const firstOut = first.stdout.toString();
    const seedMatch = firstOut.match(/# Randomized test order seed: (\d+)/);
    assert(seedMatch, `Missing randomization seed diagnostic in output: ${firstOut}`);
    const firstOrder = getShardOrder(firstOut);
    assert.deepStrictEqual([...firstOrder].sort(), kShardFiles);

    // Rerun without an explicit seed: the persisted seed must reproduce order.
    const rerunArgs = [
      '--test',
      '--test-reporter=tap',
      '--test-concurrency=1',
      '--test-rerun-failures',
      stateFile,
      join(testFixtures, 'shards/*.cjs'),
    ];
    const second = spawnSync(process.execPath, rerunArgs);
    assert.strictEqual(second.stderr.toString(), '');
    assert.strictEqual(second.status, 0);
    const secondOut = second.stdout.toString();
    assert.match(secondOut, new RegExp(`# Randomized test order seed: ${seedMatch[1]}`));
    const secondOrder = getShardOrder(secondOut);
    assert.deepStrictEqual(secondOrder, firstOrder);
  });

  it('should give an explicit --test-random-seed precedence over the persisted seed', () => {
    const stateFile = freshRerunStateFile();
    // Seed the state file with a different persisted seed.
    const first = spawnSync(process.execPath, [
      '--test',
      '--test-reporter=tap',
      '--test-concurrency=1',
      '--test-random-seed=11111',
      '--test-rerun-failures',
      stateFile,
      join(testFixtures, 'shards/*.cjs'),
    ]);
    assert.strictEqual(first.status, 0);

    const second = spawnSync(process.execPath, [
      '--test',
      '--test-reporter=tap',
      '--test-concurrency=1',
      '--test-random-seed=22222',
      '--test-rerun-failures',
      stateFile,
      join(testFixtures, 'shards/*.cjs'),
    ]);
    assert.strictEqual(second.stderr.toString(), '');
    assert.strictEqual(second.status, 0);
    assert.match(second.stdout.toString(), /# Randomized test order seed: 22222/);
  });

  it('should start fresh with a legacy bare-array rerun state file', () => {
    const stateFile = freshRerunStateFile();
    // Simulate an older Node.js version that wrote a bare array.
    writeFileSync(stateFile, JSON.stringify([{}]), 'utf8');

    const child = spawnSync(process.execPath, [
      '--test',
      '--test-concurrency=1',
      '--test-rerun-failures',
      stateFile,
      join(testFixtures, 'shards/*.cjs'),
    ]);

    // The legacy file is detected and the run degrades gracefully instead of
    // crashing with a raw TypeError.
    assert.strictEqual(child.signal, null);
    assert.doesNotMatch(child.stderr.toString(), /TypeError/);
    assert.match(child.stdout.toString(), /is not a valid rerun file/);
  });

  it('should reject out of range --test-random-seed values', () => {
    const child = spawnSync(process.execPath, [
      '--test',
      '--test-random-seed=4294967296',
      join(testFixtures, 'shards/*.cjs'),
    ]);

    assert.strictEqual(child.stdout.toString(), '');
    assert.match(child.stderr.toString(), /The value of "--test-random-seed" is out of range\. It must be >= 0 && <= 4294967295\. Received 4294967296/);
    assert.strictEqual(child.status, 1);
    assert.strictEqual(child.signal, null);
  });
});
