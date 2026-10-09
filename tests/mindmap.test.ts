import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  layoutMindMap,
  mindMapStats,
  mindMapMarkdown,
  searchMindMap,
  parseMindMap,
  renderMindMapSvg,
  validateMindMap,
} from '../src/lib/mindmap';

test('model JSON parser accepts fences and quoted braces without losing structure', () => {
  const tree = parseMindMap(
    '```json\n{"title":"括号 { 示例 }","children":[{"title":"叶子"}]}\n```',
  );
  assert.equal(tree.title, '括号 { 示例 }');
  assert.deepEqual(tree.children[0]?.children, []);
  assert.equal(
    parseMindMap('导图：{"title":"root","children":[]}').title,
    'root',
  );
});

test('map validation rejects cycles, excessive size and malformed nodes', () => {
  const cycle: any = { title: 'cycle', children: [] };
  cycle.children.push(cycle);
  assert.throws(() => validateMindMap(cycle), /循环/);
  assert.throws(
    () =>
      validateMindMap({
        title: 'root',
        children: Array.from({ length: 130 }, () => ({ title: 'x' })),
      }),
    /过多/,
  );
  assert.throws(
    () => validateMindMap({ title: '<bad>', children: 'bad' }),
    /分支/,
  );
  assert.throws(() => parseMindMap('not JSON'), /JSON/);
});

test('SVG escapes model strings and all layout boxes remain in bounds', () => {
  const tree = validateMindMap({
    title: '</text><script>alert("x")</script>&',
    children: [
      {
        title: '较长的中文主题节点用于验证换行与尺寸正确',
        children: [{ title: '叶子', children: [] }],
      },
      { title: 'another', children: [] },
    ],
  });
  const svg = renderMindMapSvg(tree);
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  const layout = layoutMindMap(tree);
  assert.equal(layout.edges.length, layout.nodes.length - 1);
  for (const box of layout.nodes) {
    assert.ok(box.x >= 0 && box.y >= 0);
    assert.ok(box.x + box.width <= layout.width);
    assert.ok(box.y + box.height <= layout.height);
  }
});

test('map preview follows the theme while downloads default to a light readable palette', () => {
  const tree = validateMindMap({
    title: '主题 <x>',
    children: [{ title: '分支' }],
  });
  const light = renderMindMapSvg(tree);
  const dark = renderMindMapSvg(tree, 'dark');
  assert.equal(light, renderMindMapSvg(tree, 'light'));
  assert.ok(light.includes('fill="#f9fbfe"'));
  assert.ok(dark.includes('fill="#162230"'));
  assert.ok(dark.includes('fill="#deebf7"'));
  assert.ok(light.includes('&lt;x&gt;') && dark.includes('&lt;x&gt;'));
  assert.equal(
    (light.match(/<path /g) || []).length,
    (dark.match(/<path /g) || []).length,
  );
});

test('compact layout halves a balanced tall map without losing notes or overlapping boxes', () => {
  const tree = validateMindMap({
    title: '长导图',
    children: Array.from({ length: 6 }, (_, branch) => ({
      title: '主题 ' + branch,
      children: Array.from({ length: 4 }, (_, point) => ({
        title: '要点 ' + point,
        children: Array.from({ length: 3 }, (_, index) => ({
          title: '解释 ' + index,
        })),
      })),
    })),
  });
  const right = layoutMindMap(tree, { mode: 'right' });
  const compact = layoutMindMap(tree, { mode: 'compact' });
  assert.equal(compact.nodes.length, 103);
  assert.equal(compact.edges.length, 102);
  assert.ok(compact.height < right.height * 0.55);
  assert.ok(compact.nodes.some((box) => box.x < compact.nodes[0]!.x));
  for (const layout of [right, compact]) {
    for (const [index, box] of layout.nodes.entries()) {
      assert.ok(box.x >= 0 && box.y >= 0);
      assert.ok(box.x + box.width <= layout.width);
      assert.ok(box.y + box.height <= layout.height);
      for (const other of layout.nodes.slice(index + 1))
        assert.ok(
          box.x + box.width <= other.x ||
            other.x + other.width <= box.x ||
            box.y + box.height <= other.y ||
            other.y + other.height <= box.y,
          'nodes must not overlap',
        );
    }
  }
});

