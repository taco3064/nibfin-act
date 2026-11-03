import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

test('a fresh checkout verifies with the pinned runtime', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(process.versions.node, pkg.engines.node);
  const check = spawnSync(process.execPath, ['scripts/check.mjs']);
  assert.equal(check.status, 0, check.stderr.toString());
});
