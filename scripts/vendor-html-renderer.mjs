// Rebuild the checked-in browser port from the user's installed skill.
// This command is deliberately not part of npm install/build: releases need no
// global skill, Node service, network access, or remote executable code.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import ts from 'typescript';
import { build } from 'esbuild';

const file = process.argv[2];
if (!file)
  throw new Error('Pass the path to answer-me-with-html/scripts/am.mjs.');
const original = await readFile(file, 'utf8');
const sha256 = createHash('sha256').update(original).digest('hex');
const reviewedSha256 =
  '751888304373642db95bcbe356c1c64153f76883e170cab4a56953119e12ec6a';
if (sha256 !== reviewedSha256)
  throw new Error(
    'The upstream CLI differs from the reviewed source; review the adapter before updating its pin.',
  );
if (!original.includes('var VERSION = "0.5.0";'))
  throw new Error(
    'This adapter has been reviewed only for skill version 0.5.0.',
  );
const cut = (source, start, end, replacement = '') => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error('Upstream layout changed: ' + start);
  return source.slice(0, from) + replacement + source.slice(to);
};
let source = original.slice(
  original.indexOf('// src/assets.js'),
  original.indexOf('// src/video/script.js'),
);
// Reuse the extension's existing Marked dependency. Keep separate Marked
// instances, so the skill's hooks cannot change the ordinary summary renderer.
source = cut(source, '// node_modules/marked/', '// src/svg/text.js');
source = cut(
  source,
  '// src/components/sequence.js',
  '// src/components/index.js',
);
source = cut(source, '// src/images.js', '// src/render.js');
const ast = ts.createSourceFile(
  'renderer.js',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
);
const edits = [];
const removedFunctions = new Set([
  'readThemeFile',
  'readUserThemes',
  'loadThemes',
]);
for (const statement of ast.statements) {
  let replacement;
  if (ts.isImportDeclaration(statement)) replacement = '';
  if (ts.isFunctionDeclaration(statement)) {
    const name = statement.name?.text;
    if (removedFunctions.has(name)) replacement = '';
    if (name === 'embedImages')
      replacement = 'function embedImages(_block, html) { return html; }';
    if (name === 'codeBlock')
      replacement =
        'function codeBlock() { throw new Error("Code/file fences are disabled in the biliSum HTML adapter."); }';
  }
  if (ts.isVariableStatement(statement)) {
    const name = statement.declarationList.declarations[0]?.name.getText(ast);
    if (['RUNTIME_JS', 'RTL_JS', 'DELTA_JS'].includes(name))
      replacement = `var ${name} = "";`;
    if (name === 'ALL2')
      replacement =
        'var ALL2 = [callout_default, kv_default, tree_default, limits_default];';
    if (name === 'RAW_LANGS') replacement = 'var RAW_LANGS = new Set();';
  }
  if (replacement !== undefined)
    edits.push([statement.getStart(ast), statement.end, replacement]);
}
for (const [from, to, replacement] of edits.sort((a, b) => b[0] - a[0]))
  source = source.slice(0, from) + replacement + source.slice(to);
source =
  'import { Marked as F } from "marked";\n' +
  source +
  '\nexport { renderDoc };\n';
const result = await build({
  stdin: {
    contents: source,
    sourcefile: 'skill-browser-adapter.js',
    resolveDir: process.cwd(),
  },
  write: false,
  bundle: true,
  treeShaking: true,
  platform: 'browser',
  format: 'esm',
  target: 'chrome120',
  external: ['marked'],
  legalComments: 'inline',
  banner: {
    js: `// Generated browser port of Answer me with HTML 0.5.0 (MIT).\n// Copyright (c) 2026 Answer me with HTML contributors.\n// Upstream CLI SHA-256: ${sha256}\n// Rebuild: node scripts/vendor-html-renderer.mjs /path/to/skill/scripts/am.mjs\n// Node, CLI, filesystem, videos, inline scripts and file/code fences are disabled.\n// Only local page templates, themes, callout/kv/tree/limits components are retained.\n// License: THIRD_PARTY_NOTICES.md; changes: scripts/vendor-html-renderer.mjs.`,
  },
});
const output = result.outputFiles[0].text;
if (
  /\b(?:process|Buffer)\.|from ["']node:|\beval\s*\(|\bnew Function\s*\(/.test(
    output,
  )
)
  throw new Error('Unexpected Node or dynamic-code dependency remains.');
const target = resolve('src/vendor/answer-me-with-html/renderer.js');
await writeFile(target, output);
console.log(`Browser renderer: ${target} (${output.length} characters)`);
console.log('Pinned CLI SHA-256: ' + sha256);
