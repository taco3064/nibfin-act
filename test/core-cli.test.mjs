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
  assert.deepEqual(await invokeStage('42', 'shape', {}, f.run), {
    status: 'pending', code: 'HOST_EXECUTION_UNRESOLVED', exitCode: 2,
  });
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls[0].args.slice(0, 2), ['verify', coreDirectory]);
  assert.deepEqual(f.calls[1].args, ['stage', '42', 'shape']);
});

test('continue exposes only a bounded terminal stage from Core', async () => {
  const result = { schemaVersion: 1, stage: 'continue', status: 'denied',
    code: 'STAGE_REQUIRES_CORRECTION', terminalStage: 'deliver' };
  const valid = runner(result, 1);
  assert.equal((await invokeStage('42', 'continue', {}, valid.run)).terminalStage,
    'deliver');
  const invalid = runner({ ...result, terminalStage: 'shape\n::error::forged' }, 1);
  assert.equal((await invokeStage('42', 'continue', {}, invalid.run)).terminalStage,
    undefined);
});

test('source verification failures return exact diagnostics without starting a stage',
  async t => {
    const sentinel = 'synthetic-private-verification-sentinel';
    const cases = [
      ['stale commit', processResult({ ...verified,
        source: { ...pin, commit: '0'.repeat(40) } }), 'CORE_SOURCE_MISMATCH'],
      ['wrong repository', processResult({ ...verified,
        source: { ...pin, repository: 'other/repository' } }), 'CORE_SOURCE_MISMATCH'],
      ['missing executable', { unavailable: true }, 'CORE_EXECUTABLE_UNAVAILABLE'],
      ['malformed output', { stdout: sentinel, stderr: sentinel, exitCode: 0 },
        'CORE_SOURCE_MISMATCH'],
      ['verification transport', () => { throw Error(sentinel); },
        'CORE_VERIFICATION_UNAVAILABLE'],
    ];
    for (const [name, response, code] of cases) {
      await t.test(name, async () => {
        const calls = [];
        const result = await invokeStage('42', 'shape', {}, async args => {
          calls.push(args);
          return typeof response === 'function' ? response() : response;
        });
        assert.deepEqual(result, { status: 'denied', code, exitCode: 1 });
        assert.equal(calls.length, 1);
        assert.deepEqual(calls[0].slice(0, 2), ['verify', coreDirectory]);
        assert.equal(JSON.stringify(result).includes(sentinel), false);
      });
    }
  });

test('invalid input never verifies or starts a stage', async () => {
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
  });

test('stderr-only provider denial preserves bounded fields without retrying',
  async () => {
  const sentinel = 'synthetic-private-provider-sentinel';
  const calls = [];
  const result = await invokeStage('42', 'shape', {}, async args => {
    calls.push(args);
    if (args[0] === 'verify') return processResult(verified);
    return { stdout: '', stderr: JSON.stringify({ schemaVersion: 1,
      stage: 'shape', status: 'denied', code: 'HOST_APPROVAL_MISMATCH',
      receiptHash: 'a'.repeat(64), rawOutput: sentinel, exception: sentinel }),
    exitCode: 1, signal: null };
  });
  assert.deepEqual(result, {
    status: 'denied', code: 'HOST_APPROVAL_MISMATCH', exitCode: 1,
  });
  assert.equal(JSON.stringify(result).includes(sentinel), false);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].slice(0, 2), ['verify', coreDirectory]);
  assert.deepEqual(calls[1], ['stage', '42', 'shape']);
});

test('stage failures suppress raw output and exceptions without retrying', async t => {
  const sentinel = 'synthetic-private-stage-sentinel';
  const cases = [
    ['structured denial with private stdout fields and raw stderr', {
      ...processResult({ status: 'denied', code: 'UNTRUSTED_ACTIONS_RUN',
        rawOutput: sentinel, exception: sentinel, receiptHash: sentinel }, 1),
      stderr: sentinel,
    }, { status: 'denied', code: 'UNTRUSTED_ACTIONS_RUN', exitCode: 1 }],
    ['malformed stdout and stderr', {
      stdout: sentinel, stderr: sentinel, exitCode: 1, signal: null,
    }],
    ['malformed stderr-only result', {
      stdout: '', stderr: sentinel, exitCode: 1, signal: null,
    }],
    ['unsafe structured diagnostic', processResult({ status: 'denied',
      code: `DENIED\n${sentinel}`, rawOutput: sentinel }, 1)],
    ['thrown transport', () => { throw Error(sentinel); }],
  ];
  for (const [name, response, expected] of cases) {
    await t.test(name, async () => {
      const calls = [];
      const result = await invokeStage('42', 'shape', {}, async args => {
        calls.push(args);
        if (args[0] === 'verify') return processResult(verified);
        return typeof response === 'function' ? response() : response;
      });
      assert.deepEqual(result, expected ?? {
        status: 'pending', code: 'CORE_EXECUTION_UNKNOWN', exitCode: 2,
      });
      assert.equal(JSON.stringify(result).includes(sentinel), false);
      assert.equal(calls.length, 2);
      assert.deepEqual(calls[0].slice(0, 2), ['verify', coreDirectory]);
      assert.deepEqual(calls[1], ['stage', '42', 'shape']);
    });
  }
});

test('verification uses no caller-controlled environment settings', () => {
  assert.deepEqual(coreEnvironment({ PATH: '/evil', HOME: '/private' }),
    { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' });
});
