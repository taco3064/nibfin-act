import assert from 'node:assert/strict';
import { parseDocument } from 'yaml';

// Repository artifact validation, not authorization or a new Core protocol.
export function actionMetadata(text) {
  const document = parseDocument(text, { uniqueKeys: true, strict: true });
  assert.equal(document.errors.length, 0, 'Invalid Action YAML');
  const value = document.toJS({ maxAliasCount: 0 });
  assert(value && typeof value === 'object', 'Missing Action metadata');
  for (const key of ['name', 'description']) {
    assert(typeof value[key] === 'string' && value[key].trim(), `Missing ${key}`);
  }
  assert.equal(value.runs?.using, 'node24', 'Use the declared JS Action runtime');
  assert.equal(value.runs?.main, 'src/main.mjs', 'Unexpected Action entrypoint');
  assert.deepEqual(Object.keys(value.inputs ?? {}), ['issue-number', 'stage']);
  for (const name of ['issue-number', 'stage']) {
    assert.equal(value.inputs[name].required, true, 'Missing required input');
    assert.equal(typeof value.inputs[name].description, 'string');
  }
  for (const key of ['status', 'code', 'receipt-hash']) {
    assert(typeof value.outputs?.[key]?.description === 'string',
      `Missing output description: ${key}`);
  }
  return value;
}
