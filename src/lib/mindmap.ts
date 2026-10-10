import type { Appearance, MindMapNode } from './types';
import { appearancePalette } from './theme';

export function validateMindMap(input: unknown): MindMapNode {
  let count = 0;
  const seen = new Set<object>();
  function visit(value: unknown, depth: number): MindMapNode {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('导图节点格式有误，请重新生成。');
    if (seen.has(value)) throw new Error('导图节点结构有循环。');
    seen.add(value);
    if (++count > 120 || depth > 6)
      throw new Error('导图层级或节点过多，请重新生成。');
    const node = value as Record<string, unknown>;
    if (
      typeof node.title !== 'string' ||
      !node.title.trim() ||
      node.title.length > 120
    )
      throw new Error('导图节点标题有误，请重新生成。');
    if (node.children !== undefined && !Array.isArray(node.children))
      throw new Error('导图分支格式有误，请重新生成。');
    return {
      title: node.title.trim().replace(/[\u0000-\u001f]/g, ' '),
      children: ((node.children || []) as unknown[]).map((child) =>
        visit(child, depth + 1),
      ),
    };
  }
  return visit(input, 0);
}

export function parseMindMap(text: string): MindMapNode {
  const raw = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return validateMindMap(JSON.parse(raw));
  } catch (error) {
    if (error instanceof Error && !(error instanceof SyntaxError)) throw error;
  }
  const start = raw.indexOf('{');
  let depth = 0,
    quote = false,
    escaped = false;
  for (let i = start; start >= 0 && i < raw.length; i++) {
    const char = raw[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quote = false;
    } else if (char === '"') quote = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) {
      try {
        return validateMindMap(JSON.parse(raw.slice(start, i + 1)));
      } catch {
        break;
      }
    }
  }
  throw new Error('模型返回的导图 JSON 格式有误，请重新生成或更换模型。');
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const MAP_FONT_FAMILY =
  'system-ui, -apple-system, Segoe UI, Microsoft YaHei, sans-serif';
const MAP_FONT_SIZE = 13;
const MAP_LINE_HEIGHT = 20;
const MAP_PADDING = 14;
const MAP_FOOTER_HEIGHT = 20;
const graphemes = new Intl.Segmenter('zh', { granularity: 'grapheme' });
let textContext: CanvasRenderingContext2D | null | undefined;

function titleMeasurer(depth: number): (text: string) => number {
  if (textContext === undefined && typeof document !== 'undefined')
    textContext = document.createElement('canvas').getContext('2d');
  const context = textContext;
  const font = `${depth < 2 ? 600 : 400} ${MAP_FONT_SIZE}px ${MAP_FONT_FAMILY}`;
  const cache = new Map<string, number>();
  return (text) => {
    const cached = cache.get(text);
    if (cached !== undefined) return cached;
    // The extension and SVG/PNG exports use the same font metrics. Node-only
    // callers use a conservative estimate, including wide Latin and emoji.
    let width: number;
    if (context) {
      context.font = font;
      width = context.measureText(text).width;
    } else {
      width = Array.from(graphemes.segment(text)).reduce(
        (sum, { segment }) =>
          sum +
          MAP_FONT_SIZE *
            (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(segment)
              ? 2
              : 1),
        0,
      );
    }
    cache.set(text, width);
    return width;
  };
}

function wrapTitle(text: string, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const { segment } of graphemes.segment(text)) {
    if (line && measure(line + segment) > 174 - MAP_PADDING * 2) {
      lines.push(line);
      line = '';
    }
    line += segment;
  }
  if (line) lines.push(line);
  return lines;
}

function depthLimit(maxDepth?: number): number {
  return Number.isFinite(maxDepth)
    ? Math.max(0, Math.min(6, Math.floor(maxDepth!)))
    : 6;
}

/** Paths are based on child indexes, so duplicate titles remain independent. */
export function expandedMindMapPaths(
  tree: MindMapNode,
  maxDepth?: number,
): Set<string> {
  const paths = new Set<string>();
  const limit = depthLimit(maxDepth);
  function visit(node: MindMapNode, depth: number, path: string) {
    if (!node.children.length || depth >= limit) return;
    paths.add(path);
    node.children.forEach((child, index) =>
      visit(child, depth + 1, `${path}.${index}`),
    );
  }
  visit(tree, 0, '0');
  return paths;
}

