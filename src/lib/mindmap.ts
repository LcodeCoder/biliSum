import type { Appearance, MindMapNode } from './types';
import { appearancePalette } from './theme';
import { HAND_FONT_FACE, HAND_FONT_FAMILY } from './hand-font';

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
  "'" + HAND_FONT_FAMILY + "', 'PingFang SC', 'Microsoft YaHei', sans-serif";
const mapType = (depth: number) =>
  depth === 0
    ? { size: 20, line: 28, weight: 700, padding: 24, maxWidth: 224 }
    : depth === 1
      ? { size: 16, line: 24, weight: 650, padding: 12, maxWidth: 224 }
      : { size: 13, line: 20, weight: 400, padding: 12, maxWidth: 208 };
const TOGGLE_SPACE = 34;
const graphemes = new Intl.Segmenter('zh', { granularity: 'grapheme' });
let textContext: CanvasRenderingContext2D | null | undefined;

function titleMeasurer(depth: number): (text: string) => number {
  if (textContext === undefined && typeof document !== 'undefined')
    textContext = document.createElement('canvas').getContext('2d');
  const context = textContext;
  const type = mapType(depth);
  const font = `${type.weight} ${type.size}px ${MAP_FONT_FAMILY}`;
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
          type.size *
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

function wrapTitle(
  text: string,
  measure: (text: string) => number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const { segment } of graphemes.segment(text)) {
    if (line && measure(line + segment) > maxWidth) {
      lines.push(line);
      line = '';
    }
    line += segment;
  }
  if (line) lines.push(line);
  return lines;
}

