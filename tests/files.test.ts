import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeFilename } from '../src/lib/files';

test('download names handle Windows device names, invalid characters and truncation boundaries', () => {
  assert.equal(safeFilename('CON'), '_CON');
  assert.equal(safeFilename('nul.txt'), '_nul.txt');
  assert.equal(safeFilename('a/b:c?'), 'a_b_c_');
  assert.equal(safeFilename('x'.repeat(89) + '. trailing'), 'x'.repeat(89));
  assert.equal(safeFilename('... '), 'biliSum');
});
