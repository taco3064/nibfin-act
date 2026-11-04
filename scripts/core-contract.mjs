import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { invokeStage, coreDirectory } from '../src/core-cli.mjs';

// CI-only contract tests. Provider, caller, isolation and Agent are synthetic.
// Production main.mjs cannot select this fixture or replace its fixed CLI.
const source = resolve('.core-fixture');
const { nativeFixture } = await import(pathToFileURL(
  `${source}/test/native-observer-fixture.mjs`));
const { nativeStageExecutor, runStageInput } = await import(pathToFileURL(
  `${coreDirectory}/src/public-api.mjs`));

async function fixture(t, mutate = () => {}) {
  const f = await nativeFixture(t);
  let executions = 0;
  const agent = { run: async (_stage, context) => {
    executions++;
    const lastMessage = JSON.stringify({ outcome: 'ready', body: f.context.shape.body,
      summary: 'Synthetic contract execution', rootCause: '', failureClass: 'none',
      evidenceReferences: ['fixture:action-contract'], blockingFindings: [],
      contractConflicts: [] });
    const events = [
      { type: 'thread.started', thread_id: context.execution.sessionId },
      { type: 'turn.started' },
      { type: 'item.completed', item: { type: 'agent_message', text: lastMessage } },
      { type: 'turn.completed' },
    ];
    return { executionId: context.execution.id, terminationHash: 'a'.repeat(64),
      lastMessage, stdout: events.map(JSON.stringify).join('\n') };
  } };
  mutate(f, agent);
  const unexpected = async () => { throw Error('Unexpected fixture write/hook'); };
  const executor = nativeStageExecutor({ ...f.adapters, agent,
    token: 'synthetic-contract-token', workspace: { push: unexpected },
    sandbox: { execute: unexpected } });
  const calls = [];
  const run = async (args, env) => {
    calls.push(args[0]);
    if (args[0] === 'verify') {
      return { exitCode: 0, signal: null, stderr: '',
        stdout: execFileSync('/usr/bin/node',
          [`${coreDirectory}/bin/nibfin-core.mjs`, ...args],
          { env, encoding: 'utf8' }) };
    }
    assert.deepEqual(args, ['stage', '2', 'shape']);
    const result = await runStageInput(
      JSON.stringify({ schemaVersion: 1, stage: args[2] }), executor);
    return { stdout: JSON.stringify(result), stderr: '', signal: null,
      exitCode: { completed: 0, denied: 1, pending: 2 }[result.status] };
  };
  return { run, calls, executions: () => executions };
}

test('installed Core completes a permitted synthetic Shape and Action keeps its receipt',
  async t => {
    const f = await fixture(t);
    const result = await invokeStage('2', 'shape', {}, f.run);
    assert.equal(result.status, 'completed');
    assert.equal(result.code, 'STAGE_COMPLETED');
    assert.equal(result.exitCode, 0);
    assert.match(result.receiptHash, /^[a-f0-9]{64}$/);
    assert.equal(f.executions(), 1);
    assert.deepEqual(f.calls, ['verify', 'stage']);
  });

test('Core rejects Scope, permission, repository, fork and caller changes',
  async t => {
    const cases = [
      f => { f.issue.body = 'Unapproved changed Scope'; },
      f => { f.data['/collaborators/reviewer/permission'].permission = 'read'; },
      f => { f.runner.run.head_repository.id = 99; },
      f => { f.runner.run.event = 'pull_request'; },
      f => { f.runner.run.head_sha = 'b'.repeat(40); },
    ];
    for (const mutate of cases) {
      const f = await fixture(t, mutate);
      const result = await invokeStage('2', 'shape', {}, f.run);
      assert.equal(result.status, 'denied');
      assert.equal(result.exitCode, 1);
      assert.equal(result.receiptHash, undefined);
      assert.equal(f.executions(), 0);
      assert.deepEqual(f.calls, ['verify', 'stage']);
    }
  });

test('unknown Core execution stays Pending and the adapter does not retry', async t => {
  let executions = 0;
  const f = await fixture(t, (_f, agent) => {
    agent.run = async () => { executions++; throw Error('Unknown synthetic result'); };
  });
  const result = await invokeStage('2', 'shape', {}, f.run);
  assert.equal(result.status, 'pending');
  assert.equal(result.exitCode, 2);
  assert.equal(result.receiptHash, undefined);
  assert.equal(executions, 1);
  assert.deepEqual(f.calls, ['verify', 'stage']);
});