function balanceRootEnding(
  lines: string[],
  measure: (text: string) => number,
  maxWidth: number,
): string[] {
  if (lines.length < 2) return lines;
  const previous = lines[lines.length - 2]!;
  const last = lines[lines.length - 1]!;
  if (measure(last) >= measure(previous) * 0.35) return lines;
  const ending = Array.from(
    graphemes.segment(previous + last),
    ({ segment }) => segment,
  );
  let first = previous;
  let second = last;
  let difference = Math.abs(measure(first) - measure(second));
  for (let split = 1; split < ending.length; split++) {
    const left = ending.slice(0, split).join('');
    const right = ending.slice(split).join('');
    const leftWidth = measure(left);
    const rightWidth = measure(right);
    const candidate = Math.abs(leftWidth - rightWidth);
    if (
      leftWidth <= maxWidth &&
      rightWidth <= maxWidth &&
      candidate < difference
    ) {
      first = left;
      second = right;
      difference = candidate;
    }
  }
  return [...lines.slice(0, -2), first, second];
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
  side: number;
  toggleSpace: number;
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
  const mode = options.mode ?? 'right';
  const maxDepth = depthLimit(options.maxDepth);
  const gap = 8;
  const heights = new WeakMap<MindMapNode, number>();
  const sizes = new WeakMap<MindMapNode, number>();
  const titles = new WeakMap<MindMapNode, string[]>();
  const widths = new WeakMap<MindMapNode, number>();
  const measurers = [titleMeasurer(0), titleMeasurer(1), titleMeasurer(2)];
  function prepare(node: MindMapNode, depth: number): number {
    const type = mapType(depth);
    const measure = measurers[Math.min(2, depth)]!;
    const wrapped = wrapTitle(node.title, measure, type.maxWidth);
    const lines =
      depth === 0
        ? balanceRootEnding(wrapped, measure, type.maxWidth)
        : wrapped;
    titles.set(node, lines);
    widths.set(
      node,
      Math.ceil(Math.max(...lines.map(measure))) + type.padding * 2,
    );
    const count =
      1 +
      node.children.reduce((sum, child) => sum + prepare(child, depth + 1), 0);
    sizes.set(node, count);
    return count;
  }
  prepare(tree, 0);
  const isExpanded = (node: MindMapNode, depth: number, path: string) =>
    node.children.length > 0 &&
    (options.expandedPaths
      ? options.expandedPaths.has(path)
      : depth < maxDepth);
  const hiddenCount = (node: MindMapNode, depth: number, path: string) =>
    isExpanded(node, depth, path) ? 0 : (sizes.get(node) ?? 1) - 1;
  const toggleSpace = (node: MindMapNode, depth: number, path: string) =>
    hiddenCount(node, depth, path) ||
    (options.expandedPaths && node.children.length)
      ? TOGGLE_SPACE
      : 0;
  const ownWidth = (node: MindMapNode, depth: number, path: string) =>
    Math.max(
      depth === 0 ? 160 : 60,
      widths.get(node)! + toggleSpace(node, depth, path),
    );
  const ownHeight = (node: MindMapNode, depth: number, _path: string) =>
    (titles.get(node)?.length ?? 1) * mapType(depth).line +
    (depth === 0 ? 36 : 16);
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
    side = 1,
  ): MapBox {
    return {
      path,
      childCount: node.children.length,
      expanded: isExpanded(node, depth, path),
      x,
      y,
      width: ownWidth(node, depth, path),
      height: ownHeight(node, depth, path),
      lines: titles.get(node)!,
      depth,
      branch,
      title: node.title,
      hiddenCount: hiddenCount(node, depth, path),
      side,
      toggleSpace: toggleSpace(node, depth, path),
    };
  }
  function place(
    node: MindMapNode,
    depth: number,
    path: string,
    top: number,
    branch: number,
    side: number,
    parent: MapBox,
  ): MapBox {
    const box = boxAt(
      node,
      depth,
      path,
      side > 0
        ? parent.x + parent.width + (depth === 1 ? 80 : 44)
        : parent.x - (depth === 1 ? 80 : 44) - ownWidth(node, depth, path),
      top + ((heights.get(node) ?? 0) - ownHeight(node, depth, path)) / 2,
      branch,
      side,
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
        box,
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
        root,
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
  const paperPattern = `map-paper-${theme}`;
  const anchorY = (box: MapBox) =>
    box.y + (box.depth === 0 ? box.height / 2 : box.height - 12);
  const paths = layout.edges
    .map(({ from, to }) => {
      const direction = to.side;
      const x1 = from.x + (direction > 0 ? from.width : 0);
      const x2 = to.x + (direction > 0 ? 0 : to.width);
      const y1 = anchorY(from),
        y2 = anchorY(to);
      const bend = Math.abs(x2 - x1) * 0.5;
      const c1 = x1 + direction * bend,
        c2 = x2 - direction * bend;
      const color = colors[to.branch % colors.length];
      if (from.depth === 0) {
        // A closed ribbon narrows smoothly into the first topic's underline.
        return `<path class="map-branch map-trunk" d="M${x1} ${y1 - 2.8} C${c1} ${y1 - 2.8} ${c2} ${y2 - 1.2} ${x2} ${y2 - 1.2} L${x2} ${y2 + 1.2} C${c2} ${y2 + 1.2} ${c1} ${y1 + 2.8} ${x1} ${y1 + 2.8} Z" fill="${color}"/>`;
      }
      return `<path class="map-branch" d="M${x1} ${y1} C${c1} ${y1} ${c2} ${y2} ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>`;
    })
    .join('');
  const boxes = layout.nodes
    .map((box) => {
      const color = colors[box.branch % colors.length]!;
      const type = mapType(box.depth);
      const root = box.depth === 0;
      const toggle = options.interactive && box.childCount > 0;
      const action = box.expanded ? '收起子层' : '展开下一层';
      const hint = box.hiddenCount
        ? '+' + box.hiddenCount + ' 条未展开'
        : toggle
          ? '收起 ' + box.childCount + ' 个子项'
          : '';
      const right = box.side > 0;
      const labelX = root
        ? box.x + (box.width - box.toggleSpace) / 2
        : right
          ? box.x + type.padding
          : box.x + box.width - type.padding;
      const labelY = box.y + (root ? 18 : 6) + type.size;
      const anchor = root ? 'middle' : right ? 'start' : 'end';
      const texts = box.lines
        .map(
          (line, index) =>
            `<tspan x="${labelX}" y="${labelY + index * type.line}">${escapeXml(line)}</tspan>`,
        )
        .join('');
      const baseline = anchorY(box);
      const background = root ? palette.surface : palette.background;
      const badgeWidth = box.hiddenCount >= 100 ? 28 : 22;
      const badgeX = root || right ? box.x + box.width - 18 : box.x + 18;
      const badgeY = root ? box.y + box.height / 2 : baseline;
      const folded = hint
        ? `<rect class="map-toggle" x="${badgeX - badgeWidth / 2}" y="${badgeY - 11}" width="${badgeWidth}" height="22" rx="3" fill="${background}" stroke="${root ? palette.text : color}" stroke-width="1.2" stroke-dasharray="3 2"/>` +
          (box.hiddenCount
            ? `<text class="map-toggle-label" x="${badgeX}" y="${badgeY + 3}" text-anchor="middle" font-size="10" fill="${palette.text}">+${box.hiddenCount}</text>`
            : `<path class="map-toggle-mark" d="M${badgeX - 4} ${badgeY} H${badgeX + 4}" fill="none" stroke="${palette.text}" stroke-width="1.6" stroke-linecap="round"/>`)
        : '';
      const group = options.interactive
        ? '<g class="map-node" data-map-path="' +
          escapeXml(box.path) +
          '" style="--map-branch-color:' +
          color +
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
      const shape = root
        ? `<path class="map-root-shape" d="M${box.x + 4} ${box.y + 3} Q${box.x + box.width * 0.45} ${box.y - 1} ${box.x + box.width - 4} ${box.y + 2} L${box.x + box.width - 1} ${box.y + box.height - 4} Q${box.x + box.width * 0.55} ${box.y + box.height + 1} ${box.x + 2} ${box.y + box.height - 2} Z" fill="${palette.surface}" stroke="${palette.text}" stroke-width="1.5" stroke-dasharray="6 3"/><path class="map-root-sketch" d="M${box.x + 7} ${box.y + box.height + 2} Q${box.x + box.width * 0.55} ${box.y + box.height + 4} ${box.x + box.width + 3} ${box.y + box.height - 1} L${box.x + box.width + 4} ${box.y + 8}" fill="none" stroke="${palette.markerTeal}" stroke-width="1.6" stroke-linecap="round"/><path class="map-tape" d="M${labelX - 25} ${box.y - 4} L${labelX + 25} ${box.y - 7} L${labelX + 28} ${box.y + 5} L${labelX - 24} ${box.y + 8} Z" fill="${palette.markerYellow}" fill-opacity=".7"/>`
        : `<path class="map-underline" d="M${box.x} ${baseline} Q${box.x + box.width * 0.28} ${baseline + 1.5} ${box.x + box.width * 0.5} ${baseline} T${box.x + box.width} ${baseline}" fill="none" stroke="${color}" stroke-width="${box.depth === 1 ? 2.4 : 1.8}" stroke-linecap="round"/>`;
      return (
        group +
        '<title>' +
        escapeXml(
          box.title +
            (hint ? '（' + hint + '）' : '') +
            (toggle ? '（点击' + action + '）' : ''),
        ) +
        '</title>' +
        `<rect class="map-hit-area" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="3" fill="transparent"/>` +
        shape +
        `<text class="map-label" font-size="${type.size}" font-weight="${type.weight}" text-anchor="${anchor}" fill="${palette.text}">${texts}</text>` +
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
    '</title>' +
    (options.interactive
      ? ''
      : '<defs><style><![CDATA[' +
        HAND_FONT_FACE +
        `]]></style><pattern id="${paperPattern}" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M0 27.5 H28" stroke="${palette.line}" stroke-opacity=".2" stroke-width=".6"/></pattern></defs>`) +
    (options.interactive
      ? ''
      : '<rect width="100%" height="100%" fill="' +
        palette.background +
        `"/><rect width="100%" height="100%" fill="url(#${paperPattern})"/>`) +
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