export type MapLayoutMode = 'compact' | 'right';
export interface MapLayoutOptions {
  mode?: MapLayoutMode;
  /** Root is depth 0. Omitted means the complete tree. */
  maxDepth?: number;
  /** When provided, only these parents show their immediate children. */
  expandedPaths?: ReadonlySet<string>;
}
export interface MapBox {
  path: string;
  childCount: number;
  expanded: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
  depth: number;
  branch: number;
  title: string;
  hiddenCount: number;
}
export interface MapEdge {
  from: MapBox;
  to: MapBox;
}
export interface MapLayout {
  width: number;
  height: number;
  nodes: MapBox[];
  edges: MapEdge[];
}

export interface MapStats {
  total: number;
  leaves: number;
  depth: number;
  levels: number[];
  branches: { index: number; title: string; count: number; leaves: number }[];
}

/** Counts describe generated notes, not importance or video duration. */
export function mindMapStats(tree: MindMapNode): MapStats {
  const levels: number[] = [];
  function count(
    node: MindMapNode,
    depth: number,
  ): { count: number; leaves: number } {
    levels[depth] = (levels[depth] ?? 0) + 1;
    let total = 1;
    let leaves = node.children.length ? 0 : 1;
    for (const child of node.children) {
      const result = count(child, depth + 1);
      total += result.count;
      leaves += result.leaves;
    }
    return { count: total, leaves };
  }
  levels[0] = 1;
  const branches = tree.children.map((child, index) => ({
    index,
    title: child.title,
    ...count(child, 1),
  }));
  return {
    total: 1 + branches.reduce((sum, branch) => sum + branch.count, 0),
    leaves: branches.length
      ? branches.reduce((sum, branch) => sum + branch.leaves, 0)
      : 1,
    depth: levels.length,
    levels,
    branches,
  };
}

/** Keep matching nodes and their ancestors. A matching parent keeps its context. */
export function searchMindMap(
  tree: MindMapNode,
  query: string,
): MindMapNode | null {
  const term = query.trim().toLocaleLowerCase();
  if (!term || tree.title.toLocaleLowerCase().includes(term)) return tree;
  const children = tree.children
    .map((child) => searchMindMap(child, term))
    .filter((child): child is MindMapNode => child !== null);
  return children.length ? { title: tree.title, children } : null;
}

