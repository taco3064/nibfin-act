import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { invokeStage, coreEnvironment, coreDirectory } from '../src/core-cli.mjs';

const pin = JSON.parse(await readFile(new URL('../core-source.json', import.meta.url)));
const verified = { status: 'verified', source: pin };
const processResult = (value, exitCode = 0) => ({
  stdout: JSON.stringify(value), stderr: '', exitCode, signal: null,
});
function runner(result, exitCode = 0) {
  const calls = [];
  return { calls, run: async (args, env) => {
    calls.push({ args, env });
    return args[0] === 'verify' ? processResult(verified) :
      processResult(result, exitCode);
  } };
}

test('verified candidate invokes Core once with native context', async () => {
  const receiptHash = 'a'.repeat(64);
  const f = runner({ schemaVersion: 1, stage: 'shape', status: 'completed',
    code: 'STAGE_COMPLETED', receiptHash });
  const env = { GITHUB_RUN_ID: '12', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'oidc',
    GITHUB_TOKEN: 'admin-secret', NODE_OPTIONS: '--import=evil',
    CODEX_HOME: '/private', INPUT_CORE_PATH: '/evil' };
  const result = await invokeStage('42', 'shape', env, f.run);
  assert.equal(result.status, 'completed');
  assert.equal(result.receiptHash, receiptHash);
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls[0].args.slice(0, 2), ['verify', coreDirectory]);
  assert.deepEqual(f.calls[1].args, ['stage', '42', 'shape']);
  assert.equal(f.calls[0].env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, undefined);
  assert.equal(f.calls[1].env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, 'oidc');
  for (const key of ['GITHUB_TOKEN', 'NODE_OPTIONS', 'CODEX_HOME', 'INPUT_CORE_PATH']) {
    assert.equal(f.calls[1].env[key], undefined);
  }
});

test('Core permission, caller and unsupported-backend denials stay denied', async () => {
  for (const code of ['UNSUPPORTED_STAGE_HOST', 'UNTRUSTED_ACTIONS_RUN',
    'HOST_APPROVAL_MISMATCH', 'INVALID_STAGE_REQUEST']) {
    const f = runner({ status: 'denied', code }, 1);
    assert.equal((await invokeStage('42', 'shape', {}, f.run)).code, code);
    assert.equal(f.calls.length, 2);
  }
  const f = runner({ status: 'pending', code: 'HOST_EXECUTION_UNRESOLVED' }, 2);
  assert.equal((await invokeStage('42', 'shape', {}, f.run)).status, 'pending');
});

test('wrong source, missing installation and invalid input never start a stage',
  async () => {
  for (const response of [processResult({ ...verified, source: { commit: 'wrong' } }),
    { unavailable: true }, { stdout: 'garbage', exitCode: 0 }]) {
    let calls = 0;
    const result = await invokeStage('42', 'shape', {}, async () => {
      calls++; return response;
    });
    assert.equal(result.status, 'denied');
    assert.equal(calls, 1);
  }
  for (const [issue, stage] of [['../42', 'shape'], ['42', '--config'],
    ['9007199254740992', 'shape'], [undefined, 'shape']]) {
    const f = runner({});
    assert.equal((await invokeStage(issue, stage, {}, f.run)).code,
      'INVALID_ACTION_INPUT');
    assert.equal(f.calls.length, 0);
  }
  });

test('unknown execution, missing receipt and exit/result mismatch cannot succeed',
  async () => {
    for (const [result, exit] of [[{ status: 'completed' }, 0],
      [{ status: 'denied', code: 'SECRET\nINJECT' }, 1],
      [{ status: 'denied', code: 'DENIED' }, 0], [{ status: 'unknown' }, 0]]) {
      const f = runner(result, exit);
      assert.equal((await invokeStage('42', 'shape', {}, f.run)).status, 'pending');
      assert.equal(f.calls.length, 2);
    }
    let calls = 0;
    const run = async () => {
      if (++calls === 1) return processResult(verified);
      throw Error('private transport failure');
    };
    assert.equal((await invokeStage('42', 'shape', {}, run)).code,
      'CORE_EXECUTION_UNKNOWN');
    assert.equal(calls, 2);
  });

test('verification uses no caller-controlled environment settings', () => {
  assert.deepEqual(coreEnvironment({ PATH: '/evil', HOME: '/private' }),
    { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' });
});