test('depth limits expose folded counts without mutating the original result', () => {
  const tree = validateMindMap({
    title: '中心',
    children: [
      {
        title: '主题',
        children: [{ title: '要点', children: [{ title: '例子' }] }],
      },
      { title: '独立主题' },
    ],
  });
  const original = structuredClone(tree);
  const overview = layoutMindMap(tree, { maxDepth: 1 });
  assert.equal(overview.nodes.length, 3);
  assert.equal(
    overview.nodes.find((box) => box.title === '主题')?.hiddenCount,
    2,
  );
  assert.ok(
    renderMindMapSvg(tree, 'light', { maxDepth: 1 }).includes('+2 条未展开'),
  );
  const rootOnly = layoutMindMap(tree, { maxDepth: 0 });
  assert.equal(rootOnly.nodes.length, 1);
  assert.equal(rootOnly.nodes[0]?.hiddenCount, 4);
  assert.equal(layoutMindMap(tree, { maxDepth: NaN }).nodes.length, 5);
  assert.deepEqual(tree, original);
  assert.equal(
    layoutMindMap(tree).nodes.length,
    5,
    'export keeps the complete tree by default',
  );
});

test('a deep single branch and a root-only result stay within bounds in both layouts', () => {
  let tree = validateMindMap({ title: '末尾' });
  for (let depth = 0; depth < 6; depth++)
    tree = {
      title: '长标题与 Unicode 👨‍👩‍👦 ' + '内容'.repeat(20),
      children: [tree],
    };
  for (const current of [tree, validateMindMap({ title: '只有主题' })]) {
    for (const mode of ['right', 'compact'] as const) {
      const layout = layoutMindMap(current, { mode });
      for (const box of layout.nodes) {
        assert.ok(box.x >= 0 && box.y >= 0);
        assert.ok(box.x + box.width <= layout.width);
        assert.ok(box.y + box.height <= layout.height);
      }
    }
  }
});

test('structure charts count actual notes and layer totals, including root-only results', () => {
  const tree = validateMindMap({
    title: '中心',
    children: [
      {
        title: 'A',
        children: [
          { title: 'A.1' },
          { title: 'A.2', children: [{ title: 'A.2.1' }] },
        ],
      },
      { title: 'B' },
    ],
  });
  assert.deepEqual(mindMapStats(tree), {
    total: 6,
    leaves: 3,
    depth: 4,
    levels: [1, 2, 2, 1],
    branches: [
      { index: 0, title: 'A', count: 4, leaves: 2 },
      { index: 1, title: 'B', count: 1, leaves: 1 },
    ],
  });
  assert.deepEqual(mindMapStats({ title: 'solo', children: [] }), {
    total: 1,
    leaves: 1,
    depth: 1,
    levels: [1],
    branches: [],
  });
});

test('outline search preserves matching context and ancestors without changing cached data', () => {
  const tree = validateMindMap({
    title: '中心',
    children: [
      {
        title: 'Alpha',
        children: [{ title: '关键 <tag>' }, { title: '其他' }],
      },
      { title: 'Beta', children: [{ title: '重复关键' }] },
    ],
  });
  assert.equal(searchMindMap(tree, '   '), tree);
  assert.equal(searchMindMap(tree, '中心'), tree);
  assert.equal(searchMindMap(tree, '未找到'), null);
  assert.deepEqual(searchMindMap(tree, ' ALPHA ')?.children, [
    tree.children[0],
  ]);
  const result = searchMindMap(tree, '关键');
  assert.equal(result?.children.length, 2);
  assert.equal(result?.children[0]?.children.length, 1);
  assert.equal(result?.children[0]?.children[0]?.title, '关键 <tag>');
  assert.equal(tree.children[0]?.children.length, 2);
});

test('Markdown outline exports every detail with literal model markup escaped', () => {
  const tree = validateMindMap({
    title: '# 标题 [链接](https://example.com)',
    children: [
      {
        title: '<script>test</script>',
        children: [{ title: '*细节* | 数据' }],
      },
    ],
  });
  const markdown = mindMapMarkdown(tree);
  assert.ok(markdown.startsWith('# \\# 标题 \\[链接\\]'));
  assert.ok(markdown.includes('- \\<script\\>test\\</script\\>'));
  assert.ok(markdown.includes('  - \\*细节\\* \\| 数据'));
  assert.equal(markdown.match(/^- |^  - /gm)?.length, 2);
  assert.ok(!markdown.includes('<script>'));
});
