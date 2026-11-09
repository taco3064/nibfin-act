import { appendFile } from 'node:fs/promises';
import { invokeStage } from './core-cli.mjs';

const result = await invokeStage(process.env['INPUT_ISSUE-NUMBER'],
  process.env.INPUT_STAGE, process.env);
try {
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT,
      `status=${result.status}\ncode=${result.code}\n` +
      `receipt-hash=${result.receiptHash ?? ''}\n`, 'utf8');
  }
} catch {
  process.stderr.write('::error::ACTION_OUTPUT_UNAVAILABLE\n');
  process.exitCode = 1;
}
process.stdout.write(JSON.stringify(result) + '\n');
if (result.exitCode !== 0) {
  const stage = result.terminalStage ? ` (stage: ${result.terminalStage})` : '';
  process.stderr.write(`::error::${result.code}${stage}\n`);
}
process.exitCode = process.exitCode || result.exitCode;
