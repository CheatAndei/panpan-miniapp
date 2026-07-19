const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.join(__dirname, '..', 'utils', 'api.js'), 'utf8');

test('exam documents use the configured request domain instead of downloadFile', () => {
  assert.match(api, /function downloadAndOpenDocumentByRequest/);
  assert.match(api, /responseType:\s*'arraybuffer'/);
  assert.match(api, /panpan-document-/);
  assert.match(api, /export function openRemoteDocument[\s\S]*downloadAndOpenDocumentByRequest/);
});
