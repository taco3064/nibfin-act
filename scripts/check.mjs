import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const pinned = (await readFile('.node-version', 'utf8')).trim();
assert.equal(process.versions.node, pinned, 'Use the pinned Node runtime');
assert.equal(pkg.engines.node, pinned, 'Runtime pins must agree');
assert.equal(pkg.packageManager, `npm@${pkg.engines.npm}`);
assert.equal(pkg.private, true, 'This project is distributed as a GitHub Action');

async function inspect(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
  let count = 0;
  for (const entry of entries) {
    assert(!entry.isSymbolicLink(), 'Source links are not supported');
    const path = join(directory, entry.name);
    if (entry.isDirectory()) count += await inspect(path);
    else if (/\.(?:mjs|cjs|js)$/.test(path)) {
      const lines = (await readFile(path, 'utf8')).trimEnd().split(/\r?\n/);
      assert(lines.length <= 1000, `Source file too large: ${path}`);
      assert(lines.every(line => line.length <= 90), `Source line too long: ${path}`);
      const checked = spawnSync(process.execPath, ['--check', path]);
      assert.equal(checked.status, 0, `Invalid JavaScript: ${path}`);
      count++;
    }
  }
  return count;
}
let count = 0;
for (const directory of ['scripts', 'src', 'test']) count += await inspect(directory);
assert(count > 0, 'Missing source modules');
console.log(`Checked ${count} modules and pinned project configuration.`);