export function layoutMindMap(
  tree: MindMapNode,
  options: MapLayoutOptions = {},
): MapLayout {
  const mode = options.mode ?? 'compact';
  const maxDepth = depthLimit(options.maxDepth);
  const gap = 12;
  const heights = new WeakMap<MindMapNode, number>();
  const sizes = new WeakMap<MindMapNode, number>();
  const titles = new WeakMap<MindMapNode, string[]>();
  const measurers = [titleMeasurer(0), titleMeasurer(2)];
  let width = 174;
  function prepare(node: MindMapNode, depth: number): number {
    const measure = measurers[depth < 2 ? 0 : 1]!;
    const lines = wrapTitle(node.title, measure);
    titles.set(node, lines);
    // A single unsplittable grapheme must also fit inside the background.
    for (const line of lines)
      width = Math.max(width, Math.ceil(measure(line)) + MAP_PADDING * 2);
    const count =
      1 +
      node.children.reduce((sum, child) => sum + prepare(child, depth + 1), 0);
    sizes.set(node, count);
    return count;
  }
  prepare(tree, 0);
  const step = width + 40;
  const isExpanded = (node: MindMapNode, depth: number, path: string) =>
    node.children.length > 0 &&
    (options.expandedPaths
      ? options.expandedPaths.has(path)
      : depth < maxDepth);
  const hiddenCount = (node: MindMapNode, depth: number, path: string) =>
    isExpanded(node, depth, path) ? 0 : (sizes.get(node) ?? 1) - 1;
  const ownHeight = (node: MindMapNode, depth: number, path: string) =>
    (titles.get(node)?.length ?? 1) * MAP_LINE_HEIGHT +
    MAP_PADDING * 2 +
    (hiddenCount(node, depth, path) ||
    (options.expandedPaths && node.children.length)
      ? MAP_FOOTER_HEIGHT
      : 0);
  const childrenAt = (node: MindMapNode, depth: number, path: string) =>
    isExpanded(node, depth, path) ? node.children : [];
  function measure(node: MindMapNode, depth: number, path: string): number {
    const children = childrenAt(node, depth, path);
    const height = Math.max(
      ownHeight(node, depth, path),
      children.reduce(
        (sum, child, index) =>
          sum + measure(child, depth + 1, `${path}.${index}`),
        0,
      ) +
        Math.max(0, children.length - 1) * gap,
    );
    heights.set(node, height);
    return height;
  }
  measure(tree, 0, '0');
  const nodes: MapBox[] = [];
  const edges: MapEdge[] = [];
  function boxAt(
    node: MindMapNode,
    depth: number,
    path: string,
    x: number,
    y: number,
    branch: number,
  ): MapBox {
    return {
      path,
      childCount: node.children.length,
      expanded: isExpanded(node, depth, path),
      x,
      y,
      width,
      height: ownHeight(node, depth, path),
      lines: titles.get(node)!,
      depth,
      branch,
      title: node.title,
      hiddenCount: hiddenCount(node, depth, path),
    };
  }
  function place(
    node: MindMapNode,
    depth: number,
    path: string,
    top: number,
    branch: number,
    side: number,
  ): MapBox {
    const box = boxAt(
      node,
      depth,
      path,
      side * depth * step,
      top + ((heights.get(node) ?? 0) - ownHeight(node, depth, path)) / 2,
      branch,
    );
    nodes.push(box);
    let childTop = top;
    childrenAt(node, depth, path).forEach((child, index) => {
      const childBox = place(
        child,
        depth + 1,
        `${path}.${index}`,
        childTop,
        branch,
        side,
      );
      edges.push({ from: box, to: childBox });
      childTop += (heights.get(child) ?? 0) + gap;
    });
    return box;
  }
  const groups: { node: MindMapNode; branch: number }[][] = [[], []];
  const groupHeights = [0, 0];
  childrenAt(tree, 0, '0').forEach((node, branch) => {
    // Greedy subtree-height balancing preserves the order on each side.
    const side =
      mode === 'compact' && groupHeights[0]! > groupHeights[1]! ? 1 : 0;
    if (groups[side]!.length) groupHeights[side]! += gap;
    groups[side]!.push({ node, branch });
    groupHeights[side]! += heights.get(node) ?? 0;
  });
  const contentHeight = Math.max(ownHeight(tree, 0, '0'), ...groupHeights);
  // Place the root independently: only its direct branches are split left/right.
  const root = boxAt(
    tree,
    0,
    '0',
    0,
    24 + (contentHeight - ownHeight(tree, 0, '0')) / 2,
    0,
  );
  nodes.push(root);
  groups.forEach((group, side) => {
    let top = 24 + (contentHeight - groupHeights[side]!) / 2;
    for (const { node, branch } of group) {
      const childBox = place(
        node,
        1,
        `0.${branch}`,
        top,
        branch,
        side === 0 ? 1 : -1,
      );
      edges.push({ from: root, to: childBox });
      top += (heights.get(node) ?? 0) + gap;
    }
  });
  const minX = Math.min(...nodes.map((box) => box.x));
  const maxX = Math.max(...nodes.map((box) => box.x + box.width));
  for (const box of nodes) box.x += 24 - minX;
  return { width: maxX - minX + 48, height: contentHeight + 48, nodes, edges };
}

export function renderMindMapSvg(
  tree: MindMapNode,
  theme: Appearance = 'light',
  options: MapLayoutOptions = {},
): string {
  return renderMindMapLayout(layoutMindMap(tree, options), tree.title, theme);
}

