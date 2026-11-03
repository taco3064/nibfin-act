import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { actionMetadata } from '../scripts/metadata.mjs';

test('declared Node Action entrypoint exists without runtime dependencies', async () => {
  const metadata = actionMetadata(await readFile('action.yml', 'utf8'));
  assert((await readFile(metadata.runs.main, 'utf8')).length > 0);
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
});

test('malformed metadata, changed runtime and unsafe entrypoints reject', async () => {
  const text = await readFile('action.yml', 'utf8');
  for (const invalid of ['', 'name: [', text + '\nname: Duplicate\n',
    text.replace('name: Nibfin Action', 'name: '),
    text.replace('using: node24', 'using: docker'),
    text.replace('main: src/main.mjs', 'main: ../private.mjs'),
    text.replace('required: true', 'required: false')]) {
    assert.throws(() => actionMetadata(invalid));
  }
});

test('unreleased entry denies without leaking credentials or accepting overrides',
  async t => {
    const root = await mkdtemp(join(tmpdir(), 'nibfin-act-output-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const output = join(root, 'outputs');
    const sentinel = 'synthetic-private-sentinel';
    const result = spawnSync(process.execPath, ['src/main.mjs'], {
      env: { ...process.env, GITHUB_OUTPUT: output,
        INPUT_REQUEST: sentinel, INPUT_CORE_PATH: sentinel,
        NIBFIN_ACTION_ADAPTER: sentinel, GITHUB_TOKEN: sentinel },
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    const message = JSON.parse(result.stdout);
    assert.equal(message.status, 'denied');
    assert.equal(message.code, 'CORE_RELEASE_UNAVAILABLE');
    assert.equal((result.stdout + result.stderr).includes(sentinel), false);
    assert.equal(await readFile(output, 'utf8'),
      'status=denied\ncode=CORE_RELEASE_UNAVAILABLE\n');
  });
