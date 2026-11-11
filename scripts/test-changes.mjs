import { appendFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const globalInputs = /^(?:package(?:-lock)?\.json|\.node-version|\.npmrc)$/;
const controls = /^(?:\.github\/workflows\/ci\.yml|scripts\/test-changes\.mjs)$/;
const integration = /^(?:src\/|action\.yml$|core-source\.json$|scripts\/core-)/;
const suites = {
  'test/action.test.mjs': /^(?:src\/|action\.yml$|scripts\/metadata\.mjs$)/,
  'test/core-cli.test.mjs': /^(?:src\/core-cli\.mjs$|core-source\.json$)/,
  'test/project.test.mjs': /^(?:scripts\/check\.mjs$|action\.yml$)/,
};

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'Git diff unavailable');
  return result.stdout;
}

const suffix = ['--name-only', '--no-renames', '-z', '--'];
let diff = ['diff', '--cached', ...suffix];
if (process.env.GITHUB_EVENT_PATH) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  let base = event.pull_request?.base?.sha ?? event.before;
  if (base === '0'.repeat(40)) base = git(['merge-base', 'origin/main', 'HEAD']).trim();
  if (!/^[a-f0-9]{40}$/.test(base ?? '')) throw new Error('CI diff base unavailable');
  diff = ['diff', base, 'HEAD', ...suffix];
}
const changed = git(diff).split('\0').filter(Boolean);
const all = changed.some(path => globalInputs.test(path) || controls.test(path));
if (process.argv.includes('--integration')) {
  const line = `integration=${all || changed.some(path => integration.test(path))}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, line);
  else process.stdout.write(line);
} else {
  const selected = Object.entries(suites)
    .filter(([test, inputs]) =>
      all || changed.some(path => path === test || inputs.test(path)))
    .map(([test]) => test);
  console.log(`Selected ${selected.length} tests for ${changed.length} changed paths.`);
  if (selected.length) {
    const result = spawnSync(process.execPath, ['--test', ...selected], {
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
}
