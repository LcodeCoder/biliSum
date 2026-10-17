import katex from 'katex';
import { Marked, type TokenizerAndRendererExtension } from 'marked';

export interface MathExpression {
  raw: string;
  text: string;
  display: boolean;
}

function escaped(source: string, index: number): boolean {
  let slashes = 0;
  for (let before = index - 1; before >= 0 && source[before] === '\\'; before--)
    slashes++;
  return slashes % 2 === 1;
}

function delimited(
  source: string,
  opening: string,
  closing: string,
  display: boolean,
): MathExpression | undefined {
  if (!source.startsWith(opening)) return;
  let end = opening.length;
  while ((end = source.indexOf(closing, end)) !== -1) {
    if (!escaped(source, end)) {
      const text = source.slice(opening.length, end);
      if (!text.trim()) return;
      if (
        opening === '$' &&
        (/\s/.test(text[0]!) ||
          /\s/.test(text.at(-1)!) ||
          /[\r\n]/.test(text) ||
          /\d/.test(source[end + 1] || ''))
      )
        return;
      return { raw: source.slice(0, end + closing.length), text, display };
    }
    end += closing.length;
  }
}

/** Read math before Markdown consumes the backslashes in \( and \[. */
export function mathAtStart(source: string): MathExpression | undefined {
  if (source.startsWith('$$')) return delimited(source, '$$', '$$', true);
  if (source.startsWith('\\[')) return delimited(source, '\\[', '\\]', true);
  if (source.startsWith('\\(')) return delimited(source, '\\(', '\\)', false);
  if (source.startsWith('$')) return delimited(source, '$', '$', false);
  if (!source.startsWith('(')) return;
  // Old cached summaries lost the delimiter backslashes. Only recover bounded
  // parentheses that contain TeX commands or a clear algebraic expression.
  let depth = 1;
  for (let index = 1; index < source.length; index++) {
    const char = source[index];
    if (char === '\n' || char === '\r') return;
    if (escaped(source, index)) continue;
    if (char === '(') depth++;
    if (char !== ')' || --depth > 0) continue;
    const text = source.slice(1, index);
    const formulaText = text.replace(
      /\\(?:text|mbox|operatorname)\s*\{[^{}]*\}/g,
      '',
    );
    const command =
      /\\[a-zA-Z]+\b/.test(text) &&
      !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(
        formulaText,
      );
    const algebra =
      /^[\dA-Za-z\s+\-*/=<>!^_{}()[\].,:|]+$/.test(text) &&
      /[A-Za-z\d]\s*(?:[=<>]|\^\s*[{\dA-Za-z]|_\s*[{\dA-Za-z])/.test(text);
    if (command || algebra)
      return { raw: source.slice(0, index + 1), text, display: false };
    return;
  }
}

/** Input is TeX only; KaTeX alone produces the trusted attributes and MathML. */
export function renderMath(expression: MathExpression): string | null {
  // These commands require trust and do not belong to video-note mathematics.
  if (
    /\\(?:href|url|includegraphics|htmlClass|htmlId|htmlStyle|htmlData)\b/.test(
      expression.text,
    )
  )
    return null;
  try {
    return katex.renderToString(expression.text, {
      displayMode: expression.display,
      output: 'htmlAndMathml',
      throwOnError: true,
      trust: false,
      strict: 'ignore',
      maxSize: 10,
      maxExpand: 1000,
    });
  } catch {
    return null;
  }
}

export function markdownWithMath(markdown: string): {
  html: string;
  expressions: Map<string, MathExpression>;
} {
  const expressions = new Map<string, MathExpression>();
  const prefix =
    'BILISUMMATH' + crypto.randomUUID().replaceAll('-', '') + 'SLOT';
  const renderer = (token: { raw: string; text: string; display: boolean }) => {
    const key = prefix + expressions.size + 'END';
    expressions.set(key, {
      raw: token.raw,
      text: token.text,
      display: token.display,
    });
    return key;
  };
  const inline: TokenizerAndRendererExtension = {
    name: 'bilisumMathInline',
    level: 'inline',
    start(source) {
      return source.search(/\$|\\[([]|\(/);
    },
    tokenizer(source) {
      if (this.lexer.state.inRawBlock) return;
      const math = mathAtStart(source);
      if (math) return { type: 'bilisumMathInline', ...math };
    },
    renderer(token) {
      return renderer(token as typeof token & MathExpression);
    },
  };
  const block: TokenizerAndRendererExtension = {
    name: 'bilisumMathBlock',
    level: 'block',
    start(source) {
      return source.search(/(?:^|\n) {0,3}(?:\$\$|\\\[)/);
    },
    tokenizer(source) {
      const indent = /^ {0,3}/.exec(source)![0];
      const math = mathAtStart(source.slice(indent.length));
      if (!math?.display) return;
      return { type: 'bilisumMathBlock', ...math, raw: indent + math.raw };
    },
    renderer(token) {
      return renderer(token as typeof token & MathExpression) + '\n';
    },
  };
  const parser = new Marked({
    gfm: true,
    breaks: false,
    async: false,
    extensions: [inline, block],
  });
  return { html: parser.parse(markdown, { async: false }), expressions };
}

/** Called only after untrusted Markdown/document HTML has been sanitized. */
export function restoreMath(
  root: HTMLElement,
  expressions: Map<string, MathExpression>,
): void {
  if (!expressions.size) return;
  const document = root.ownerDocument;
  const walker = document.createTreeWalker(root, 4 /* SHOW_TEXT */);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  const keys = [...expressions.keys()];
  const pattern = new RegExp(keys.join('|'), 'g');
  for (const node of nodes) {
    const parts = node.data.split(pattern);
    if (parts.length === 1) continue;
    const matches = node.data.match(pattern)!;
    const fragment = document.createDocumentFragment();
    parts.forEach((part, index) => {
      fragment.append(document.createTextNode(part));
      const expression = expressions.get(matches[index] || '');
      if (!expression) return;
      const html = node.parentElement?.closest('pre, code, kbd')
        ? null
        : renderMath(expression);
      if (!html) {
        fragment.append(document.createTextNode(expression.raw));
        return;
      }
      const formula = document.createElement('span');
      formula.className =
        'bilisum-math bilisum-math-' +
        (expression.display ? 'display' : 'inline');
      formula.setAttribute('tabindex', '0');
      formula.setAttribute(
        'aria-label',
        expression.display ? '数学公式，可左右滚动' : '数学公式',
      );
      formula.innerHTML = html;
      fragment.append(formula);
    });
    node.replaceWith(fragment);
  }
}