export function renderMindMapLayout(
  layout: MapLayout,
  title: string,
  theme: Appearance = 'light',
  options: { interactive?: boolean } = {},
): string {
  const palette = appearancePalette(theme);
  const colors = palette.mapColors;
  const paths = layout.edges
    .map((edge) => {
      const direction = edge.to.x > edge.from.x ? 1 : -1;
      const x1 = edge.from.x + (direction > 0 ? edge.from.width : 0),
        y1 = edge.from.y + edge.from.height / 2;
      const x2 = edge.to.x + (direction > 0 ? 0 : edge.to.width),
        y2 = edge.to.y + edge.to.height / 2;
      return (
        '<path d="M' +
        x1 +
        ' ' +
        y1 +
        ' C' +
        (x1 + direction * 20) +
        ' ' +
        y1 +
        ' ' +
        (x2 - direction * 20) +
        ' ' +
        y2 +
        ' ' +
        x2 +
        ' ' +
        y2 +
        '" fill="none" stroke="' +
        colors[edge.to.branch % colors.length] +
        '" stroke-width="1.6" opacity="0.55"/>'
      );
    })
    .join('');
  const boxes = layout.nodes
    .map((box) => {
      const color = colors[box.branch % colors.length]!;
      const fill =
        box.depth === 0
          ? palette.accent
          : box.depth === 1
            ? palette.soft
            : palette.surface;
      const texts = box.lines
        .map(
          (line, index) =>
            '<tspan x="' +
            (box.x + MAP_PADDING) +
            '" y="' +
            (box.y + MAP_PADDING + MAP_FONT_SIZE + index * MAP_LINE_HEIGHT) +
            '">' +
            escapeXml(line) +
            '</tspan>',
        )
        .join('');
      const toggle = options.interactive && box.childCount > 0;
      const action = box.expanded ? '收起子层' : '展开下一层';
      const hint = box.hiddenCount
        ? '+' + box.hiddenCount + ' 条未展开'
        : toggle
          ? '− 收起 ' + box.childCount + ' 个子项'
          : '';
      const folded = hint
        ? '<text x="' +
          (box.x + MAP_PADDING) +
          '" y="' +
          (box.y + box.height - MAP_PADDING) +
          '" font-size="11" fill="' +
          (box.depth === 0 ? palette.onAccent : palette.text) +
          '" opacity=".8">' +
          hint +
          '</text>'
        : '';
      const group = options.interactive
        ? '<g class="map-node" data-map-path="' +
          escapeXml(box.path) +
          '"' +
          (toggle
            ? ' role="button" tabindex="0" aria-expanded="' +
              box.expanded +
              '" aria-label="' +
              action +
              '：' +
              escapeXml(box.title) +
              '"'
            : '') +
          '>'
        : '<g>';
      return (
        group +
        '<title>' +
        escapeXml(box.title + (toggle ? '（点击' + action + '）' : '')) +
        '</title><rect x="' +
        box.x +
        '" y="' +
        box.y +
        '" width="' +
        box.width +
        '" height="' +
        box.height +
        '" rx="6" fill="' +
        fill +
        '" stroke="' +
        (box.depth === 0 ? palette.accent : color) +
        '" stroke-opacity="' +
        (box.depth < 2 ? '1' : '.25') +
        '"/><text font-size="' +
        MAP_FONT_SIZE +
        '" font-weight="' +
        (box.depth < 2 ? '600' : '400') +
        '" fill="' +
        (box.depth === 0 ? palette.onAccent : palette.text) +
        '">' +
        texts +
        '</text>' +
        folded +
        '</g>'
      );
    })
    .join('');
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    layout.width +
    '" height="' +
    layout.height +
    '" viewBox="0 0 ' +
    layout.width +
    ' ' +
    layout.height +
    '" role="' +
    (options.interactive ? 'group' : 'img') +
    '" aria-label="' +
    escapeXml(title) +
    '" font-family="' +
    MAP_FONT_FAMILY +
    '" letter-spacing="0"><title>' +
    escapeXml(title) +
    '</title><rect width="100%" height="100%" fill="' +
    palette.background +
    '"/>' +
    paths +
    boxes +
    '</svg>'
  );
}

/** Plain Markdown export always includes the complete generated tree. */
export function mindMapMarkdown(tree: MindMapNode): string {
  const escape = (text: string) => text.replace(/[\\`*_{}[\]<>!#|]/g, '\\$&');
  const lines = ['# ' + escape(tree.title), ''];
  function visit(node: MindMapNode, depth: number) {
    lines.push('  '.repeat(depth) + '- ' + escape(node.title));
    for (const child of node.children) visit(child, depth + 1);
  }
  for (const child of tree.children) visit(child, 0);
  return lines.join('\n') + '\n';
}
