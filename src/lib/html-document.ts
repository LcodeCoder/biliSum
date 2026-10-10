import { validateMindMap } from './mindmap';
import type { HtmlDocument } from './types';

const MAX_DOCUMENT_SIZE = 120_000;
function text(value: unknown, label: string, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit)
    throw new Error(`HTML 阅读页的${label}无效，请重新生成。`);
  return value.trim();
}

/** Validate AI/cache data independently of the browser and page renderer. */
export function validateHtmlDocument(input: unknown): HtmlDocument {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('HTML 阅读页格式有误，请重新生成。');
  const raw = input as Record<string, unknown>;
  if (
    !Array.isArray(raw.sections) ||
    !raw.sections.length ||
    raw.sections.length > 4
  )
    throw new Error('HTML 阅读页应包含 1–4 个内容章节，请重新生成。');
  const document: HtmlDocument = {
    title: text(raw.title, '标题', 160),
    conclusion: text(raw.conclusion, '核心结论', 4000),
    sections: raw.sections.map((section) => {
      if (!section || typeof section !== 'object' || Array.isArray(section))
        throw new Error('HTML 阅读页章节格式有误，请重新生成。');
      return {
        title: text(section.title, '章节标题', 160),
        markdown: text(section.markdown, '章节正文', 40_000),
      };
    }),
    tree: raw.tree == null ? null : validateMindMap(raw.tree),
  };
  if (JSON.stringify(document).length > MAX_DOCUMENT_SIZE)
    throw new Error('HTML 阅读页内容过长，请降低细腻程度后重试。');
  return document;
}

export function parseHtmlDocument(response: string): HtmlDocument {
  if (response.length > 180_000)
    throw new Error('HTML 阅读页响应过大，请降低细腻程度后重试。');
  let raw = response.trim();
  let value: unknown;
  try {
    if (raw.startsWith('```')) {
      const fenced = raw.match(/^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n?```$/i);
      if (!fenced) throw new Error('Incomplete JSON fence');
      raw = fenced[1]!.trim();
    }
    value = JSON.parse(raw);
  } catch {
    throw new Error(
      '模型没有返回有效的 HTML 阅读页数据，请重新生成或更换模型。',
    );
  }
  return validateHtmlDocument(value);
}
