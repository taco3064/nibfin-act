import test from 'node:test';
import assert from 'node:assert/strict';
import { forwardStage } from '../src/forward.mjs';

function fixture(result) {
  const calls = [];
  const executor = { run: async value => { calls.push(value); return result; } };
  return { calls, executor,
    runStageInput: (input, target) => {
      assert.equal(target, executor);
      return target.run(input);
    } };
}

test('forwards the exact request once and preserves Core status', async () => {
  for (const [status, exitCode] of [['completed', 0], ['denied', 1], ['pending', 2]]) {
    const core = fixture({ schemaVersion: 1, status });
    const request = '{"schemaVersion":1,"stage":"shape"}';
    assert.deepEqual(await forwardStage(request, core), { status, code: '', exitCode });
    assert.deepEqual(core.calls, [request]);
  }
});

test('repo, fork, permission and backend denials stay in Core', async () => {
  for (const code of ['WRONG_REPOSITORY', 'UNTRUSTED_CALLER', 'MEMBER_REVOKED',
    'UNVERIFIED_EXECUTION_BACKEND', 'INVALID_STAGE_REQUEST']) {
    const core = fixture({ schemaVersion: 1, status: 'denied', code });
    const request = '{"stage":"merge","authorized":true}';
    const result = await forwardStage(request, core);
    assert.equal(result.status, 'denied');
    assert.equal(result.code, code);
    assert.equal(core.calls.length, 1);
  }
});

test('exceptions and malformed outcomes cannot succeed or retry', async () => {
  const failures = [null, {}, { status: 'completed' },
    { schemaVersion: 1, status: 'success' },
    { schemaVersion: 1, status: 'denied', code: 'secret\n::notice::injection' }];
  for (const value of failures) {
    const core = fixture(value);
    assert.equal((await forwardStage('{}', core)).status, 'pending');
    assert.equal(core.calls.length, 1);
  }
  let calls = 0;
  const core = { executor: { run() {} }, runStageInput() {
    calls++; throw Error('sensitive native error');
  } };
  const result = await forwardStage('{}', core);
  assert.equal(calls, 1);
  assert.deepEqual(result, { status: 'pending', code: 'CORE_RESULT_UNKNOWN',
    exitCode: 2 });
});

test('missing producer, input or interface cannot invoke an alternative', async () => {
  assert.equal((await forwardStage('{}', null)).code, 'CORE_RELEASE_UNAVAILABLE');
  assert.equal((await forwardStage({}, fixture({}))).code, 'INVALID_ACTION_INPUT');
  assert.equal((await forwardStage('{}', {})).code, 'CORE_INTERFACE_UNAVAILABLE');
});
