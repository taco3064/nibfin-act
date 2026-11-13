import assert from 'node:assert/strict';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { posix } from 'node:path';
import { builtinModules } from 'node:module';
import { actionMetadata } from './metadata.mjs';

const required = ['action.yml', 'core-source.json', 'src', 'docs', 'README.md'];
const builtins = new Set(builtinModules.map(name => name.replace(/^node:/, '')));

function safe(path) {
  assert(typeof path === 'string' && path && !path.includes('\\') &&
    !path.startsWith('/') && posix.normalize(path) === path &&
    !path.split('/').includes('..'), `Unsafe package path: ${path}`);
  return path;
}

export async function releaseTree() {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
  assert.equal(lock.name, pkg.name, 'Lock package name mismatch');
  assert.equal(lock.packages?.['']?.name, pkg.name, 'Lock root name mismatch');
  assert.equal(lock.lockfileVersion, 3, 'Unsupported lockfile');
  assert.deepEqual(lock.packages[''].engines, pkg.engines, 'Lock runtime mismatch');
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0,
    'Action must have no installed runtime dependencies');
  const metadata = actionMetadata(await readFile('action.yml', 'utf8'));
  assert(Array.isArray(pkg.files), 'Missing package inventory');
  for (const path of required) {
    assert(pkg.files.includes(path), `Required package declaration: ${path}`);
  }
  const files = new Set();
  async function collect(path) {
    safe(path);
    const stat = await lstat(path);
    assert(!stat.isSymbolicLink(), `Package links are unsupported: ${path}`);
    if (stat.isDirectory()) {
      const children = await readdir(path);
      assert(children.length, `Empty package directory: ${path}`);
      for (const child of children) await collect(`${path}/${child}`);
    } else {
      assert(stat.isFile() && stat.size > 0, `Empty or invalid file: ${path}`);
      files.add(path);
    }
  }
  for (const path of pkg.files) await collect(path);
  const visited = new Set();
  async function inspect(path) {
    safe(path);
    assert(files.has(path), `Runtime import is not packaged: ${path}`);
    if (visited.has(path)) return;
    visited.add(path);
    const text = await readFile(path, 'utf8');
    if (!/\.[mc]?js$/.test(path)) return;
    const imports = text.matchAll(
      /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g);
    for (const [, specifier] of imports) {
      if (specifier.startsWith('.')) {
        await inspect(posix.join(posix.dirname(path), specifier));
      } else {
        assert(builtins.has(specifier.replace(/^node:/, '')),
          `Unsupported runtime dependency: ${specifier}`);
      }
    }
    // The adapter reads this local JSON using a URL rather than an import.
    for (const [, specifier] of text.matchAll(
      /new URL\(['"]([^'"]+)['"],\s*import\.meta\.url\)/g)) {
      await inspect(posix.join(posix.dirname(path), specifier));
    }
  }
  await inspect(metadata.runs.main);
  const pin = JSON.parse(await readFile('core-source.json', 'utf8'));
  assert.equal(pin.repository, 'taco3064/nibfin-core');
  assert.match(pin.commit ?? '', /^[a-f0-9]{40}$/);
  for (const key of ['archiveHash', 'manifestHash']) {
    assert.match(pin[key] ?? '', /^[a-f0-9]{64}$/);
  }
  return { pkg, lock, entry: metadata.runs.main, runtime: metadata.runs.using };
}
