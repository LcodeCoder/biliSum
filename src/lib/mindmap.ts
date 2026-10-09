import type { MindMapNode } from './types';

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

function wrapTitle(text: string): string[] {
  const lines: string[] = [];
  let line = '',
    width = 0;
  for (const char of text) {
    const size = /[\x00-\xff]/.test(char) ? 0.55 : 1;
    if (width + size > 12) {
      lines.push(line);
      line = '';
      width = 0;
    }
    line += char;
    width += size;
  }
  if (line) lines.push(line);
  return lines;
}

export type MapLayoutMode = 'compact' | 'right';
export interface MapLayoutOptions {
  mode?: MapLayoutMode;
  /** Root is depth 0. Omitted means the complete tree. */
  maxDepth?: number;
}
export interface MapBox {
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
  const maxDepth = Number.isFinite(options.maxDepth)
    ? Math.max(0, Math.min(6, Math.floor(options.maxDepth!)))
    : 6;
  const gap = 12;
  const step = 214;
  const width = 174;
  const heights = new WeakMap<MindMapNode, number>();
  const sizes = new WeakMap<MindMapNode, number>();
  const descendants = (node: MindMapNode): number => {
    const count =
      1 + node.children.reduce((sum, child) => sum + descendants(child), 0);
    sizes.set(node, count);
    return count;
  };
  descendants(tree);
  const hiddenCount = (node: MindMapNode, depth: number) =>
    depth >= maxDepth ? (sizes.get(node) ?? 1) - 1 : 0;
  const ownHeight = (node: MindMapNode, depth: number) =>
    wrapTitle(node.title).length * 18 +
    20 +
    (hiddenCount(node, depth) ? 16 : 0);
  const childrenAt = (node: MindMapNode, depth: number) =>
    depth < maxDepth ? node.children : [];
  function measure(node: MindMapNode, depth: number): number {
    const children = childrenAt(node, depth);
    const height = Math.max(
      ownHeight(node, depth),
      children.reduce((sum, child) => sum + measure(child, depth + 1), 0) +
        Math.max(0, children.length - 1) * gap,
    );
    heights.set(node, height);
    return height;
  }
  measure(tree, 0);
  const nodes: MapBox[] = [];
  const edges: MapEdge[] = [];
  function place(
    node: MindMapNode,
    depth: number,
    top: number,
    branch: number,
    side: number,
  ): MapBox {
    const box: MapBox = {
      x: side * depth * step,
      y: top + ((heights.get(node) ?? 0) - ownHeight(node, depth)) / 2,
      width,
      height: ownHeight(node, depth),
      lines: wrapTitle(node.title),
      depth,
      branch,
      title: node.title,
      hiddenCount: hiddenCount(node, depth),
    };
    nodes.push(box);
    let childTop = top;
    for (const child of childrenAt(node, depth)) {
      const childBox = place(child, depth + 1, childTop, branch, side);
      edges.push({ from: box, to: childBox });
      childTop += (heights.get(child) ?? 0) + gap;
    }
    return box;
  }
  const groups: { node: MindMapNode; branch: number }[][] = [[], []];
  const groupHeights = [0, 0];
  childrenAt(tree, 0).forEach((node, branch) => {
    // Greedy subtree-height balancing preserves the order on each side.
    const side =
      mode === 'compact' && groupHeights[0]! > groupHeights[1]! ? 1 : 0;
    if (groups[side]!.length) groupHeights[side]! += gap;
    groups[side]!.push({ node, branch });
    groupHeights[side]! += heights.get(node) ?? 0;
  });
  const contentHeight = Math.max(ownHeight(tree, 0), ...groupHeights);
  // Place the root independently: only its direct branches are split left/right.
  const root: MapBox = {
    x: 0,
    y: 24 + (contentHeight - ownHeight(tree, 0)) / 2,
    width,
    height: ownHeight(tree, 0),
    lines: wrapTitle(tree.title),
    depth: 0,
    branch: 0,
    title: tree.title,
    hiddenCount: hiddenCount(tree, 0),
  };
  nodes.push(root);
  groups.forEach((group, side) => {
    let top = 24 + (contentHeight - groupHeights[side]!) / 2;
    for (const { node, branch } of group) {
      const childBox = place(node, 1, top, branch, side === 0 ? 1 : -1);
      edges.push({ from: root, to: childBox });
      top += (heights.get(node) ?? 0) + gap;
    }
  });
  const minX = Math.min(...nodes.map((box) => box.x));
  const maxX = Math.max(...nodes.map((box) => box.x + box.width));
  for (const box of nodes) box.x += 24 - minX;
  return { width: maxX - minX + 48, height: contentHeight + 48, nodes, edges };
}

const MAP_PALETTES = {
  light: {
    background: '#f9fbfe',
    root: '#4b8fc9',
    rootText: '#ffffff',
    branch: '#edf5fc',
    leaf: '#ffffff',
    text: '#2b3e52',
    colors: ['#4c92c9', '#6b9ec7', '#4385b6', '#79aad0', '#588eb8', '#87b3d5'],
  },
  dark: {
    background: '#162230',
    root: '#80b9e5',
    rootText: '#12283b',
    branch: '#22364a',
    leaf: '#1b2c3c',
    text: '#deebf7',
    colors: ['#87bcea', '#a0c8e7', '#79b1dc', '#a7cfee', '#8fbad9', '#b0d1eb'],
  },
};
export function renderMindMapSvg(
  tree: MindMapNode,
  theme: 'light' | 'dark' = 'light',
  options: MapLayoutOptions = {},
): string {
  return renderMindMapLayout(layoutMindMap(tree, options), tree.title, theme);
}

export function renderMindMapLayout(
  layout: MapLayout,
  title: string,
  theme: 'light' | 'dark' = 'light',
): string {
  const palette = MAP_PALETTES[theme];
  const colors = palette.colors;
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
          ? palette.root
          : box.depth === 1
            ? palette.branch
            : palette.leaf;
      const texts = box.lines
        .map(
          (line, index) =>
            '<tspan x="' +
            (box.x + 15) +
            '" y="' +
            (box.y + 24 + index * 18) +
            '">' +
            escapeXml(line) +
            '</tspan>',
        )
        .join('');
      const folded = box.hiddenCount
        ? '<text x="' +
          (box.x + 15) +
          '" y="' +
          (box.y + box.height - 9) +
          '" font-size="10" fill="' +
          palette.text +
          '" opacity=".7">+' +
          box.hiddenCount +
          ' 条未展开</text>'
        : '';
      return (
        '<g><title>' +
        escapeXml(box.title) +
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
        (box.depth === 0 ? palette.root : color) +
        '" stroke-opacity="' +
        (box.depth < 2 ? '1' : '.25') +
        '"/><text font-size="13" font-weight="' +
        (box.depth < 2 ? '600' : '400') +
        '" fill="' +
        (box.depth === 0 ? palette.rootText : palette.text) +
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
    '" role="img" aria-label="' +
    escapeXml(title) +
    '" font-family="system-ui, -apple-system, Segoe UI, Microsoft YaHei, sans-serif"><title>' +
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
