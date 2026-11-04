import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

// This prepares a disposable GitHub-hosted CI VM, never a user's adopted host.
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted');
assert.equal(process.platform, 'linux');
const pin = JSON.parse(await readFile('core-source.json', 'utf8'));
const source = resolve(process.argv[2]);
const api = await import(pathToFileURL(join(source, 'src/public-api.mjs')));
const root = await mkdtemp(join(tmpdir(), 'nibfin-act-core-'));
try {
  const built = await api.packageSource(source, pin.commit);
  assert.equal(built.manifestHash, pin.manifestHash);
  assert.equal(built.sha256, pin.archiveHash);
  await api.installSource(built.bytes, join(root, 'core'), pin);
  const installed = await api.verifyInstalledSource(join(root, 'core'), pin);
  assert.equal(installed.commit, pin.commit);
  const cli = join(root, 'core/bin/nibfin-core.mjs');
  const contract = JSON.parse(execFileSync(process.execPath, [cli, 'contract']));
  assert.equal(contract.schemaVersion, 1);
  assert.equal(contract.eventAuthority, false);
  const victim = join(root, 'core/README.md');
  const original = await readFile(victim);
  await chmod(victim, 0o600);
  await writeFile(victim, 'changed source');
  await assert.rejects(api.verifyInstalledSource(join(root, 'core'), pin),
    { code: 'INSTALLED_SOURCE_CHANGED' });
  await writeFile(victim, original);
  await chmod(victim, 0o400);
  // Only this disposable VM receives a fixed-path installation. No host.json,
  // credentials, Runner registration or authority record is synthesized.
  execFileSync('sudo', ['mkdir', '/opt/nibfin']);
  execFileSync('sudo', ['cp', '-R', join(root, 'core'), '/opt/nibfin/core']);
  execFileSync('sudo', ['chmod', '-R', 'a+rX', '/opt/nibfin/core']);
  console.log(JSON.stringify({ status: 'verified', source: installed,
    contractVersion: contract.schemaVersion, tamperRejected: true }));
} finally {
  await chmod(root, 0o700);
  await rm(root, { recursive: true, force: true });
}
