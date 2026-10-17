import DOMPurify from 'dompurify';
import { renderDoc } from '../vendor/answer-me-with-html/renderer.js';
import { prepareMarkdown } from './markdown';
import { validateHtmlDocument } from './html-document';
import { detailProfile } from './detail';
import { formatTime } from './transcript';
import type { Appearance, HtmlResult, MindMapNode, VideoInfo } from './types';
import { reportThemeVariables } from './theme';
import { HAND_FONT_FACE, HAND_FONT_FAMILY } from './hand-font';
import { MATH_FONT_CSS, MATH_LAYOUT_CSS } from './math-style-data';

export type HtmlReportLayout = 'sheet' | 'doc';
export type HtmlReportTheme = 'shadcn' | 'paper' | 'blueprint';
export interface HtmlReportInput {
  video: VideoInfo;
  result: HtmlResult;
  layout?: HtmlReportLayout;
  theme?: HtmlReportTheme;
  appearance?: Appearance;
}

const CSP = [
  "default-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'",
  'img-src data:',
  'font-src data:',
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// Skill component syntax is trusted, while all video/model text is literal data.
// Entities also protect pipes, tree change markers and Markdown link syntax.
function literal(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(
      /[&<>"'\\`*_{}\[\]()#+\-.!|:\/?~=]/g,
      (char) => `&#${char.charCodeAt(0)};`,
    )
    .trim();
}
function panelTitle(value: string): string {
  // Attribute blocks belong to the skill grammar, never to an AI heading.
  return (
    value.replace(/[\r\n\u0000-\u001f\u007f{}]/g, ' ').trim() || '视频总结'
  );
}
function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('zh-CN', { hour12: false })
    : '未记录';
}

function sectionMarkup(markdown: string): ReturnType<typeof prepareMarkdown> {
  const prepared = prepareMarkdown(markdown);
  const doc = new DOMParser().parseFromString(prepared.html, 'text/html');
  doc.querySelectorAll('.markdown-table-scroll').forEach((node) => {
    node.className = 'am-table-wrap';
  });
  // Markdown code stays literal and scrolls in the skill's native code style.
  doc.querySelectorAll('pre').forEach((node) => {
    node.className = 'am-code';
    node.setAttribute('tabindex', '0');
  });
  return { ...prepared, html: doc.body.innerHTML };
}
function treeLines(node: MindMapNode, depth = 0): string[] {
  return [
    '  '.repeat(depth) + literal(node.title),
    ...node.children.flatMap((child) => treeLines(child, depth + 1)),
  ];
}
function countTree(node: MindMapNode): number {
  return (
    1 + node.children.reduce((total, child) => total + countTree(child), 0)
  );
}
function depthOf(node: MindMapNode): number {
  return 1 + Math.max(0, ...node.children.map(depthOf));
}

/**
 * Generate the exact same self-contained document for preview and download.
 * The skill handles layout/styles; model output never becomes a skill command.
 * The result has no scripts, remote assets, API configuration or hidden cues.
 */
export function createHtmlReport(input: HtmlReportInput): string {
  const { video, result } = input;
  const content = validateHtmlDocument(result.document);
  const tree = content.tree;
  const slots = new Map<string, { panelId: string; html: string }>();
  const restoreFormulas: Array<
    ReturnType<typeof prepareMarkdown>['restoreMath']
  > = [];
  const panels: string[] = [];
  const add = (title: string, body: string) => {
    const key = String.fromCharCode(65 + panels.length);
    panels.push('## ' + key + ' ' + panelTitle(title) + '\n' + body);
    return 'panel-' + key;
  };
  add(
    '核心结论',
    '```callout info 先看结论\n' + literal(content.conclusion) + '\n```',
  );
  content.sections.forEach((section, index) => {
    const token = 'BILISUM_HTML_SUMMARY_SLOT_' + index;
    const panelId = add(section.title, token);
    const sectionContent = sectionMarkup(section.markdown);
    slots.set(token, { panelId, html: sectionContent.html });
    restoreFormulas.push(sectionContent.restoreMath);
  });
  if (tree) {
    add('主题结构', '```tree list\n' + treeLines(tree).join('\n') + '\n```');
    if (tree.children.length) {
      const total = countTree(tree) - 1;
      // Labels enter this component as trusted placeholders. Insert their
      // literal text with the DOM afterward (the component treats pipes as delimiters).
      add(
        '主题条目分布',
        '```limits\n' +
          tree.children
            .map(
              (child, index) =>
                `主题 ${index + 1} | ${countTree(child)} / ${total} | 条目`,
            )
            .join('\n') +
          '\n```\n\n统计只反映导图结构，不代表视频时长或重要性。',
      );
    }
  }
  const videoLinkToken = 'BILISUM_HTML_VIDEO_LINK_SLOT';
  const fields = [
    'UP 主: ' + literal(video.owner || video.bvid),
    '时长: ' + literal(formatTime(video.duration)),
    '分 P: ' +
      literal('P' + video.page + (video.part ? ' · ' + video.part : '')),
    '字幕来源: ' + literal(result.source),
    '细腻程度: ' + detailProfile(result.detailLevel).label,
    '生成模型: ' + literal(result.model),
    '生成时间: ' + literal(dateLabel(result.createdAt)),
    ...(tree
      ? ['导图条目: ' + countTree(tree), '导图层级: ' + depthOf(tree)]
      : []),
  ];
  const videoLinkPanel = add(
    '视频资料',
    '```kv cols=2\n' + fields.join('\n') + '\n```\n\n' + videoLinkToken,
  );
  const source =
    '---\nlang: zh\ncols: 2\nstyle: off\n---\n\n' + panels.join('\n\n');
  const rendered = renderDoc(source, {
    title: content.title,
    subtitle: 'biliSum · ' + video.title,
    template: input.layout === 'doc' ? 'doc' : 'sheet',
    theme: ['shadcn', 'paper', 'blueprint'].includes(input.theme || '')
      ? input.theme!
      : 'paper',
    mode: input.appearance === 'dark' ? 'dark' : 'light',
  });
  const doc = new DOMParser().parseFromString(rendered.html, 'text/html');
  const appearance =
    input.appearance === 'dark' || input.appearance === 'eye'
      ? input.appearance
      : 'light';
  doc.documentElement.dataset.appearance = appearance;
  doc.documentElement.style.colorScheme =
    appearance === 'dark' ? 'dark' : 'light';
  for (const [name, value] of Object.entries(reportThemeVariables(appearance)))
    doc.documentElement.style.setProperty(name, value);
  // The downloaded page is deliberately script-free. Do not leave dead
  // copy/reply/theme controls that require the original CLI's runtime.
  // Remove the renderer's hidden source node including its text: forbidding
  // textarea in the sanitizer alone strips the tag but exposes its contents.
  doc
    .querySelectorAll('script, .am-toolbar, .am-lightbox, #am-source')
    .forEach((node) => node.remove());
  doc
    .querySelector('.am-colophon')
    ?.replaceChildren(doc.createTextNode('biliSum · 视频阅读页'));
  const header = doc.querySelector<HTMLElement>('.am-head');
  if (header) header.style.paddingInlineEnd = '0';
  for (const paragraph of doc.querySelectorAll('.am-panel-body .am-md > p')) {
    const token = paragraph.textContent || '';
    // Only the trusted paragraph in its assigned panel is a placeholder.
    // Literal AI text in a conclusion or another component may match its name.
    const panelId = paragraph.closest('.am-panel')?.id;
    const slot = slots.get(token);
    if (slot && panelId === slot.panelId) {
      const contents = new DOMParser().parseFromString(slot.html, 'text/html');
      paragraph.replaceWith(
        ...[...contents.body.childNodes].map((node) =>
          doc.importNode(node, true),
        ),
      );
      slots.delete(token);
    } else if (token === videoLinkToken && panelId === videoLinkPanel) {
      let url: URL | null = null;
      try {
        url = new URL(video.url);
      } catch {
        /* Display no link for invalid metadata. */
      }
      if (
        url?.protocol === 'https:' &&
        url.hostname === 'www.bilibili.com' &&
        !url.username &&
        !url.password
      ) {
        const link = doc.createElement('a');
        link.textContent = '打开原视频';
        link.href = url.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        paragraph.replaceChildren(link);
      } else paragraph.remove();
    }
  }
  if (slots.size) throw new Error('HTML 排版未完成，请点击重新排版。');
  if (tree) {
    const rows = doc.querySelectorAll('.am-lim');
    tree.children.forEach((child, index) => {
      const label = rows[index]?.querySelector(
        '.am-lim-head > span:first-child',
      );
      if (label) label.textContent = child.title;
      const value = rows[index]?.querySelector('.am-lim-val');
      if (value)
        value.textContent = `${countTree(child)} / ${countTree(tree) - 1} 条目`;
    });
  }
  // Summary HTML has already passed the existing restrictive sanitizer. This
  // second pass also guards the document boundary and disallows active assets.
  doc.body.innerHTML = DOMPurify.sanitize(doc.body.innerHTML, {
    FORBID_TAGS: [
      'script',
      'style',
      'iframe',
      'img',
      'svg',
      'math',
      'link',
      'meta',
      'base',
      'object',
      'embed',
      'form',
      'input',
      'button',
      'select',
      'textarea',
      'video',
      'audio',
      'source',
      'picture',
      'track',
    ],
    FORBID_ATTR: ['src', 'srcset', 'poster', 'background', 'ping', 'srcdoc'],
  });
  // Only KaTeX-generated nodes enter after both untrusted-HTML sanitizers.
  restoreFormulas.forEach((restore) => restore(doc.body));
  for (const link of doc.body.querySelectorAll('a')) {
    const href = link.getAttribute('href') || '';
    if (href.startsWith('#panel-')) continue;
    try {
      const url = new URL(href);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error();
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } catch {
      link.removeAttribute('href');
    }
  }
  const csp = doc.createElement('meta');
  csp.httpEquiv = 'Content-Security-Policy';
  csp.content = CSP;
  const referrer = doc.createElement('meta');
  referrer.name = 'referrer';
  referrer.content = 'no-referrer';
  doc.head.querySelector('meta[charset]')?.after(csp, referrer);
  // Selection, keyboard focus and scrollbars also follow the offline palette.
  const readingStyles = doc.createElement('style');
  readingStyles.textContent = `
    ${HAND_FONT_FACE}
    ${MATH_FONT_CSS}
    ${MATH_LAYOUT_CSS}
    html[data-appearance] { --font-hand: ${HAND_FONT_FAMILY}; }
    html[data-appearance] body {
      font-family: var(--font-sans);
      font-size: 14px;
      line-height: 1.85;
      font-synthesis: weight;
      background-color: var(--bg);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='28' viewBox='0 0 160 28'%3E%3Cpath d='M0 27.5h160' fill='none' stroke='%234ecdc4' stroke-opacity='.17' stroke-width='1'/%3E%3C/svg%3E");
      background-size: 160px 28px;
    }
    ::selection { background: var(--accent-bg); color: var(--ink); }
    :focus-visible { outline: 2px dashed var(--accent); outline-offset: 4px; }
    html { scrollbar-color: var(--ink-3) var(--bg); }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-thumb { background: var(--ink-3); border-radius: 3px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    html[data-appearance] :is(.am-sheet, .am-doc) {
      padding-inline: clamp(16px, 3vw, 28px);
      padding-block-end: 32px;
    }
    html[data-appearance] .am-head { margin-bottom: 28px; }
    html[data-appearance] .am-head h1 {
      font-family: var(--font-hand, 'BiliSum Hand', var(--font-sans));
      font-size: 24px;
      font-weight: 700;
      line-height: 1.5;
      letter-spacing: 0;
      text-wrap: balance;
      text-decoration: underline wavy var(--marker-red, #ff6b6b);
      text-decoration-thickness: 1.5px;
      text-underline-offset: 6px;
      transform: rotate(-0.35deg);
      transform-origin: left center;
    }
    html[data-appearance] .am-sub {
      margin-top: 12px;
      font-size: 13px;
      line-height: 1.7;
    }
    html[data-appearance] .am-grid {
      display: block;
      columns: 2;
      column-gap: 22px;
    }
    html[data-appearance] .am-grid > .am-panel {
      margin-bottom: 22px;
      break-inside: avoid;
    }
    html[data-appearance] .am-grid > .am-panel.am-span-wide { column-span: all; }
    html[data-appearance] .am-panel {
      position: relative;
      border: 2px dashed var(--ink);
      border-radius: 4px 3px 5px 3px;
      background: var(--paper);
      box-shadow: 4px 4px 0 var(--marker-teal, #4ecdc4);
      overflow: visible;
    }
    html[data-appearance] .am-grid > .am-panel:nth-child(3n + 1) {
      transform: rotate(-0.18deg);
    }
    html[data-appearance] .am-grid > .am-panel:nth-child(3n + 2) {
      transform: rotate(0.15deg);
    }
    html[data-appearance] .am-grid > .am-panel:first-child::before {
      content: '';
      position: absolute;
      width: 58px;
      height: 13px;
      top: -8px;
      left: 18px;
      border: 1px dashed var(--ink-2);
      border-radius: 2px 3px 2px 4px;
      background: var(--marker-yellow, #ffd93d);
      transform: rotate(-4deg);
      pointer-events: none;
    }
    html[data-appearance] .am-panel-head {
      min-height: 0;
      padding: 18px 18px 0;
      border: 0;
      background: transparent;
      color: var(--ink);
    }
    html[data-appearance] .am-panel-id { display: none; }
    html[data-appearance] .am-panel-head h2 {
      padding: 0;
      color: var(--ink);
      font-family: var(--font-hand, 'BiliSum Hand', var(--font-sans));
      font-size: 20px;
      font-weight: 700;
      line-height: 1.5;
      text-wrap: balance;
    }
    html[data-appearance] .am-panel-body { padding: 10px 18px 18px; }
    html[data-appearance] :is(.am-md, .am-intro, .am-callout) {
      font-family: var(--font-sans);
      font-size: 14px;
      line-height: 1.85;
    }
    html[data-appearance] .am-md :is(p, li, blockquote) {
      font-size: inherit;
      line-height: inherit;
    }
    html[data-appearance] .am-md p { margin: 0 0 12px; }
    html[data-appearance] .am-md :is(ul, ol) {
      padding-inline-start: 1.5em;
      margin: 0 0 14px;
    }
    html[data-appearance] .am-md li + li { margin-top: 6px; }
    html[data-appearance] .am-md :is(h1, h2, h3, h4) {
      margin: 24px 0 10px;
      font-family: var(--font-hand, 'BiliSum Hand', var(--font-sans));
      font-weight: 700;
      line-height: 1.5;
      color: var(--ink);
    }
    html[data-appearance] .am-md h1 { font-size: 23px; }
    html[data-appearance] .am-md h2 { font-size: 21px; }
    html[data-appearance] .am-md h3 { font-size: 19px; }
    html[data-appearance] .am-md h4 { font-size: 17px; }
    html[data-appearance] .am-md > :first-child { margin-top: 0; }
    html[data-appearance] .am-md > :last-child { margin-bottom: 0; }
    html[data-appearance] a {
      text-decoration-style: wavy;
      text-underline-offset: 4px;
      text-decoration-thickness: 1px;
    }
    html[data-appearance] a:hover {
      color: var(--ink);
      text-decoration-color: var(--marker-red, #ff6b6b);
      text-decoration-thickness: 2px;
    }
    html[data-appearance] a:active { text-decoration-color: var(--marker-teal, #4ecdc4); }
    html[data-appearance] .am-callout {
      border: 0;
      padding: 0;
      border-radius: 4px;
      background: transparent;
      box-shadow: none;
      color: var(--ink);
    }
    html[data-appearance] .am-callout-title { display: none; }
    html[data-appearance] .am-md blockquote {
      margin: 16px 0;
      padding: 10px 0;
      border-inline: 0;
      border-block: 1px dashed var(--line);
      background: transparent;
      color: var(--ink-2);
    }
    html[data-appearance] .am-md hr {
      border: 0;
      border-top: 1px dashed var(--line);
    }
    html[data-appearance] .am-table-wrap {
      max-width: 100%;
      margin: 16px 0;
      overscroll-behavior-inline: contain;
    }
    html[data-appearance] .am-md table {
      font-family: var(--font-sans);
      font-size: 13px;
      line-height: 1.7;
      font-variant-numeric: tabular-nums;
      background: var(--paper);
    }
    html[data-appearance] .am-md :is(th, td) {
      min-width: 7em;
      padding: 10px 12px;
      border-bottom: 1px dashed var(--line);
      vertical-align: top;
    }
    html[data-appearance] .am-md th {
      font: 650 13px/1.7 var(--font-sans);
      color: var(--ink);
      background: var(--accent-bg);
    }
    html[data-appearance] .am-md :is(th, td) > :last-child { margin-bottom: 0; }
    html[data-appearance] :is(code, pre, kbd, .am-tree-tag, .am-lim-val, .am-lim-ticks) {
      font-family: var(--font-sans);
    }
    html[data-appearance] .am-md :not(pre) > code {
      border-radius: 3px 2px 4px 2px;
      background: var(--fill);
    }
    html[data-appearance] .am-code {
      border: 1px dashed var(--line);
      border-radius: 4px 3px 5px 3px;
      padding: 14px;
      background: var(--paper);
      box-shadow: none;
      font-size: 12px;
      line-height: 1.75;
    }
    html[data-appearance] .am-doc { max-width: 1120px; }
    html[data-appearance] .am-doc-layout { gap: 28px; }
    html[data-appearance] .am-doc-body { max-width: 72ch; }
    html[data-appearance] .am-doc-body > .am-panel {
      border: 0;
      border-radius: 4px;
      background: transparent;
      box-shadow: none;
    }
    html[data-appearance] .am-doc-body > .am-panel + .am-panel {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px dashed var(--line);
    }
    html[data-appearance] .am-doc-body .am-panel-head { padding: 0; }
    html[data-appearance] .am-doc-body .am-panel-head h2 {
      text-decoration: underline wavy var(--marker-teal, #4ecdc4);
      text-underline-offset: 5px;
      text-decoration-thickness: 1px;
    }
    html[data-appearance] .am-doc-body .am-panel-body { padding: 12px 0 0; }
    html[data-appearance] .am-toc {
      font-size: 13px;
      line-height: 1.7;
    }
    html[data-appearance] .am-toc a {
      padding-block: 6px;
      border-inline-start: 1px dashed var(--line);
      text-decoration: none;
    }
    html[data-appearance] .am-toc a:hover {
      border-inline-start-color: var(--marker-red, #ff6b6b);
      text-decoration: underline wavy var(--marker-red, #ff6b6b);
    }
    html[data-appearance] .am-kv {
      border: 0;
      border-top: 1px dashed var(--line);
      border-inline-start: 1px dashed var(--line);
      border-radius: 4px 3px 4px 2px;
    }
    html[data-appearance] .am-kv-cell {
      border: 0;
      border-inline-end: 1px dashed var(--line);
      border-bottom: 1px dashed var(--line);
    }
    html[data-appearance] .am-kv dt { font: 12px/1.6 var(--font-sans); }
    html[data-appearance] .am-kv dd {
      font-size: 14px;
      line-height: 1.7;
    }
    html[data-appearance] .am-kv-cell:last-child:nth-child(odd) { grid-column: 1 / -1; }
    html[data-appearance] .am-lim-head {
      align-items: baseline;
      flex-wrap: wrap;
      gap: 4px 12px;
      line-height: 1.6;
    }
    html[data-appearance] :is(.am-lim-val, .am-lim-ticks) { font-variant-numeric: tabular-nums; }
    html[data-appearance] .am-lim-ticks { font-size: 11px; }
    html[data-appearance] .am-lim-ticks span { white-space: nowrap; }
    html[data-appearance] .am-lim-ticks span:last-child { transform: translateX(-100%); }
    html[data-appearance] .am-lim-track {
      height: 10px;
      border: 1px dashed var(--line);
      border-radius: 3px 2px 4px 2px;
      background: var(--paper);
    }
    html[data-appearance] .am-lim-fill {
      border-inline-end: 1px dashed var(--ink);
      border-radius: 2px 3px 2px 4px;
      background: var(--marker-teal, #4ecdc4);
    }
    html[data-appearance] .am-lim-mark { border-left: 1px dashed var(--ink); }
    html[data-appearance] .am-tree-box {
      border: 1px dashed var(--ink);
      border-radius: 4px 3px 5px 2px;
      background: var(--paper);
    }
    html[data-appearance] .am-tree-box--root { background: var(--accent-bg); }
    html[data-appearance] .am-tree-root::after,
    html[data-appearance] .am-tree-col::after,
    html[data-appearance] .am-tree-list li::after {
      border: 0;
      border-inline-start: 1px dashed var(--ink-3);
    }
    html[data-appearance] .am-tree-col::before,
    html[data-appearance] .am-tree-list li::before {
      border: 0;
      border-top: 1px dashed var(--ink-3);
    }
    html[data-appearance] .am-colophon {
      padding: 0 16px 24px;
      font: 12px/1.7 var(--font-sans);
      color: var(--ink-2);
    }
    html[data-appearance] .am-frame { border-radius: 4px 3px 5px 3px; }
    html[data-appearance][data-theme="blueprint"] .am-frame { border-style: dashed; }
    html[data-appearance] .am-frame::before {
      border-color: var(--line);
      border-style: dashed;
      border-radius: 3px 4px 2px 4px;
    }
    html[data-appearance] .am-ruler {
      font-family: var(--font-sans);
      background: var(--bg);
    }
    html[data-appearance] .am-ruler--top span + span,
    html[data-appearance] .am-ruler--bottom span + span { border-inline-start-style: dashed; }
    html[data-appearance] .am-ruler--left span + span,
    html[data-appearance] .am-ruler--right span + span { border-top-style: dashed; }
    html[data-appearance] .am-panel--bare {
      border: 0;
      background: transparent;
      box-shadow: none;
    }
    @media (max-width: 760px) {
      html[data-appearance] .am-doc-layout { gap: 24px; }
      html[data-appearance] .am-grid { columns: 1; }
    }
    @media (max-width: 360px) {
      html[data-appearance] :is(.am-sheet, .am-doc) { padding-inline: 12px; }
      html[data-appearance] .am-head h1 { font-size: 22px; }
      html[data-appearance] .am-panel-head { padding: 16px 14px 0; }
      html[data-appearance] .am-panel-body { padding: 10px 14px 16px; }
      html[data-appearance] .am-grid { gap: 20px; }
      html[data-appearance] .am-doc-body .am-panel-head { padding: 0; }
      html[data-appearance] .am-doc-body .am-panel-body { padding: 10px 0 0; }
      html[data-appearance] .am-kv { grid-template-columns: minmax(0, 1fr); }
    }
    @media print {
      html[data-appearance] body { background-image: none; }
      html[data-appearance] .am-panel { box-shadow: none; }
      html[data-appearance] .am-grid > .am-panel:nth-child(n) { transform: none; }
      html[data-appearance] .am-grid { columns: 1; }
      html[data-appearance] .am-grid > .am-panel:first-child::before { display: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; }
    }
  `;
  doc.head.append(readingStyles);
  // Long literal words must wrap, including titles, metadata and tree labels.
  // Remove the top space reserved for the CLI toolbar, absent in offline exports.
  doc.body.style.overflowWrap = 'anywhere';
  const page = doc.querySelector<HTMLElement>('.am-sheet, .am-doc');
  if (page) page.style.paddingBlockStart = '24px';
  // Keep the skill's license with its embedded CSS even when this file is shared.
  doc.head.append(
    doc.createComment(
      ' Answer me with HTML 0.5.0 — MIT; Copyright (c) 2026 Answer me with HTML contributors.\n' +
        'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n' +
        'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. ',
    ),
  );
  return '<!doctype html>\n' + doc.documentElement.outerHTML;
}
