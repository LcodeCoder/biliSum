import DOMPurify from 'dompurify';
import { renderDoc } from '../vendor/answer-me-with-html/renderer.js';
import { renderMarkdown } from './markdown';
import { validateHtmlDocument } from './html-document';
import { detailProfile } from './detail';
import { formatTime } from './transcript';
import type { Appearance, HtmlResult, MindMapNode, VideoInfo } from './types';
import { reportThemeVariables } from './theme';

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
  "img-src 'none'",
  "font-src 'none'",
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

function sectionMarkup(markdown: string): string {
  const doc = new DOMParser().parseFromString(
    renderMarkdown(markdown),
    'text/html',
  );
  doc.querySelectorAll('.markdown-table-scroll').forEach((node) => {
    node.className = 'am-table-wrap';
  });
  // Markdown code stays literal and scrolls in the skill's native code style.
  doc.querySelectorAll('pre').forEach((node) => {
    node.className = 'am-code';
    node.setAttribute('tabindex', '0');
  });
  return doc.body.innerHTML;
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
    slots.set(token, { panelId, html: sectionMarkup(section.markdown) });
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
    ::selection { background: var(--accent-bg); color: var(--ink); }
    :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
    html { scrollbar-color: var(--ink-3) var(--bg); }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-thumb { background: var(--ink-3); border-radius: 4px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
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
