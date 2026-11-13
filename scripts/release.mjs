import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { releaseTree } from './release-tree.mjs';

// SemVer 2.0.0, including prerelease and build metadata; no implicit default.
const numeric = '(?:0|[1-9][0-9]*)';
const identifier = `(?:${numeric}|[0-9]*[A-Za-z-][0-9A-Za-z-]*)`;
const versionPattern = new RegExp(
  `^${numeric}\\.${numeric}\\.${numeric}` +
  `(?:-${identifier}(?:\\.${identifier})*)?` +
  '(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$');

function check(args) {
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0,
    `Release validation failed: ${args.join(' ')}\n` + result.stdout + result.stderr);
}

try {
  const [version, ...extra] = process.argv.slice(2);
  assert(extra.length === 0 && typeof version === 'string' &&
    versionPattern.test(version), 'Supply one explicit SemVer release version');
  check(['scripts/check.mjs']);
  const { pkg, lock, entry, runtime } = await releaseTree();
  // Reuse the maintained synthetic adapter/metadata contracts. No live Core stage.
  check(['--test', 'test/action.test.mjs', 'test/core-cli.test.mjs']);
  pkg.version = lock.version = lock.packages[''].version = version;
  await writeFile('package.json', JSON.stringify(pkg, null, 2) + '\n');
  await writeFile('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  process.stdout.write(JSON.stringify({
    status: 'tag-ready', version, entry, runtime,
  }) + '\n');
} catch (error) {
  process.stderr.write(`Release preparation failed: ${error.message}\n`);
  process.exitCode = 1;
}
