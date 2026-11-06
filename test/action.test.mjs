import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, open, rm } from 'node:fs/promises';
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

test('renaming either required input rejects otherwise valid metadata', async t => {
  const text = await readFile('action.yml', 'utf8');
  for (const [key, alias] of [['issue-number', 'issue'], ['stage', 'phase']]) {
    await t.test(key, () => {
      const renamed = text.replace(`  ${key}:`, `  ${alias}:`);
      assert.notEqual(renamed, text);
      assert.throws(() => actionMetadata(renamed), { code: 'ERR_ASSERTION' });
    });
  }
});

test('invalid entry inputs reject without credentials or executable overrides',
  async t => {
    const root = await mkdtemp(join(tmpdir(), 'nibfin-act-output-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const output = join(root, 'outputs');
    const sentinel = 'synthetic-private-sentinel';
    const stdoutPath = join(root, 'stdout');
    const stderrPath = join(root, 'stderr');
    // Regular files capture the real child output without socket-backed pipes.
    const stdout = await open(stdoutPath, 'w');
    const stderr = await open(stderrPath, 'w');
    let result;
    try {
      result = spawnSync(process.execPath, ['src/main.mjs'], {
        env: { ...process.env, GITHUB_OUTPUT: output,
          'INPUT_ISSUE-NUMBER': '', INPUT_STAGE: '',
          INPUT_REQUEST: sentinel, INPUT_CORE_PATH: sentinel,
          NIBFIN_ACTION_ADAPTER: sentinel, GITHUB_TOKEN: sentinel },
        stdio: ['ignore', stdout.fd, stderr.fd],
      });
    } finally {
      await Promise.all([stdout.close(), stderr.close()]);
    }
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status, 1);
    const out = await readFile(stdoutPath, 'utf8');
    const err = await readFile(stderrPath, 'utf8');
    assert.deepEqual(JSON.parse(out), {
      status: 'denied', code: 'INVALID_ACTION_INPUT', exitCode: 1,
    });
    assert.equal(err, '::error::INVALID_ACTION_INPUT\n');
    const outputs = await readFile(output, 'utf8');
    assert.equal((out + err + outputs).includes(sentinel), false);
    assert.equal(outputs,
      'status=denied\ncode=INVALID_ACTION_INPUT\nreceipt-hash=\n');
  });
