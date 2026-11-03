import { appendFile } from 'node:fs/promises';
import { forwardStage } from './forward.mjs';

// Deliberately unbound. Issue #1 forbids binding a candidate as a real release.
// Do not accept a module/command/socket/token override from inputs or the env.
// A reviewed producer integration must replace this boundary after Core release.
const result = await forwardStage(process.env.INPUT_REQUEST ?? '', null);
try {
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT,
      `status=${result.status}\ncode=${result.code}\n`, 'utf8');
  }
} catch {
  process.stderr.write('::error::ACTION_OUTPUT_UNAVAILABLE\n');
  process.exitCode = 1;
}
process.stdout.write(JSON.stringify(result) + '\n');
if (result.exitCode !== 0) process.stderr.write(`::error::${result.code}\n`);
process.exitCode = process.exitCode || result.exitCode;
