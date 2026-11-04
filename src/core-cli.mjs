import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';

// Fixed locations from the currently adopted Core backend, not workflow inputs.
// No executable, module, installation or Docker endpoint override is accepted.
export const coreDirectory = '/opt/nibfin/core';
// GitHub supplies this Action's Node 24 runtime; do not select a host-global Node.
const executable = process.execPath;
const entry = `${coreDirectory}/bin/nibfin-core.mjs`;
const pinPath = fileURLToPath(new URL('../core-source.json', import.meta.url));
const pin = JSON.parse(await readFile(pinPath, 'utf8'));
const stageExits = Object.freeze({ completed: 0, denied: 1, pending: 2 });
const nativeKeys = [
  'GITHUB_REPOSITORY',
  'GITHUB_RUN_ID',
  'GITHUB_RUN_ATTEMPT',
  'GITHUB_EVENT_NAME',
  'RUNNER_ENVIRONMENT',
  'ACTIONS_ID_TOKEN_REQUEST_URL',
  'ACTIONS_ID_TOKEN_REQUEST_TOKEN',
];

export function coreEnvironment(env, native = false) {
  const result = { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' };
  if (native)
    for (const key of nativeKeys) {
      if (typeof env[key] === 'string') result[key] = env[key];
    }
  return result;
}

async function command(args, env) {
  if (args[0] === 'stage') {
    // invokeStage reaches this import only after exact installed-source verification.
    const { command: coreCommand } = await import(
      pathToFileURL(`${coreDirectory}/src/public-api.mjs`)
    );
    const result = await coreCommand(executable, [entry, ...args], {
      cwd: coreDirectory,
      env,
      timeout: 55 * 60 * 1000,
      limit: 1024 * 1024,
      allowedExitCodes: Object.values(stageExits),
    });
    return {
      ...result,
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
      signal: null,
    };
  }
  return new Promise((resolve) => {
    execFile(
      executable,
      [entry, ...args],
      {
        cwd: coreDirectory,
        env,
        shell: false,
        timeout: 120000,
        maxBuffer: 1024 * 1024,
        encoding: 'utf8',
      },
      (error, stdout, stderr) =>
        resolve({
          stdout,
          stderr,
          exitCode: error ? error.code : 0,
          signal: error?.signal ?? null,
          unavailable: ['ENOENT', 'EACCES'].includes(error?.code),
        }),
    );
  });
}

function decode(process) {
  if (process.signal || !Number.isInteger(process.exitCode)) return null;
  try {
    // Core CLI writes successful results to stdout and denials to stderr.
    const text =
      process.exitCode === 0
        ? process.stdout
        : process.stdout.trim()
          ? process.stdout
          : process.stderr;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const failed = (status, code) => ({
  status,
  code,
  exitCode: stageExits[status],
});

// The injected runner is a private test seam. main.mjs always uses command.
// No request, environment variable or module loader can replace this function.
export async function invokeStage(issue, stage, env, run = command) {
  if (
    typeof issue !== 'string' ||
    !/^[1-9][0-9]*$/.test(issue) ||
    !Number.isSafeInteger(Number(issue)) ||
    typeof stage !== 'string' ||
    !/^[a-z][a-z-]{0,39}$/.test(stage)
  ) {
    return failed('denied', 'INVALID_ACTION_INPUT');
  }
  let verification;
  try {
    verification = await run(['verify', coreDirectory, pinPath], coreEnvironment(env));
  } catch {
    return failed('denied', 'CORE_VERIFICATION_UNAVAILABLE');
  }
  if (verification.unavailable) return failed('denied', 'CORE_EXECUTABLE_UNAVAILABLE');
  const verified = decode(verification);
  if (
    verification.exitCode !== 0 ||
    verified?.status !== 'verified' ||
    verified.source?.repository !== pin.repository ||
    verified.source?.commit !== pin.commit
  ) {
    return failed('denied', 'CORE_SOURCE_MISMATCH');
  }
  let execution;
  try {
    execution = await run(['stage', issue, stage], coreEnvironment(env, true));
  } catch {
    return failed('pending', 'CORE_EXECUTION_UNKNOWN');
  }
  const result = decode(execution);
  if (
    !result ||
    !Object.hasOwn(stageExits, result.status) ||
    execution.exitCode !== stageExits[result.status] ||
    (result.status === 'completed' &&
      (result.schemaVersion !== 1 ||
        result.stage !== stage ||
        !/^[a-f0-9]{64}$/.test(result.receiptHash ?? ''))) ||
    (result.code !== undefined &&
      (typeof result.code !== 'string' || !/^[A-Z][A-Z0-9_]{0,79}$/.test(result.code)))
  ) {
    return failed('pending', 'CORE_EXECUTION_UNKNOWN');
  }
  return {
    status: result.status,
    code: result.code ?? '',
    ...(result.status === 'completed' ? { receiptHash: result.receiptHash } : {}),
    exitCode: execution.exitCode,
  };
}
