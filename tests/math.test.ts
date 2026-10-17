import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mathAtStart,
  markdownWithMath,
  propositionNotation,
  renderMath,
} from '../src/lib/math';
import { MATH_FONT_CSS, MATH_LAYOUT_CSS } from '../src/lib/math-style-data';

test('math delimiters survive Markdown escapes, including inline, display and cached parentheses', () => {
  for (const [raw, text, display] of [
    [String.raw`$X\in\mathbb{R}$`, String.raw`X\in\mathbb{R}`, false],
    [String.raw`\(X^2\ge 0\)`, String.raw`X^2\ge 0`, false],
    ['$$\nx^2+y^2=z^2\n$$', '\nx^2+y^2=z^2\n', true],
    [
      String.raw`\[\sum_{n=1}^{\infty}n^{-2}\]`,
      String.raw`\sum_{n=1}^{\infty}n^{-2}`,
      true,
    ],
    [String.raw`(X\in\mathbb{R})`, String.raw`X\in\mathbb{R}`, false],
    [String.raw`(X^2\ge 0)`, String.raw`X^2\ge 0`, false],
    [String.raw`(\forall)`, String.raw`\forall`, false],
    [String.raw`(A\to B)`, String.raw`A\to B`, false],
    ['(A=0)', 'A=0', false],
    ['(X_n)', 'X_n', false],
    [String.raw`(\frac{a}{b}(x+1))`, String.raw`\frac{a}{b}(x+1)`, false],
  ] as const) {
    assert.deepEqual(mathAtStart(raw + '。后续正文'), { raw, text, display });
    const prepared = markdownWithMath('原文 ' + raw + ' 后续正文');
    assert.equal(prepared.expressions.size, 1, raw);
    assert.equal([...prepared.expressions.values()][0]?.text, text);
    assert.ok(
      renderMath([...prepared.expressions.values()][0]!)?.includes(
        'class="katex"',
      ),
    );
  }
});

test('currency, ordinary parentheses, unmatched math and code stay literal', () => {
  for (const source of [
    '(普通说明)',
    '(for example)',
    '(version 1.2)',
    '(X)',
    String.raw`(例如 X\in\mathbb{R} 表示实数)`,
    '$5 and $10',
    '$5, $10, $20',
    '$ 20',
    '$unfinished',
    String.raw`\(missing end`,
    String.raw`\[missing end`,
  ])
    assert.equal(mathAtStart(source), undefined, source);
  for (const source of [
    '`$x^2$`',
    '`\\(X\\in\\mathbb{R}\\)`',
    '```tex\n$$x^2$$\n(X\\in\\mathbb{R})\n```',
    '    $x^2$\n',
    '<pre>$x^2$</pre>',
    '<code>\\(x^2\\)</code>',
    '$5 and $10',
    '$5, $10, $20',
    String.raw`\$5 and \$10`,
    '[link](https://example.com/$x$)',
  ])
    assert.equal(markdownWithMath(source).expressions.size, 0, source);
});

test('math is isolated from emphasis, links and table parsing without changing the input', () => {
  const source = String.raw`**量词**：\(\forall x\in\mathbb{R}, x^2\ge0\)。

| 命题 | 条件 |
| --- | --- |
| $A\to B$ | (A=0) |

$$
\begin{aligned}a_1&=1\\a_n&=a_{n-1}+1\end{aligned}
$$`;
  const original = source;
  const prepared = markdownWithMath(source);
  assert.equal(source, original);
  assert.equal(prepared.expressions.size, 4);
  assert.match(prepared.html, /<strong>量词<\/strong>/);
  assert.match(prepared.html, /<table>/);
  assert.equal([...prepared.expressions.values()].at(-1)?.display, true);
  const again = markdownWithMath(source);
  assert.notDeepEqual(
    [...prepared.expressions.keys()],
    [...again.expressions.keys()],
  );
});

