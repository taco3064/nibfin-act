import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'nibfin-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of ['package.json', 'package-lock.json', '.node-version',
    'action.yml', 'core-source.json', 'README.md', 'src', 'scripts', 'test',
    'docs', 'node_modules']) {
    await cp(path, join(root, path), { recursive: true });
  }
  return root;
}

function prepare(root, ...args) {
  return spawnSync(process.execPath, ['scripts/release.mjs', ...args], {
    cwd: root, encoding: 'utf8',
    env: { PATH: process.env.PATH, LANG: 'C.UTF-8' },
  });
}

async function mutate(root, path, transform) {
  const target = join(root, path);
  await writeFile(target, transform(await readFile(target, 'utf8')));
}

test('release emits JSON, updates only version metadata and never runs publishers',
  async t => {
    const root = await fixture(t);
    const bin = join(root, 'sentinels');
    await mkdir(bin);
    for (const name of ['git', 'gh', 'npm', 'nibfin-core']) {
      await writeFile(join(bin, name), '#!/bin/sh\nexit 93\n', { mode: 0o755 });
    }
    const before = await readFile(join(root, 'src/core-cli.mjs'), 'utf8');
    for (const version of ['1.2.3', '2.0.0-rc.1+build.5']) {
      const result = spawnSync(process.execPath,
        ['scripts/release.mjs', version], {
          cwd: root, encoding: 'utf8', env: { PATH: bin, LANG: 'C.UTF-8' },
        });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), {
        status: 'tag-ready', version, entry: 'src/main.mjs', runtime: 'node24',
      });
      const pkg = JSON.parse(await readFile(join(root, 'package.json')));
      const lock = JSON.parse(await readFile(join(root, 'package-lock.json')));
      assert.equal(pkg.version, version);
      assert.equal(lock.version, version);
      assert.equal(lock.packages[''].version, version);
    }
    assert.equal(await readFile(join(root, 'src/core-cli.mjs'), 'utf8'), before);
  });

test('invalid versions fail without readiness or metadata writes', async t => {
  const root = await fixture(t);
  const before = await readFile(join(root, 'package.json'), 'utf8');
  for (const args of [[], ['v1.2.3'], ['01.2.3'], ['1.2.3-01'],
    ['1.2'], ['1.2.3', 'extra'], ['1.2.3\n']]) {
    const result = prepare(root, ...args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
  }
  assert.equal(await readFile(join(root, 'package.json'), 'utf8'), before);
});

test('invalid trees and incompatible adapter contracts cannot report readiness',
  async t => {
    const cases = [
      root => rm(join(root, 'README.md')),
      root => rm(join(root, 'core-source.json')),
      root => rm(join(root, 'src/core-cli.mjs')),
      root => writeFile(join(root, 'src/main.mjs'), ''),
      root => mutate(root, 'action.yml', s => s.replace('node24', 'node20')),
      root => mutate(root, 'action.yml', s => s.replace('src/main.mjs', '../x')),
      root => mutate(root, 'package.json', s => s.replace('24.22.1', '24.0.0')),
      root => mutate(root, 'package.json', s => s.replace('"README.md"', '"x"')),
      root => mutate(root, 'src/main.mjs', s =>
        s + "\nimport './missing.mjs';\n"),
      root => mutate(root, 'src/core-cli.mjs', s =>
        s.replace("['stage', issue, stage]", "['stage', stage, issue]")),
      root => mutate(root, 'core-source.json', s => s.replace('archiveHash', 'x')),
    ];
    for (const [index, change] of cases.entries()) {
      await t.test(`invalid tree ${index}`, async t => {
        const root = await fixture(t);
        const before = await readFile(join(root, 'package-lock.json'), 'utf8');
        await change(root);
        const result = prepare(root, '1.2.3');
        assert.equal(result.status, 1, result.stderr);
        assert.equal(result.stdout, '');
        assert.equal(await readFile(join(root, 'package-lock.json'), 'utf8'), before);
      });
    }
  });
