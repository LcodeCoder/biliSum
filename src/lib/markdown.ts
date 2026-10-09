import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { SummaryResult, VideoInfo } from './types';
import { detailProfile } from './detail';

export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, {
    gfm: true,
    breaks: false,
    async: false,
  });
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'hr',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'ul',
      'ol',
      'li',
      'strong',
      'em',
      'del',
      's',
      'pre',
      'code',
      'a',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'div',
      'span',
      'sup',
      'sub',
      'dl',
      'dt',
      'dd',
    ],
    ALLOWED_ATTR: ['href', 'title', 'align', 'colspan', 'rowspan'],
    FORBID_TAGS: [
      'img',
      'style',
      'iframe',
      'video',
      'audio',
      'form',
      'input',
      'button',
      'svg',
      'math',
      'link',
      'meta',
      'base',
      'object',
      'embed',
      'source',
      'picture',
      'track',
    ],
    FORBID_ATTR: [
      'style',
      'id',
      'name',
      'srcset',
      'src',
      'poster',
      'background',
      'ping',
    ],
  });
  const document = new DOMParser().parseFromString(clean, 'text/html');
  for (const link of document.querySelectorAll('a')) {
    const href = link.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) link.removeAttribute('href');
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  }
  // Keep tables semantic and full-width; only their trusted wrapper scrolls.
  // Add these attributes after sanitization, never accept them from model HTML.
  document.querySelectorAll('table').forEach((table, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'markdown-table-scroll';
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', `表格 ${index + 1}，宽表可左右滚动`);
    wrapper.setAttribute('tabindex', '0');
    table.before(wrapper);
    wrapper.append(table);
  });
  return document.body.innerHTML;
}

export function summaryDocument(
  video: VideoInfo,
  result: SummaryResult,
): string {
  const literal = (value: string) =>
    value
      .replace(/[\r\n]+/g, ' ')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/[\\`*_{}\[\]()#!|]/g, '\\$&');
  const title = literal(video.title);
  const meta = [
    '- 视频：' + video.url,
    video.owner ? '- UP 主：' + literal(video.owner) : '',
    video.part ? '- 分 P：P' + video.page + ' · ' + literal(video.part) : '',
    '- 字幕来源：' + literal(result.source),
    '- 总结细腻程度：' + detailProfile(result.detailLevel).label,
    '- 模型：' + literal(result.model),
    '- 生成时间：' + result.createdAt,
  ]
    .filter(Boolean)
    .join('\n');
  return (
    '# ' +
    title +
    '\n\n' +
    (result.incomplete
      ? '> 未完成草稿：生成已中断，内容不完整，请勿视为完整总结。\n\n'
      : '') +
    meta +
    '\n\n---\n\n' +
    result.markdown.trim() +
    '\n'
  );
}