test('untrusted and invalid TeX produces no active assets or alarming error markup', () => {
  for (const text of [
    String.raw`\href{javascript:alert(1)}{click}`,
    String.raw`\url{https://hostile.example/}`,
    String.raw`\includegraphics{https://hostile.example/image}`,
    String.raw`\htmlStyle{background:url(https://hostile.example/image)}{x}`,
    String.raw`\htmlClass{fake}{x}`,
    String.raw`\unknown{x}`,
    String.raw`\frac{a}{`,
    String.raw`\def\a{\a}\a`,
  ])
    assert.equal(
      renderMath({ raw: '$' + text + '$', text, display: false }),
      null,
      text,
    );
  const html = renderMath({
    raw: '',
    text: String.raw`\text{<img src=x onerror=alert(1)>}`,
    display: false,
  })!;
  assert.doesNotMatch(html, /<img|<script|<a\b|<style/i);
  assert.match(html, /<math\b/);
  const bounded = renderMath({
    raw: '',
    text: String.raw`\rule{500em}{500em}`,
    display: true,
  })!;
  assert.doesNotMatch(bounded, /(?:style|width|height)="[^"]*500em/);
  assert.match(bounded, /10em/);
});

test('simple proposition negations display an overbar while preserving source data', () => {
  for (const [source, expected] of [
    [String.raw`\neg A`, String.raw`\overline{A}`],
    [String.raw`\lnot B`, String.raw`\overline{B}`],
    [String.raw`\neg{P}`, String.raw`\overline{P}`],
    [String.raw`\lnot {Q}`, String.raw`\overline{Q}`],
    [String.raw`\neg B\to\neg A`, String.raw`\overline{B}\to\overline{A}`],
    [String.raw`A\land\neg B`, String.raw`A\land\overline{B}`],
    [String.raw`\neg A_i`, String.raw`\overline{A_i}`],
    [String.raw`\lnot P_{n+1}`, String.raw`\overline{P_{n+1}}`],
    [String.raw`\neg{A_i}`, String.raw`\overline{A_i}`],
  ]) {
    assert.equal(propositionNotation(source!), expected);
    const markdown = '$' + source + '$';
    const cached = '(' + source + ')';
    for (const input of [markdown, cached]) {
      const expression = [...markdownWithMath(input).expressions.values()][0]!;
      assert.equal(expression.raw, input);
      assert.equal(expression.text, source);
      const html = renderMath(expression)!;
      assert.match(html, /katex-overline/);
      assert.match(html, /<mover[^>]*accent="true"/);
      assert.doesNotMatch(html, /¬/);
    }
  }
});

test('negation notation leaves inequalities, composites, text, code and existing accents intact', () => {
  for (const source of [
    String.raw`A\ne B`,
    String.raw`A\neq B`,
    String.raw`A\setminus B`,
    String.raw`A\backslash B`,
    String.raw`\neg (A\lor B)`,
    String.raw`\neg{A\lor B}`,
    String.raw`\neg A^2`,
    String.raw`\neg ABC`,
    String.raw`\neg x`,
    String.raw`\text{否定 \neg A 的例子}`,
    String.raw`\textbf{example \neg B}`,
    String.raw`\operatorname{\neg A}`,
    String.raw`\mbox{\neg P}`,
    String.raw`\def\neg A{B}`,
    String.raw`\newcommand{\neg}{A}`,
    String.raw`\bar{A}`,
    String.raw`\overline{B}`,
    String.raw`\\neg A`,
  ])
    assert.equal(propositionNotation(source), source, source);
  const code = '`$\\neg A$`\n\n```tex\n\\lnot B\n```';
  assert.equal(markdownWithMath(code).expressions.size, 0);
});

test('offline math styles embed WOFF2 fonts and keep wide formulas locally scrollable', () => {
  assert.equal(
    [...MATH_FONT_CSS.matchAll(/data:font\/woff2;base64,/g)].length,
    20,
  );
  assert.equal([...MATH_FONT_CSS.matchAll(/@font-face\{/g)].length, 20);
  assert.doesNotMatch(MATH_FONT_CSS, /url\((?!data:)/);
  assert.match(MATH_FONT_CSS, /MIT License/);
  assert.match(
    MATH_LAYOUT_CSS,
    /\.bilisum-math-display[\s\S]*overflow-x: auto/,
  );
  assert.match(MATH_LAYOUT_CSS, /max-width: 100%/);
});
