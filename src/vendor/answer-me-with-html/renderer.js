// Generated browser port of Answer me with HTML 0.5.0 (MIT).
// Copyright (c) 2026 Answer me with HTML contributors.
// Upstream CLI SHA-256: 751888304373642db95bcbe356c1c64153f76883e170cab4a56953119e12ec6a
// Rebuild: node scripts/vendor-html-renderer.mjs /path/to/skill/scripts/am.mjs
// Node, CLI, filesystem, videos, inline scripts and file/code fences are disabled.
// Only local page templates, themes, callout/kv/tree/limits components are retained.
// License: THIRD_PARTY_NOTICES.md; changes: scripts/vendor-html-renderer.mjs.

// skill-browser-adapter.js
import { Marked as F } from "marked";
var VERSION = "0.5.0";
var BASE_CSS = '/* Answer me with HTML base \u2014 uses theme variables only, never hard-coded colors (theme tokens and decorations: themes/<name>.js). Exception: the var() fallbacks of diagrams (flow / sequence) equal the blueprint light tokens, guarded by a test. */\n*, *::before, *::after { box-sizing: border-box; }\nhtml, body { margin: 0; padding: 0; }\nbody {\n  background: var(--bg); color: var(--ink);\n  font-family: var(--font-sans); font-size: 14px; line-height: 1.55;\n  -webkit-font-smoothing: antialiased;\n}\ncode, pre, kbd { font-family: var(--font-mono); }\n\n/* \u2500\u2500 Toolbar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.am-toolbar {\n  position: fixed; top: 12px; inset-inline-end: 12px; z-index: 10; display: flex; gap: 6px;\n}\n.am-btn {\n  font: 12px/1 var(--font-sans); color: var(--ink); background: var(--paper);\n  border: 1px solid var(--line-2); border-radius: var(--radius); padding: 7px 10px; cursor: pointer;\n}\n.am-btn:hover { border-color: var(--ink-3); }\n.am-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }\n/* Theme and mode lists: a label and a native select inside one button-like box */\n.am-pick {\n  display: flex; align-items: center; gap: 6px; font: 12px/1 var(--font-sans); color: var(--ink-2); background: var(--paper);\n  border: 1px solid var(--line-2); border-radius: var(--radius); padding-block: 0; padding-inline: 10px 4px;\n}\n.am-pick:hover { border-color: var(--ink-3); }\n.am-pick:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }\n.am-pick select {\n  font: inherit; color: var(--ink); background: transparent; border: 0; padding: 6px 2px; cursor: pointer; outline: none;\n}\n.am-pick option { color: var(--ink); background: var(--paper); }\n\n/* \u2500\u2500 Header \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.am-head { margin: 0 0 20px; padding-inline-end: 300px; }\n.am-head h1 { margin: 0; font-size: 24px; line-height: 1.25; letter-spacing: -0.01em; }\n.am-sub { margin: 4px 0 0; color: var(--ink-2); }\n.am-head-meta { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 10px; font-size: 12px; color: var(--ink-2); }\n.am-head-meta b { font-family: var(--font-mono); font-weight: 400; color: var(--ink-3); margin-inline-end: 6px; }\n.am-intro { margin-top: 12px; max-width: 80ch; }\n\n/* \u2500\u2500 sheet template \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.am-sheet { max-width: 1680px; margin: 0 auto; padding: 32px 28px 40px; }\n.am-frame { position: relative; }\n.am-grid {\n  display: grid; grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr));\n  gap: 20px; align-items: start;\n}\n.am-ruler { display: none; }\n.am-ruler span { flex: 1; display: flex; align-items: center; justify-content: center; }\n.am-ruler--top, .am-ruler--bottom { left: 18px; right: 18px; height: 18px; }\n.am-ruler--top { top: 0; }\n.am-ruler--bottom { bottom: 0; }\n.am-ruler--left, .am-ruler--right { top: 18px; bottom: 18px; width: 18px; flex-direction: column; }\n.am-ruler--left { left: 0; }\n.am-ruler--right { right: 0; }\n.am-ruler--top span + span, .am-ruler--bottom span + span { border-inline-start: 1px solid var(--line); }\n.am-ruler--left span + span, .am-ruler--right span + span { border-top: 1px solid var(--line); }\n\n/* \u2500\u2500 Panels \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.am-panel {\n  background: var(--paper); border: var(--bw) solid var(--line); border-radius: var(--radius);\n  box-shadow: var(--shadow); min-width: 0; overflow: hidden;\n}\n.am-panel-head {\n  display: flex; align-items: stretch; gap: 0; border-bottom: var(--bw) solid var(--line); min-height: 34px;\n}\n.am-panel-id {\n  display: flex; align-items: center; justify-content: center; min-width: 34px; padding: 0 8px;\n  background: var(--head-bg); color: var(--head-fg); font-weight: 600; font-size: 14px;\n}\n.am-panel-head h2 { margin: 0; padding: 7px 12px; font-size: 15px; font-weight: 600; flex: 1; display: flex; align-items: center; }\n.am-panel-meta { align-self: center; padding: 0 12px; font: 11px/1.3 var(--font-mono); color: var(--ink-2); text-align: end; }\n.am-panel-body { padding: 14px 16px 16px; }\n.am-panel-body > * + * { margin-top: 12px; }\n\n/* \u2500\u2500 Markdown body \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.am-md > :first-child { margin-top: 0; }\n.am-md > :last-child { margin-bottom: 0; }\n.am-md p { margin: 0 0 8px; }\n.am-md ul, .am-md ol { margin: 0 0 8px; padding-inline-start: 20px; }\n.am-md li + li { margin-top: 3px; }\n.am-md h3, .am-md h4 { margin: 14px 0 6px; font-size: 13px; }\n.am-md a { color: var(--accent); }\n.am-md blockquote { margin: 0 0 8px; padding: 2px 12px; border-inline-start: 3px solid var(--line-2); color: var(--ink-2); }\n.am-md :not(pre) > code { font-size: 0.9em; background: var(--fill); padding: 1px 5px; border-radius: 4px; }\n.am-md hr { border: 0; border-top: 1px solid var(--line-2); margin: 12px 0; }\n.am-md table { width: 100%; border-collapse: collapse; font-size: 13px; }\n.am-md th {\n  text-align: start; font: 11px/1.3 var(--font-mono); color: var(--ink-2); font-weight: 400;\n  padding: 6px 10px; border-bottom: 1px solid var(--line-2);\n}\n/* th { text-align: start } outranks the align attribute from Markdown alignment, so restore right and center columns explicitly. */\n.am-md th[align="right"] { text-align: right; }\n.am-md th[align="center"] { text-align: center; }\n.am-md td { padding: 7px 10px; border-bottom: 1px solid var(--line-2); vertical-align: top; }\n.am-md tbody tr:nth-child(even) td { background: var(--fill); }\n.am-table-wrap { overflow-x: auto; }\n/* Images scale down to the panel and never past 70% of the window height, keeping their shape. */\n.am-md img { max-width: 100%; max-height: 70vh; height: auto; }\n.am-figure { margin: 0; text-align: center; }\n.am-figure img { display: block; margin: 0 auto; border: 1px solid var(--line-2); border-radius: var(--radius); }\n.am-figure figcaption { margin-top: 6px; font-size: 12px; line-height: 1.4; color: var(--ink-2); }\n.am-code {\n  margin: 0; padding: 12px 14px; background: var(--fill); border: 1px solid var(--line-2);\n  border-radius: var(--radius); overflow-x: auto; font-size: 12.5px; line-height: 1.5;\n}\n/* Ask: a decision the reader makes; the suggested option starts selected */\n.am-ask { margin: 10px 0; padding: 10px 12px 8px; border: 1px solid var(--line-2); border-radius: var(--radius); background: var(--fill); min-width: 0; }\n/* The question floats inside the box, so a long question wraps like text instead of riding on the border */\n.am-ask-q { float: left; width: 100%; padding: 0; margin-bottom: 4px; font-weight: 600; }\n/* Two columns: the control, then the label, tag and note, which wrap under the label and never under the control */\n.am-ask-opt { clear: both; display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 8px; align-items: baseline; padding: 5px 2px; cursor: pointer; }\n.am-ask-opt input { margin: 0; accent-color: var(--accent); position: relative; top: 2px; }\n.am-ask-tag { display: inline-block; font-size: 11px; line-height: 1.5; color: var(--accent); border: 1px solid var(--accent); border-radius: 999px; padding: 0 6px; white-space: nowrap; }\n.am-ask-note { display: block; color: var(--ink-2); }\n/* Comment box under each panel, and the Reply sheet */\n.am-comment-btn {\n  display: flex; flex-shrink: 0; align-self: center; margin-block: 0; margin-inline: auto 6px; color: var(--ink-3); background: transparent;\n  border: 1px solid transparent; border-radius: var(--radius); padding: 3px; cursor: pointer;\n}\n.am-panel-meta + .am-comment-btn { margin-inline-start: 0; }\n.am-panel:hover .am-comment-btn, .am-comment-btn:focus-visible, .am-comment-btn[aria-expanded="true"] { border-color: var(--line-2); color: var(--ink-2); }\n.am-panel .am-comment-btn.am-comment-btn--on { color: var(--accent); border-color: var(--accent); }\n.am-panel--bare { position: relative; }\n.am-panel--bare > .am-comment-btn { position: absolute; top: 4px; inset-inline-end: 0; }\n.am-comment { padding: 0 14px 12px; }\n.am-comment textarea, .am-reply textarea {\n  width: 100%; font: 13px/1.5 var(--font-sans); color: var(--ink); background: var(--paper);\n  border: 1px solid var(--line-2); border-radius: var(--radius); padding: 8px 10px; resize: vertical;\n}\n.am-comment textarea:focus-visible, .am-reply textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }\n.am-btn--reply { color: var(--paper); background: var(--ink); border-color: var(--ink); }\n.am-btn--reply:hover { opacity: .88; }\n.am-reply {\n  width: min(640px, calc(100vw - 32px)); padding: 16px; color: var(--ink); background: var(--paper);\n  border: 1px solid var(--line-2); border-radius: var(--radius); box-shadow: 0 12px 40px rgba(0,0,0,.25);\n}\n.am-reply::backdrop { background: rgba(0,0,0,.35); }\n.am-reply-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin-bottom: 10px; }\n.am-reply-head span { color: var(--ink-2); font-size: 13px; }\n.am-reply textarea { font-family: var(--font-mono); font-size: 12.5px; }\n.am-reply-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }\n.am-reply .am-btn:disabled { opacity: .5; cursor: default; }\n/* Code block: a header (title or path:lines, language, copy), then one span per line; numbered blocks show the line number in a gutter */\n.am-codeblock { margin: 10px 0; min-width: 0; }\n.am-codeblock .am-code { border-top-left-radius: 0; border-top-right-radius: 0; padding: 10px 0; }\n.am-code-head {\n  display: flex; align-items: center; gap: 8px; padding: 5px 6px 5px 12px; font: 12px/1.3 var(--font-sans); color: var(--ink-2);\n  background: var(--paper); border: 1px solid var(--line-2); border-bottom: 0; border-radius: var(--radius) var(--radius) 0 0;\n}\n.am-code-title { font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }\n.am-code-lang { margin-left: auto; color: var(--ink-3); text-transform: lowercase; }\n.am-code-copy { font: 12px/1 var(--font-sans); color: var(--ink-2); background: transparent; border: 1px solid var(--line-2); border-radius: var(--radius); padding: 4px 8px; cursor: pointer; margin-left: auto; }\n.am-code-lang + .am-code-copy { margin-left: 0; }\n.am-code-copy:hover { border-color: var(--ink-3); color: var(--ink); }\n.am-code-copy:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }\n.am-code code { display: block; min-width: max-content; }\n.am-ln { display: block; padding: 0 14px; min-height: 1.5em; white-space: pre; }\n.am-ln--hl { background: var(--accent-bg); box-shadow: inset 3px 0 0 var(--accent); }\n.am-code--num .am-ln::before {\n  content: attr(data-n); display: inline-block; width: 3.5ch; margin-right: 12px; text-align: right; color: var(--ink-3);\n  user-select: none; -webkit-user-select: none;\n}\n\n/* \u2500\u2500 Status badges ok / no / warn \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.am-status { white-space: nowrap; font-weight: 500; }\n.am-status--ok { color: var(--ok); }\n.am-status--no { color: var(--err); }\n.am-status--warn { color: var(--warn); }\n.am-status-icon { display: inline-block; width: 1.1em; font-weight: 700; }\n\n/* \u2500\u2500 callout \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.am-callout {\n  border: 1px solid var(--line-2); border-inline-start: 3px solid var(--accent); background: var(--accent-bg);\n  padding: 10px 14px; border-radius: var(--radius);\n}\n.am-callout--ok { border-inline-start-color: var(--ok); background: var(--ok-bg); }\n.am-callout--warn { border-inline-start-color: var(--warn); background: var(--warn-bg); }\n.am-callout--err { border-inline-start-color: var(--err); background: var(--err-bg); }\n.am-callout-title { font-weight: 600; margin-bottom: 4px; }\n\n/* \u2500\u2500 kv title block \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.am-kv {\n  display: grid; grid-template-columns: repeat(var(--kv-cols, 2), minmax(0, 1fr)); margin: 0;\n  border-top: var(--bw) solid var(--line); border-inline-start: var(--bw) solid var(--line);\n}\n.am-kv-cell { border-inline-end: var(--bw) solid var(--line); border-bottom: var(--bw) solid var(--line); padding: 6px 10px 8px; min-width: 0; }\n.am-kv-cell--wide { grid-column: 1 / -1; }\n.am-kv dt { font: 11px/1.4 var(--font-mono); color: var(--ink-2); }\n.am-kv dd { margin: 2px 0 0; font-size: 14px; font-weight: 500; overflow-wrap: anywhere; }\n.am-kv-cell--wide dd { font-size: 17px; font-weight: 600; }\n\n/* \u2500\u2500 timeline \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.am-timeline { list-style: none; margin: 0; padding: 0; }\n.am-timeline--h { display: grid; grid-template-columns: repeat(var(--n, 1), minmax(0, 1fr)); padding-top: 4px; }\n.am-timeline--h li { position: relative; text-align: center; padding: 0 6px; }\n.am-timeline--h li::before {\n  content: ""; position: absolute; top: 31px; left: 0; right: 0; border-top: var(--bw) solid var(--line);\n}\n.am-timeline--h li:first-child::before { inset-inline-start: 50%; }\n.am-timeline--h li:last-child::before { inset-inline-end: 50%; }\n.am-tl-when { display: block; font-size: 15px; font-weight: 500; height: 24px; }\n.am-tl-dot {\n  position: relative; display: block; width: 11px; height: 11px; margin: 2px auto 8px;\n  border: var(--bw) solid var(--line); border-radius: 50%; background: var(--paper);\n}\n.am-tl-item--hi .am-tl-dot { background: var(--accent); border-color: var(--accent); }\n.am-tl-title { display: block; font-size: 12.5px; font-weight: 500; }\n.am-tl-text { display: block; font-size: 12px; color: var(--ink-2); line-height: 1.45; }\n.am-timeline--v li { position: relative; padding: 0 0 14px; padding-inline-start: 22px; }\n.am-timeline--v li::before { content: ""; position: absolute; inset-inline-start: 5px; top: 6px; bottom: -6px; border-inline-start: var(--bw) solid var(--line-2); }\n.am-timeline--v li:last-child::before { display: none; }\n.am-timeline--v .am-tl-dot { position: absolute; inset-inline-start: 0; top: 4px; margin: 0; }\n.am-timeline--v .am-tl-when { display: inline; height: auto; font: 12px var(--font-mono); color: var(--ink-2); margin-inline-end: 8px; }\n.am-timeline--v .am-tl-title { display: inline; font-size: 14px; }\n.am-timeline--v .am-tl-text { margin-top: 2px; }\n/* .am-tl-wrap is the container (src/components/timeline.js): a horizontal timeline answers to the width it has, not to the width of the window, since a\n   sheet puts panels two or three to a row. Below 560 px (about 90 px for each of the six items a timeline has by default) its dates\n   wrap and the dots cover them, so it lays out like timeline v: line and dots at the start, text beside them. */\n.am-tl-wrap { container-type: inline-size; }\n@container (max-width: 560px) {\n  .am-timeline--h { display: block; padding-top: 0; }\n  .am-timeline--h li { text-align: start; padding: 0 0 14px; padding-inline-start: 22px; }\n  .am-timeline--h li::before, .am-timeline--h li:first-child::before {\n    top: 6px; bottom: -6px; inset-inline-start: 5px; inset-inline-end: auto; border-top: 0; border-inline-start: var(--bw) solid var(--line-2);\n  }\n  .am-timeline--h li:last-child::before { display: none; }\n  .am-timeline--h .am-tl-dot { position: absolute; inset-inline-start: 0; top: 4px; margin: 0; }\n  .am-timeline--h .am-tl-when { display: inline; height: auto; font: 12px var(--font-mono); color: var(--ink-2); margin-inline-end: 8px; }\n  .am-timeline--h .am-tl-title { display: inline; font-size: 14px; }\n  .am-timeline--h .am-tl-text { margin-top: 2px; }\n}\n\n/* \u2500\u2500 annot sentence notes \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.am-annot + .am-annot { border-top: 1px solid var(--line-2); padding-top: 12px; }\n.am-annot-head { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; font-weight: 600; margin-bottom: 8px; }\n.am-annot-meta { font: 11px var(--font-mono); font-weight: 400; color: var(--ink-2); }\n.am-annot-scroll { overflow-x: auto; }\n.am-annot-line {\n  position: relative; display: inline-block; white-space: pre; font: 14px/1.6 var(--font-mono);\n  padding-bottom: calc(var(--rows, 0) * 17px + 14px);\n}\n.am-annot-line--wrap { display: block; white-space: normal; padding-bottom: 10px; }\n.am-annot-line--wrap .am-seg { white-space: nowrap; }\n.am-seg { position: relative; }\n.am-seg::after {\n  content: ""; position: absolute; left: 1px; right: 1px; top: calc(100% + 1px); height: 5px;\n  border: 1px solid var(--accent); border-top: 0;\n}\n.am-seg-n {\n  position: absolute; inset-inline-start: 0; top: calc(100% + 8px + var(--row, 0) * 17px);\n  font: 11px/16px var(--font-sans); color: var(--accent); white-space: nowrap;\n}\n.am-seg--err { color: var(--err); }\n.am-seg--err::after { border-color: var(--err); }\n.am-seg--err .am-seg-n { color: var(--err); }\n.am-annot-caption { font-size: 12px; color: var(--ink-2); }\n\n/* \u2500\u2500 limits bars \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.am-lim + .am-lim { margin-top: 14px; }\n.am-lim-head { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; margin-bottom: 4px; }\n.am-lim-val { font: 12px var(--font-mono); color: var(--accent); white-space: nowrap; }\n.am-lim-track { position: relative; height: 12px; border: 1px solid var(--line-2); background: var(--fill); border-radius: calc(var(--radius) / 2); }\n.am-lim-fill { position: absolute; inset-inline-start: 0; top: 0; bottom: 0; background: var(--accent-bg); border-inline-end: 1px solid var(--accent); }\n.am-lim-mark { position: absolute; top: -4px; bottom: -4px; border-left: 2px solid var(--accent); }\n.am-lim.is-over .am-lim-fill { background: var(--err-bg); border-inline-end-color: var(--err); }\n.am-lim.is-over .am-lim-val { color: var(--err); }\n.am-lim-ticks { position: relative; height: 16px; font: 10px/16px var(--font-mono); color: var(--ink-3); }\n.am-lim-ticks span { position: absolute; transform: translateX(-50%); }\n.am-lim-ticks span:first-child { transform: none; }\n.am-lim-note { font-size: 11px; color: var(--ink-2); margin-inline-start: 6px; }\n\n/* \u2500\u2500 tree \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.am-tree { font-size: 13px; }\n.am-tree-root { display: flex; justify-content: center; position: relative; padding-bottom: 18px; }\n.am-tree-root::after { content: ""; position: absolute; bottom: 0; left: 50%; height: 18px; border-left: var(--bw) solid var(--line); }\n.am-tree-root--solo { padding-bottom: 12px; }\n.am-tree-root--solo::after { display: none; }\n.am-tree-box {\n  border: var(--bw) solid var(--line); background: var(--paper); padding: 6px 14px; text-align: center;\n  border-radius: var(--radius); font-weight: 600;\n}\n.am-tree-box small { display: block; font-weight: 400; color: var(--ink-2); font-size: 12px; }\n.am-tree-box--root { background: var(--accent-bg); font-size: 15px; padding: 8px 28px; }\n.am-tree-cols { display: grid; grid-template-columns: repeat(var(--n, 1), minmax(0, 1fr)); }\n.am-tree-col { position: relative; padding: 18px 8px 0; min-width: 0; }\n.am-tree-col::before { content: ""; position: absolute; top: 0; left: 0; right: 0; border-top: var(--bw) solid var(--line); }\n.am-tree-col:first-child::before { inset-inline-start: 50%; }\n.am-tree-col:last-child::before { inset-inline-end: 50%; }\n.am-tree-col::after { content: ""; position: absolute; top: 0; left: 50%; height: 18px; border-left: var(--bw) solid var(--line); }\n.am-tree-list, .am-tree-list ul { list-style: none; margin: 0; padding: 0; }\n.am-tree-col > .am-tree-list { margin: 8px 0 0; margin-inline-start: 14px; }\n.am-tree-list ul { margin-inline-start: 16px; }\n.am-tree-list li { position: relative; padding: 3px 0; padding-inline-start: 18px; }\n.am-tree-list li::before { content: ""; position: absolute; inset-inline-start: 0; top: 0.95em; width: 12px; border-top: 1px solid var(--ink-3); }\n.am-tree-list li::after { content: ""; position: absolute; inset-inline-start: 0; top: 0; bottom: 0; border-inline-start: 1px solid var(--ink-3); }\n.am-tree-list li:last-child::after { bottom: auto; height: 0.95em; }\n.am-tree-tag { font: 11px var(--font-mono); color: var(--ink-3); margin-inline-end: 4px; }\n.am-tree code { font: 12px var(--font-mono); }\n.am-tree-sub { display: block; font-size: 11.5px; color: var(--ink-2); }\n.am-tree-hi > .am-tree-label { color: var(--accent); font-weight: 600; }\n\n/* \u2500\u2500 Diagrams (flow / sequence) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.am-diagram { margin: 0; overflow-x: auto; text-align: center; }\n/* Embedded previews can lose html[data-theme]; the fallbacks keep diagrams readable, and defined theme variables still win. */\n.am-diagram svg { max-width: 100%; height: auto; font-family: var(--font-sans, sans-serif); }\n.am-diagram text { fill: var(--ink, #16181d); font-size: 13px; }\n.am-node-shape { fill: var(--paper, #ffffff); stroke: var(--line, #1d2026); stroke-width: var(--bw, 1.5px); }\n.am-node--hi .am-node-shape { fill: var(--accent-bg, #e4ecf8); stroke: var(--accent, #1d5fbf); }\n.am-node--hi text { fill: var(--accent, #1d5fbf); font-weight: 600; }\n.am-edge { fill: none; stroke: var(--ink-2, #4b5260); stroke-width: 1.3; }\n.am-edge--dashed { stroke-dasharray: 5 4; }\n.am-arrow { fill: var(--ink-2, #4b5260); }\n.am-edge-label rect { fill: var(--paper, #ffffff); }\n.am-diagram .am-edge-label text { fill: var(--accent, #1d5fbf); font-size: 11.5px; }\n.am-cluster { fill: var(--fill, #f3f5f8); stroke: var(--line-2, #d6dae1); stroke-width: 1; stroke-dasharray: 4 3; }\n.am-diagram .am-cluster-label { fill: var(--ink-2, #4b5260); font: 11px var(--font-mono, monospace); }\n.am-lifeline { stroke: var(--ink-3, #8b929e); stroke-width: 1; stroke-dasharray: 4 4; }\n.am-actor { fill: var(--paper, #ffffff); stroke: var(--line, #1d2026); stroke-width: var(--bw, 1.5px); }\n.am-note { fill: var(--warn-bg, #fdf3e2); stroke: var(--warn, #a8620a); stroke-width: 1; }\n.am-diagram .am-step { fill: var(--ink-3, #8b929e); font: 10px var(--font-mono, monospace); }\n\n.am-diagram-expand {\n  /* In flow and sticky: it sits at the end edge (right on a left-to-right page) and stays in view when the diagram scrolls sideways.\n     It takes its own row above the drawing, so it never covers a node at the top-right corner of the drawing. */\n  position: sticky; inset-inline-start: calc(100% - 36px); z-index: 2;\n  display: flex; align-items: center; justify-content: center;\n  width: 28px; height: 28px; padding: 0; margin: 0 0 4px; margin-inline: auto 8px;\n  color: var(--ink-2); background: var(--paper);\n  border: var(--bw, 1px) solid var(--line-2); border-radius: var(--radius);\n  cursor: pointer; opacity: 0.72;\n  transition: opacity 0.15s, color 0.15s, border-color 0.15s, background 0.15s;\n}\n.am-diagram:hover .am-diagram-expand,\n.am-diagram-expand:focus-visible { opacity: 1; }\n.am-diagram-expand:hover {\n  opacity: 1; color: var(--ink); border-color: var(--accent); background: var(--fill);\n}\n.am-diagram-expand:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }\n\n/* \u2500\u2500 Diagram Lightbox and Pan-Zoom Viewer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.am-lightbox {\n  position: fixed; inset: 0; z-index: 1000;\n  display: flex; flex-direction: column;\n  touch-action: none;\n}\n.am-lightbox[hidden] { display: none !important; }\n\n.am-lightbox-backdrop {\n  position: absolute; inset: 0;\n  background: rgba(0, 0, 0, 0.72);\n  backdrop-filter: blur(6px);\n  -webkit-backdrop-filter: blur(6px);\n}\n\n.am-lightbox-header {\n  position: absolute; top: 12px; left: 24px; right: 24px; height: 36px;\n  display: flex; align-items: center; justify-content: space-between;\n  z-index: 10; pointer-events: none;\n}\n.am-lightbox-title {\n  display: inline-flex; align-items: center; gap: 8px;\n  color: rgba(255, 255, 255, 0.92);\n  font: 13px/1 var(--font-sans, sans-serif); font-weight: 500;\n  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);\n  pointer-events: auto;\n  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60vw;\n}\n.am-lightbox-title svg { stroke: rgba(255, 255, 255, 0.85); flex-shrink: 0; }\n.am-lightbox-actions {\n  display: flex; align-items: center; gap: 8px; pointer-events: auto;\n}\n.am-lightbox-close {\n  width: 32px; height: 32px;\n  background: var(--paper);\n  border: var(--bw, 1px) solid var(--line-2);\n  border-radius: 50%;\n  color: var(--ink);\n  font-size: 15px; line-height: 1;\n  cursor: pointer;\n  display: flex; align-items: center; justify-content: center;\n  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);\n  transition: background 0.15s, color 0.15s, transform 0.15s, border-color 0.15s;\n}\n.am-lightbox-close:hover {\n  color: var(--accent); border-color: var(--accent); background: var(--fill); transform: scale(1.05);\n}\n.am-lightbox-close:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }\n\n.am-lightbox-stage {\n  position: absolute;\n  top: 54px; bottom: 20px; left: 24px; right: 24px;\n  background: var(--paper);\n  border: var(--bw, 1px) solid var(--line-2);\n  border-radius: max(var(--radius), 14px);\n  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);\n  overflow: hidden;\n  cursor: grab;\n  user-select: none;\n  -webkit-user-select: none;\n}\n.am-lightbox-stage.am-panning { cursor: grabbing; }\n\n.am-lightbox-canvas {\n  position: absolute; left: 0; top: 0;\n  transform-origin: 0 0;\n  will-change: transform;\n  pointer-events: none;\n}\n.am-lightbox-canvas svg {\n  max-width: none !important;\n  max-height: none !important;\n  display: block;\n  font-family: var(--font-sans, sans-serif);\n}\n\n/* \u2500\u2500 doc template \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.am-doc { max-width: 1120px; margin: 0 auto; padding: 40px 28px 64px; }\n.am-doc-layout { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 32px; align-items: start; }\n.am-doc-layout--notoc { grid-template-columns: minmax(0, 1fr); max-width: 860px; }\n.am-toc { position: sticky; top: 24px; font-size: 13px; }\n.am-toc a { display: block; color: var(--ink-2); text-decoration: none; padding: 4px 0; padding-inline-start: 10px; border-inline-start: 2px solid var(--line-2); }\n.am-toc a:hover { color: var(--ink); border-inline-start-color: var(--accent); }\n.am-doc-body > .am-panel + .am-panel { margin-top: 20px; }\n\n/* \u2500\u2500 Responsive and print \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n@media (max-width: 1100px) {\n  .am-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n  .am-grid > .am-panel { grid-column: auto !important; }\n  .am-grid > .am-panel.am-span-wide { grid-column: 1 / -1 !important; }\n}\n@media (max-width: 760px) {\n  .am-sheet, .am-doc { padding: 56px 12px 24px; }\n  .am-head { padding-inline-end: 0; }\n  .am-grid { grid-template-columns: minmax(0, 1fr); }\n  .am-grid > .am-panel.am-span-wide { grid-column: auto !important; }\n  .am-doc-layout { grid-template-columns: minmax(0, 1fr); }\n  .am-toc { position: static; }\n  .am-tree-cols { grid-template-columns: minmax(0, 1fr); }\n  /* Tables and diagrams keep their size: the wrapper scrolls horizontally when they overflow. A cell is never narrower than about\n     two short words, so a phone does not stack them one per line. On wider screens the sheet layout (src/runtime/layout-dom.js)\n     gives a table panel the width its columns read well at. */\n  .am-md th, .am-md td { min-width: 8em; }\n  .am-diagram svg { max-width: none; }\n  .am-lightbox-header { top: 8px; left: 12px; right: 12px; }\n  .am-lightbox-stage { top: 46px; bottom: 12px; left: 12px; right: 12px; border-radius: max(var(--radius), 10px); }\n}\n.am-colophon { text-align: center; padding: 0 0 28px; font: 11px var(--font-mono); color: var(--ink-3); }\n.am-colophon a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }\n\n@media print {\n  .am-toolbar, .am-diagram-expand, .am-lightbox, .am-code-copy, .am-comment-btn, .am-comment, .am-reply { display: none !important; }\n  body { background: var(--paper); }\n  .am-panel { break-inside: avoid; box-shadow: none; }\n}\n/* Printed on paper narrower than three columns, the two-column grid left a hole beside every panel next to a full-width one\n   (a wide table, a wide diagram): one panel per row instead. */\n@media print and (max-width: 1100px) {\n  .am-grid { grid-template-columns: minmax(0, 1fr); }\n  .am-grid > .am-panel { grid-column: auto !important; }\n}\n.am-panel--bare { border: 0; background: transparent; box-shadow: none; }\n.am-panel--bare > .am-panel-body { padding: 0; }\n.am-panel--bare .am-kv { background: var(--paper); }\n';
var RUNTIME_JS = "";
var RTL_JS = "";
var DIFF_CSS = "/* Diff block (only on pages that have one): red and green lines, a hunk row, and two gutters, old and new, drawn from data-o / data-n.\n   The hues are fixed and mixed into the theme's own --fill and --ink, so they read as green and red in every theme, light and dark. */\n.am-codeblock--diff { --diff-add: #1f9d4d; --diff-del: #d1344a; }\n.am-code-stat { display: inline-flex; gap: 6px; flex: none; font: 12px/1.3 var(--font-mono); }\n.am-code-stat-add { color: color-mix(in srgb, var(--diff-add) 75%, var(--ink)); }\n.am-code-stat-del { color: color-mix(in srgb, var(--diff-del) 75%, var(--ink)); }\n.am-code--diff .am-ln { display: flex; padding: 0 14px 0 0; }\n.am-code--diff:not(.am-code--dnum) .am-ln { padding-left: 14px; }\n.am-code--dnum .am-ln::before, .am-code--dnum .am-ln::after {\n  flex: none; box-sizing: content-box; width: 3.5ch; padding: 0 6px; text-align: right; color: var(--ink-3);\n  user-select: none; -webkit-user-select: none;\n}\n.am-code--dnum .am-ln::before { content: attr(data-o); order: -2; }\n.am-code--dnum .am-ln::after { content: attr(data-n); order: -1; margin-right: 10px; }\n.am-ln--add { background: color-mix(in srgb, var(--diff-add) 14%, var(--fill)); }\n.am-ln--del { background: color-mix(in srgb, var(--diff-del) 14%, var(--fill)); }\n.am-ln--add::before, .am-ln--add::after { background: color-mix(in srgb, var(--diff-add) 28%, var(--fill)); }\n.am-ln--del::before, .am-ln--del::after { background: color-mix(in srgb, var(--diff-del) 28%, var(--fill)); }\n.am-code--diff .am-ln--hl { box-shadow: none; }\n.am-code--diff .am-ln--hl::before { box-shadow: inset 3px 0 0 var(--accent); }\n.am-code--diff .am-ln--ctx.am-ln--hl { background: var(--accent-bg); }\n.am-code--diff .am-ln--hunk { display: block; min-height: 0; padding: 1px 14px; font-size: 11.5px; color: var(--ink-3); background: color-mix(in srgb, var(--accent) 8%, var(--fill)); }\n.am-code--dnum .am-ln--hunk::before, .am-code--dnum .am-ln--hunk::after { content: none; }\n.am-code--diff .am-ln--meta { display: none; }\n";
var DELTA_CSS = `/* Change markers (only on pages that have one). Only the Changes view (.am-view-changes) draws change styling: colors, strike-through, faded items
   and badges. Before and After look like a plain diagram, and the items that do not exist in the view are hidden.
   The colors are the theme's --ok, --err and --warn, so every theme and mode works. A view hides items with visibility, so nothing moves. */
.am-view-before [data-delta="added"], .am-view-after [data-delta="removed"] { visibility: hidden; }
.am-view-before .am-delta-badge, .am-view-after .am-delta-badge { visibility: hidden; }
/* A list label's badge is inline and would indent the label like a nesting level, so there it takes no space; the other badges are positioned and move nothing. */
.am-view-before .am-tree-label > .am-delta-badge, .am-view-after .am-tree-label > .am-delta-badge { display: none; }

.am-delta-badge--added { --badge: var(--ok, #1f9d4d); }
.am-delta-badge--removed { --badge: var(--err, #c62828); }
.am-delta-badge--changed { --badge: var(--warn, #a8620a); }

/* flow */
.am-view-changes .am-node[data-delta="added"] .am-node-shape { stroke: var(--ok, #1f9d4d); }
.am-view-changes .am-node[data-delta="removed"] .am-node-shape { stroke: var(--err, #c62828); }
.am-view-changes .am-node[data-delta="changed"] .am-node-shape { stroke: var(--warn, #a8620a); }
.am-view-changes .am-node[data-delta="added"] > text { fill: var(--ok, #1f9d4d); }
.am-view-changes .am-node[data-delta="removed"] > text { fill: var(--err, #c62828); }
.am-view-changes [data-delta="added"] > .am-edge { stroke: var(--ok, #1f9d4d); }
.am-view-changes [data-delta="removed"] > .am-edge { stroke: var(--err, #c62828); }
.am-view-changes .am-arrow--added { fill: var(--ok, #1f9d4d); }
.am-view-changes .am-arrow--removed { fill: var(--err, #c62828); }
.am-view-changes [data-delta="added"] > .am-edge-label text { fill: var(--ok, #1f9d4d); }
.am-view-changes [data-delta="removed"] > .am-edge-label text { fill: var(--err, #c62828); }
.am-view-changes .am-cluster[data-delta="added"] { stroke: var(--ok, #1f9d4d); }
.am-view-changes .am-cluster[data-delta="removed"] { stroke: var(--err, #c62828); }
.am-view-changes .am-cluster-label[data-delta="added"] { fill: var(--ok, #1f9d4d); }
.am-view-changes .am-cluster-label[data-delta="removed"] { fill: var(--err, #c62828); }
.am-view-changes g[data-delta="removed"]:not(.am-delta-badge), .am-view-changes .am-cluster[data-delta="removed"], .am-view-changes .am-cluster-label[data-delta="removed"] { opacity: 0.55; }
.am-view-changes .am-node[data-delta="removed"] > text, .am-view-changes g[data-delta="removed"] > .am-edge-label text, .am-view-changes .am-cluster-label[data-delta="removed"] { text-decoration: line-through; }
.am-diagram .am-delta-badge circle { fill: var(--badge); stroke: var(--paper, #ffffff); stroke-width: 1.5; }
.am-diagram .am-delta-badge text { fill: var(--paper, #ffffff); font: 700 11px var(--font-sans, sans-serif); text-decoration: none; }

/* er: entities and relationships use the flow rules above (an entity is an .am-node, a relationship path and its end marks are .am-edge). A marked field row adds a tinted band,
   colored text and its sign at the start of the row; Before and After show a plain schema, so the bands and signs hide there and the rows keep their place. */
.am-view-before .am-er-band, .am-view-after .am-er-band, .am-view-before .am-er-sign, .am-view-after .am-er-sign { visibility: hidden; }
.am-er-sign { font-weight: 700; }
.am-view-changes .am-er-band[data-delta="added"] { fill: var(--ok-bg); }
.am-view-changes .am-er-band[data-delta="removed"] { fill: var(--err-bg); }
.am-view-changes .am-er-band[data-delta="changed"] { fill: var(--warn-bg); }
.am-view-changes .am-er-sign[data-delta="added"], .am-view-changes .am-er-field[data-delta="added"], .am-view-changes .am-er-key[data-delta="added"] { fill: var(--ok); }
.am-view-changes .am-er-sign[data-delta="removed"], .am-view-changes .am-er-field[data-delta="removed"], .am-view-changes .am-er-key[data-delta="removed"] { fill: var(--err); }
.am-view-changes .am-er-sign[data-delta="changed"], .am-view-changes .am-er-field[data-delta="changed"], .am-view-changes .am-er-key[data-delta="changed"] { fill: var(--warn); }
.am-view-changes .am-er-field[data-delta="removed"] { text-decoration: line-through; }
.am-view-changes .am-node .am-er-sign[data-delta] { text-decoration: none; }

/* tree */
.am-tree .am-delta-badge {
  display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: 15px; height: 15px; flex: none;
  border-radius: 50%; background: var(--badge); color: var(--paper); font: 700 11px/1 var(--font-mono, monospace); text-decoration: none;
}
.am-tree-box[data-delta] { position: relative; }
.am-tree-box > .am-delta-badge { position: absolute; top: -8px; inset-inline-end: -8px; }
.am-tree-label > .am-delta-badge { margin-inline-end: 6px; vertical-align: 1px; }
.am-view-changes .am-tree-box[data-delta="added"] { border-color: var(--ok); }
.am-view-changes .am-tree-box[data-delta="removed"] { border-color: var(--err); opacity: 0.55; text-decoration: line-through; }
.am-view-changes .am-tree-box[data-delta="changed"] { border-color: var(--warn); }
.am-view-changes .am-tree-list li[data-delta="added"] > .am-tree-label { color: var(--ok); }
.am-view-changes .am-tree-list li[data-delta="removed"] > .am-tree-label { color: var(--err); text-decoration: line-through; }
.am-view-changes .am-tree-list li[data-delta="changed"] > .am-tree-label { color: var(--warn); }
.am-view-changes .am-tree-list li[data-delta="removed"] > .am-tree-label, .am-view-changes .am-tree-list li[data-delta="removed"] > .am-tree-sub { opacity: 0.55; }

/* Connector lines in a view that hides siblings. A hidden node keeps its stretch of the line, so the line stays whole between the nodes that remain and
   stops at the last one; the markup (data-line-before / data-line-after, see src/components/tree.js) names the stretches that differ from the usual look. */
.am-view-before .am-tree-list li::after, .am-view-after .am-tree-list li::after,
.am-view-before .am-tree-col::before, .am-view-after .am-tree-col::before { visibility: visible; }
.am-view-before .am-tree-list li[data-line-before="full"]::after, .am-view-after .am-tree-list li[data-line-after="full"]::after { bottom: 0; height: auto; }
.am-view-before .am-tree-list li[data-line-before="short"]::after, .am-view-after .am-tree-list li[data-line-after="short"]::after { bottom: auto; height: 0.95em; }
.am-view-before .am-tree-list li[data-line-before="none"]::after, .am-view-after .am-tree-list li[data-line-after="none"]::after,
.am-view-before .am-tree-col[data-line-before="none"]::before, .am-view-after .am-tree-col[data-line-after="none"]::before,
.am-view-before .am-tree-root[data-line-before="none"]::after, .am-view-after .am-tree-root[data-line-after="none"]::after { display: none; }
.am-view-before .am-tree-col[data-line-before="full"]::before, .am-view-after .am-tree-col[data-line-after="full"]::before { inset-inline: 0; }
.am-view-before .am-tree-col[data-line-before="start"]::before, .am-view-after .am-tree-col[data-line-after="start"]::before { inset-inline: 50% 0; }
.am-view-before .am-tree-col[data-line-before="end"]::before, .am-view-after .am-tree-col[data-line-after="end"]::before { inset-inline: 0 50%; }

/* the count row and the switch */
.am-delta-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin-top: 10px; text-align: start; font: 12px/1.3 var(--font-mono, monospace); }
.am-delta-count--added { color: var(--ok); }
.am-delta-count--removed { color: var(--err); }
.am-delta-count--changed { color: var(--warn); }
.am-delta-switch { display: inline-flex; margin-inline-start: auto; border: var(--bw, 1px) solid var(--line-2); border-radius: var(--radius); overflow: hidden; }
.am-delta-switch[hidden] { display: none; }
.am-delta-switch button { font: inherit; padding: 3px 10px; color: var(--ink-2); background: var(--paper); border: 0; border-inline-start: 1px solid var(--line-2); cursor: pointer; }
.am-delta-switch button:first-child { border-inline-start: 0; }
.am-delta-switch button[aria-pressed="true"] { color: var(--ink); background: var(--accent-bg); font-weight: 600; }
.am-delta-switch button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
@media print { .am-delta-switch { display: none !important; } }
`;
var RTL_CSS = '/* Right-to-left pages (html[dir="rtl"]: Hebrew, Arabic, Persian, Urdu, Yiddish). base.css uses logical properties, so the layout\n   mirrors by itself; this file holds only what logical properties cannot say. A left-to-right page never carries it. */\n\n/* Code, diffs and paths read left to right in every language. Inline code is isolated, so the text around it keeps its order. */\nhtml[dir="rtl"] .am-codeblock, html[dir="rtl"] .am-code, html[dir="rtl"] pre { direction: ltr; text-align: left; }\nhtml[dir="rtl"] :not(pre) > code { direction: ltr; unicode-bidi: isolate; }\n\n/* Small labels use the monospace font. No common monospace font has Hebrew or Arabic letters, so the browser borrows a fixed-width\n   fallback that spaces the letters apart; letter spacing and capitals also break these scripts. Labels use the sans font instead. */\nhtml[dir="rtl"] .am-md th, html[dir="rtl"] .am-kv dt, html[dir="rtl"] .am-head-meta b, html[dir="rtl"] .am-panel-meta,\nhtml[dir="rtl"] .am-annot-meta, html[dir="rtl"] .am-tree-tag, html[dir="rtl"] .am-timeline--v .am-tl-when,\nhtml[dir="rtl"] .am-diagram .am-cluster-label, html[dir="rtl"] .am-delta-bar, html[dir="rtl"] .am-lim-val,\nhtml[dir="rtl"] .am-colophon, html[dir="rtl"] .am-reply textarea {\n  font-family: var(--font-sans); letter-spacing: normal; text-transform: none;\n}\nhtml[dir="rtl"] .am-head h1 { letter-spacing: normal; }\n/* The annotated sentence is set in the sans font too; src/components/annot.js measures the placement of its notes in that font. */\nhtml[dir="rtl"] .am-annot-line { font-family: var(--font-sans); }\n\n/* Diagram text: the drawing is already mirrored (src/components/flow.js, sequence.js); the text inside reads right to left. */\nhtml[dir="rtl"] .am-diagram svg { direction: rtl; }\n\n/* Limits scale: the ticks are placed from the right (src/components/limits.js), so each one centres on its point from that side. */\nhtml[dir="rtl"] .am-lim-ticks span { transform: translateX(50%); }\nhtml[dir="rtl"] .am-lim-ticks span:first-child { transform: none; }\n\n/* The limits value is written in the page language (src/languages/he.js: "420 of 1000 KB" in Hebrew words), so it reads right to left\n   like the label. The label, its note and the value are isolated from each other: "Redis" at the end of a label and "70%" at the\n   start of its note would otherwise run together as one left-to-right piece. */\nhtml[dir="rtl"] .am-lim-head > span, html[dir="rtl"] .am-lim-note, html[dir="rtl"] .am-lim-val { unicode-bidi: isolate; }\n\n/* Horizontal timeline: a date written the Hebrew way (15.11.2026) is wider than a year, and in a narrow panel the dates of\n   neighbouring items ran into each other ("1.12.202615.11.2026"). The date shrinks to fit its column, never above its usual 15px. */\nhtml[dir="rtl"] .am-timeline--h .am-tl-when { font-size: min(15px, calc(100cqi / var(--n, 1) / 6.2)); white-space: nowrap; }\n@container (max-width: 560px) {\n  html[dir="rtl"] .am-timeline--h .am-tl-when { font-size: 15px; }\n}\n\n/* Reply sheet: a textarea gives the whole Markdown reply one direction, so "1. [E] ..." and "# Re: ..." came out reordered.\n   src/runtime/reply-view.js draws the reply instead, each line in its own direction; the textarea stays as the copy source. */\nhtml[dir="rtl"] .am-reply--view textarea {\n  position: absolute; width: 1px; height: 1px; padding: 0; border: 0; opacity: 0; pointer-events: none; resize: none;\n}\nhtml[dir="rtl"] .am-reply-view {\n  max-height: min(60vh, 26em); overflow: auto; padding: 10px 12px; font: 14px/1.6 var(--font-sans); color: var(--ink);\n  background: var(--paper); border: 1px solid var(--line-2); border-radius: var(--radius); overflow-wrap: anywhere;\n}\nhtml[dir="rtl"] .am-reply-view:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }\nhtml[dir="rtl"] .am-reply-view > div { text-align: start; unicode-bidi: isolate; }\nhtml[dir="rtl"] .am-rv-gap { height: .5em; }\nhtml[dir="rtl"] .am-rv-h1 { font-weight: 700; font-size: 15px; }\nhtml[dir="rtl"] .am-rv-h2 { font-weight: 700; color: var(--ink-2); margin-top: 2px; }\nhtml[dir="rtl"] .am-rv-tag {\n  display: inline-block; min-width: 1.6em; padding: 0 4px; font-size: 12px; line-height: 1.5; text-align: center;\n  color: var(--ink-2); border: 1px solid var(--line-2); border-radius: var(--radius);\n}\nhtml[dir="rtl"] .am-rv-a { padding-inline-start: 1.6em; }\nhtml[dir="rtl"] .am-rv-a em { color: var(--ink-2); }\nhtml[dir="rtl"] .am-rv-quote { margin-inline-start: 1em; padding-inline-start: 10px; border-inline-start: 3px solid var(--line-2); color: var(--ink-2); white-space: pre-wrap; }\n';
var DELTA_JS = "";
var zh_default = {
  id: "zh",
  language: "zh",
  script: "Hans",
  voice: { say: "zh_CN", espeak: "cmn" },
  ui: {
    theme: "\u4E3B\u9898",
    modeLabel: "\u660E\u6697",
    mode: { auto: "\u8DDF\u968F\u7CFB\u7EDF", light: "\u4EAE", dark: "\u6697" },
    copy: "\u590D\u5236\u6E90\u7A3F",
    done: "\u5DF2\u590D\u5236 \u2713",
    copyCode: "\u590D\u5236",
    reply: {
      button: "\u56DE\u590D",
      comment: "\u8BC4\u8BBA",
      commentHint: "\u5BF9\u8FD9\u4E2A\u9762\u677F\u7684\u610F\u89C1",
      title: "\u4F60\u7684\u56DE\u590D",
      hint: "\u590D\u5236\u540E\u7C98\u8D34\u5230\u5BF9\u8BDD\u91CC\u3002",
      copy: "\u590D\u5236\u56DE\u590D",
      close: "\u5173\u95ED",
      suggested: "\u5EFA\u8BAE",
      empty: "\u5148\u9009\u62E9\u9009\u9879\uFF0C\u6216\u5728\u9762\u677F\u4E0A\u5199\u8BC4\u8BBA\u3002",
      decisions: "\u51B3\u5B9A",
      comments: "\u8BC4\u8BBA",
      confirmed: "\u786E\u8BA4\u4E86\u5EFA\u8BAE",
      untouched: "\u672A\u4F5C\u7B54\uFF0C\u4FDD\u7559\u5EFA\u8BAE",
      was: "\u539F\u4E3A",
      typed: '\u4EE5 ">" \u5F00\u5934\u7684\u884C\u662F\u8BFB\u8005\u8F93\u5165\u7684\u6587\u5B57\u3002'
    },
    toc: "\u76EE\u5F55",
    flow: "\u6D41\u7A0B\u56FE",
    sequence: "\u65F6\u5E8F\u56FE",
    er: "\u5B9E\u4F53\u5173\u7CFB\u56FE",
    colon: "\uFF1A",
    sep: "\u3001",
    expand: "\u5C55\u5F00\u67E5\u770B\u56FE\u8868",
    close: "\u5173\u95ED",
    diagram: "\u56FE\u8868\u67E5\u770B",
    delta: { added: "\u65B0\u589E", removed: "\u5220\u9664", changed: "\u4FEE\u6539", view: "\u89C6\u56FE", before: "\u6539\u524D", changes: "\u53D8\u66F4", after: "\u6539\u540E" },
    generated: "Generated by",
    limits: { value: "{value} / max {limit}", limit: "max {limit}" }
  },
  videoUi: { play: "\u64AD\u653E", pause: "\u6682\u505C", chapters: "\u7AE0\u8282", speed: "\u901F\u5EA6", export: "\u5BFC\u51FA" }
};
var zh_Hant_default = {
  id: "zh-Hant",
  language: "zh",
  script: "Hant",
  voice: { say: "zh_TW", espeak: "cmn" },
  langs: ["zh-Hant", "zh-TW", "zh-HK", "zh-MO"],
  fonts: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Heiti TC", "Microsoft JhengHei", "Noto Sans CJK TC", "Noto Sans TC", "PingFang SC", "Microsoft YaHei", Roboto, "Helvetica Neue", Arial, sans-serif',
    serif: '"Songti TC", "PMingLiU", "MingLiU", "Noto Serif CJK TC", "Noto Serif TC", "Source Han Serif TC", "Songti SC"'
  },
  ui: {
    theme: "\u4E3B\u984C",
    modeLabel: "\u660E\u6697",
    mode: { auto: "\u8DDF\u96A8\u7CFB\u7D71", light: "\u6DFA\u8272", dark: "\u6DF1\u8272" },
    copy: "\u8907\u88FD\u6E90\u7A3F",
    done: "\u5DF2\u8907\u88FD \u2713",
    copyCode: "\u8907\u88FD",
    reply: {
      button: "\u56DE\u8986",
      comment: "\u8A55\u8AD6",
      commentHint: "\u5C0D\u9019\u500B\u9762\u677F\u7684\u610F\u898B",
      title: "\u4F60\u7684\u56DE\u8986",
      hint: "\u8907\u88FD\u5F8C\u8CBC\u5230\u5C0D\u8A71\u88E1\u3002",
      copy: "\u8907\u88FD\u56DE\u8986",
      close: "\u95DC\u9589",
      suggested: "\u5EFA\u8B70",
      empty: "\u5148\u9078\u64C7\u9078\u9805\uFF0C\u6216\u5728\u9762\u677F\u4E0A\u5BEB\u8A55\u8AD6\u3002",
      decisions: "\u6C7A\u5B9A",
      comments: "\u8A55\u8AD6",
      confirmed: "\u78BA\u8A8D\u4E86\u5EFA\u8B70",
      untouched: "\u672A\u4F5C\u7B54\uFF0C\u4FDD\u7559\u5EFA\u8B70",
      was: "\u539F\u70BA",
      typed: '\u4EE5 ">" \u958B\u982D\u7684\u884C\u662F\u8B80\u8005\u8F38\u5165\u7684\u6587\u5B57\u3002'
    },
    toc: "\u76EE\u9304",
    flow: "\u6D41\u7A0B\u5716",
    sequence: "\u6642\u5E8F\u5716",
    er: "\u5BE6\u9AD4\u95DC\u806F\u5716",
    colon: "\uFF1A",
    sep: "\u3001",
    expand: "\u5C55\u958B\u67E5\u770B\u5716\u8868",
    close: "\u95DC\u9589",
    diagram: "\u5716\u8868\u6AA2\u8996",
    delta: { added: "\u65B0\u589E", removed: "\u522A\u9664", changed: "\u4FEE\u6539", view: "\u6AA2\u8996", before: "\u6539\u524D", changes: "\u8B8A\u66F4", after: "\u6539\u5F8C" },
    generated: "Generated by",
    limits: { value: "{value} / max {limit}", limit: "max {limit}" }
  },
  videoUi: { play: "\u64AD\u653E", pause: "\u66AB\u505C", chapters: "\u7AE0\u7BC0", speed: "\u901F\u5EA6", export: "\u532F\u51FA" }
};
var en_default = {
  id: "en",
  language: "en",
  voice: { say: "en_US", espeak: "en-us" },
  ui: {
    theme: "Theme",
    modeLabel: "Mode",
    mode: { auto: "Auto", light: "Light", dark: "Dark" },
    copy: "Copy source",
    done: "Copied \u2713",
    copyCode: "Copy",
    reply: {
      button: "Reply",
      comment: "Comment",
      commentHint: "Your comment on this panel",
      title: "Your reply",
      hint: "Copy it and paste it into the chat.",
      copy: "Copy reply",
      close: "Close",
      suggested: "suggested",
      empty: "Pick options, or comment on a panel first.",
      decisions: "Decisions",
      comments: "Comments",
      confirmed: "suggestion confirmed",
      untouched: "not answered; suggestion kept",
      was: "was",
      typed: 'Lines that start with ">" are text the reader typed.'
    },
    toc: "Contents",
    flow: "Flowchart",
    sequence: "Sequence diagram",
    er: "Entity relationship diagram",
    colon: ": ",
    sep: ", ",
    expand: "Expand diagram",
    close: "Close",
    diagram: "Diagram viewer",
    delta: { added: "added", removed: "removed", changed: "changed", view: "View", before: "Before", changes: "Changes", after: "After" },
    generated: "Generated by",
    limits: { value: "{value} / max {limit}", limit: "max {limit}" }
  },
  videoUi: { play: "Play", pause: "Pause", chapters: "Chapters", speed: "Speed", export: "Export" }
};
var ja_default = {
  id: "ja",
  language: "ja",
  voice: { say: "ja_JP", espeak: "ja" },
  langs: ["ja"],
  fonts: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", Meiryo, "Noto Sans CJK JP", "Noto Sans JP", "PingFang SC", "Microsoft YaHei", Roboto, "Helvetica Neue", Arial, sans-serif',
    serif: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", "Noto Serif JP", "Songti SC"'
  },
  ui: {
    theme: "\u30C6\u30FC\u30DE",
    modeLabel: "\u8868\u793A",
    mode: { auto: "\u81EA\u52D5", light: "\u30E9\u30A4\u30C8", dark: "\u30C0\u30FC\u30AF" },
    copy: "\u539F\u7A3F\u3092\u30B3\u30D4\u30FC",
    done: "\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F \u2713",
    copyCode: "\u30B3\u30D4\u30FC",
    reply: {
      button: "\u8FD4\u4FE1",
      comment: "\u30B3\u30E1\u30F3\u30C8",
      commentHint: "\u3053\u306E\u30D1\u30CD\u30EB\u3078\u306E\u30B3\u30E1\u30F3\u30C8",
      title: "\u3042\u306A\u305F\u306E\u8FD4\u4FE1",
      hint: "\u30B3\u30D4\u30FC\u3057\u3066\u30C1\u30E3\u30C3\u30C8\u306B\u8CBC\u308A\u4ED8\u3051\u3066\u304F\u3060\u3055\u3044\u3002",
      copy: "\u8FD4\u4FE1\u3092\u30B3\u30D4\u30FC",
      close: "\u9589\u3058\u308B",
      suggested: "\u63A8\u5968",
      empty: "\u9078\u629E\u80A2\u3092\u9078\u3076\u304B\u3001\u30D1\u30CD\u30EB\u306B\u30B3\u30E1\u30F3\u30C8\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
      decisions: "\u6C7A\u5B9A",
      comments: "\u30B3\u30E1\u30F3\u30C8",
      confirmed: "\u63A8\u5968\u3092\u78BA\u8A8D",
      untouched: "\u672A\u56DE\u7B54\uFF08\u63A8\u5968\u306E\u307E\u307E\uFF09",
      was: "\u5909\u66F4\u524D",
      typed: "\u300C>\u300D\u3067\u59CB\u307E\u308B\u884C\u306F\u8AAD\u8005\u304C\u5165\u529B\u3057\u305F\u6587\u5B57\u3067\u3059\u3002"
    },
    toc: "\u76EE\u6B21",
    flow: "\u30D5\u30ED\u30FC\u30C1\u30E3\u30FC\u30C8",
    sequence: "\u30B7\u30FC\u30B1\u30F3\u30B9\u56F3",
    er: "ER \u56F3",
    colon: "\uFF1A",
    sep: "\u3001",
    expand: "\u62E1\u5927\u8868\u793A",
    close: "\u9589\u3058\u308B",
    diagram: "\u30C0\u30A4\u30A2\u30B0\u30E9\u30E0",
    delta: { added: "\u8FFD\u52A0", removed: "\u524A\u9664", changed: "\u5909\u66F4", view: "\u8868\u793A", before: "\u5909\u66F4\u524D", changes: "\u5DEE\u5206", after: "\u5909\u66F4\u5F8C" },
    generated: "Generated by",
    limits: { value: "{value} / max {limit}", limit: "max {limit}" }
  },
  videoUi: { play: "\u518D\u751F", pause: "\u4E00\u6642\u505C\u6B62", chapters: "\u7AE0", speed: "\u901F\u5EA6", export: "\u66F8\u304D\u51FA\u3057" }
};
var he_default = {
  id: "he",
  language: "he",
  langs: ["he"],
  fonts: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Hebrew", "Arial Hebrew", Arial, Roboto, "Helvetica Neue", sans-serif',
    serif: '"Noto Serif Hebrew", "Frank Ruehl CLM", David, "Times New Roman"'
  },
  ui: {
    theme: "\u05E2\u05E8\u05DB\u05EA \u05E2\u05D9\u05E6\u05D5\u05D1",
    modeLabel: "\u05DE\u05E6\u05D1",
    mode: { auto: "\u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9", light: "\u05D1\u05D4\u05D9\u05E8", dark: "\u05DB\u05D4\u05D4" },
    copy: "\u05D4\u05E2\u05EA\u05E7\u05EA \u05D4\u05DE\u05E7\u05D5\u05E8",
    done: "\u05D4\u05D5\u05E2\u05EA\u05E7 \u2713",
    copyCode: "\u05D4\u05E2\u05EA\u05E7\u05D4",
    reply: {
      button: "\u05EA\u05D2\u05D5\u05D1\u05D4",
      comment: "\u05D4\u05E2\u05E8\u05D4",
      commentHint: "\u05D4\u05D4\u05E2\u05E8\u05D4 \u05E9\u05DC\u05DA \u05E2\u05DC \u05D4\u05D7\u05DC\u05E7 \u05D4\u05D6\u05D4",
      title: "\u05D4\u05EA\u05D2\u05D5\u05D1\u05D4 \u05E9\u05DC\u05DA",
      hint: "\u05D4\u05E2\u05EA\u05D9\u05E7\u05D5 \u05D5\u05D4\u05D3\u05D1\u05D9\u05E7\u05D5 \u05D0\u05D5\u05EA\u05D4 \u05D1\u05E6\u05F3\u05D0\u05D8.",
      copy: "\u05D4\u05E2\u05EA\u05E7\u05EA \u05D4\u05EA\u05D2\u05D5\u05D1\u05D4",
      close: "\u05E1\u05D2\u05D9\u05E8\u05D4",
      suggested: "\u05DE\u05D5\u05DE\u05DC\u05E5",
      empty: "\u05E7\u05D5\u05D3\u05DD \u05D1\u05D7\u05E8\u05D5 \u05D0\u05E4\u05E9\u05E8\u05D5\u05EA \u05D0\u05D5 \u05DB\u05EA\u05D1\u05D5 \u05D4\u05E2\u05E8\u05D4 \u05E2\u05DC \u05D0\u05D7\u05D3 \u05D4\u05D7\u05DC\u05E7\u05D9\u05DD.",
      decisions: "\u05D4\u05D7\u05DC\u05D8\u05D5\u05EA",
      comments: "\u05D4\u05E2\u05E8\u05D5\u05EA",
      confirmed: "\u05D4\u05D4\u05DE\u05DC\u05E6\u05D4 \u05D0\u05D5\u05E9\u05E8\u05D4",
      untouched: "\u05DC\u05D0 \u05E0\u05E2\u05E0\u05D4; \u05D4\u05D4\u05DE\u05DC\u05E6\u05D4 \u05E0\u05E9\u05D0\u05E8\u05D4",
      was: "\u05D4\u05D9\u05D4",
      typed: '\u05E9\u05D5\u05E8\u05D5\u05EA \u05E9\u05DE\u05EA\u05D7\u05D9\u05DC\u05D5\u05EA \u05D1-">" \u05D4\u05DF \u05D8\u05E7\u05E1\u05D8 \u05E9\u05D4\u05E7\u05D5\u05E8\u05D0 \u05D4\u05E7\u05DC\u05D9\u05D3.'
    },
    toc: "\u05EA\u05D5\u05DB\u05DF \u05D4\u05E2\u05E0\u05D9\u05D9\u05E0\u05D9\u05DD",
    flow: "\u05EA\u05E8\u05E9\u05D9\u05DD \u05D6\u05E8\u05D9\u05DE\u05D4",
    sequence: "\u05EA\u05E8\u05E9\u05D9\u05DD \u05E8\u05E6\u05E3",
    er: "\u05EA\u05E8\u05E9\u05D9\u05DD \u05D9\u05E9\u05D5\u05D9\u05D5\u05EA \u05D5\u05E7\u05E9\u05E8\u05D9\u05DD",
    colon: ": ",
    sep: ", ",
    expand: "\u05D4\u05D2\u05D3\u05DC\u05EA \u05D4\u05EA\u05E8\u05E9\u05D9\u05DD",
    close: "\u05E1\u05D2\u05D9\u05E8\u05D4",
    diagram: "\u05DE\u05E6\u05D9\u05D2 \u05D4\u05EA\u05E8\u05E9\u05D9\u05DD",
    delta: { added: "\u05E0\u05D5\u05E1\u05E3", removed: "\u05D4\u05D5\u05E1\u05E8", changed: "\u05E9\u05D5\u05E0\u05D4", view: "\u05EA\u05E6\u05D5\u05D2\u05D4", before: "\u05DC\u05E4\u05E0\u05D9", changes: "\u05E9\u05D9\u05E0\u05D5\u05D9\u05D9\u05DD", after: "\u05D0\u05D7\u05E8\u05D9" },
    generated: "\u05E0\u05D5\u05E6\u05E8 \u05D1\u05D0\u05DE\u05E6\u05E2\u05D5\u05EA",
    limits: { value: "{value} \u05DE\u05EA\u05D5\u05DA {limit}", limit: "\u05E2\u05D3 {limit}" }
  },
  // Names for the frontmatter keys an agent writes most (`author: …`), shown under the title. Other keys show as written.
  metaKeys: {
    author: "\u05DE\u05D0\u05EA",
    by: "\u05DE\u05D0\u05EA",
    date: "\u05EA\u05D0\u05E8\u05D9\u05DA",
    updated: "\u05E2\u05D5\u05D3\u05DB\u05DF",
    time: "\u05E9\u05E2\u05D4",
    source: "\u05DE\u05E7\u05D5\u05E8",
    sources: "\u05DE\u05E7\u05D5\u05E8\u05D5\u05EA",
    version: "\u05D2\u05E8\u05E1\u05D4",
    status: "\u05E1\u05D8\u05D8\u05D5\u05E1",
    owner: "\u05D0\u05D7\u05E8\u05D0\u05D9",
    team: "\u05E6\u05D5\u05D5\u05EA",
    project: "\u05E4\u05E8\u05D5\u05D9\u05E7\u05D8",
    audience: "\u05E7\u05D4\u05DC \u05D9\u05E2\u05D3",
    reviewer: "\u05D1\u05D5\u05D3\u05E7",
    reviewers: "\u05D1\u05D5\u05D3\u05E7\u05D9\u05DD",
    license: "\u05E8\u05D9\u05E9\u05D9\u05D5\u05DF",
    licence: "\u05E8\u05D9\u05E9\u05D9\u05D5\u05DF",
    model: "\u05DE\u05D5\u05D3\u05DC",
    repo: "\u05E8\u05D9\u05E4\u05D5",
    branch: "\u05E2\u05E0\u05E3",
    tags: "\u05EA\u05D2\u05D9\u05D5\u05EA",
    for: "\u05E2\u05D1\u05D5\u05E8",
    ref: "\u05D4\u05E4\u05E0\u05D9\u05D4"
  },
  // The word after a change count above one ("+4 נוספו"); the ui.delta words are the singular, for one item and for a node badge.
  deltaCounts: { added: "\u05E0\u05D5\u05E1\u05E4\u05D5", removed: "\u05D4\u05D5\u05E1\u05E8\u05D5", changed: "\u05E9\u05D5\u05E0\u05D5" },
  // The render time under the page reads day.month.year, the Israeli way.
  dateOrder: "dmy",
  videoUi: { play: "\u05D4\u05E4\u05E2\u05DC\u05D4", pause: "\u05D4\u05E9\u05D4\u05D9\u05D4", chapters: "\u05E4\u05E8\u05E7\u05D9\u05DD", speed: "\u05DE\u05D4\u05D9\u05E8\u05D5\u05EA", export: "\u05D9\u05D9\u05E6\u05D5\u05D0" }
};
var LANGUAGES = Object.freeze([zh_default, zh_Hant_default, en_default, ja_default, he_default]);
var FALLBACK = en_default;
var languageIds = () => LANGUAGES.map((l3) => l3.id);
function findLanguage(language, script) {
  return LANGUAGES.find((l3) => l3.language === language && (!l3.script || l3.script === script));
}
var SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Roboto, "Helvetica Neue", Arial, sans-serif';
var MONO = 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace';
var fontLanguages = () => LANGUAGES.filter((l3) => l3.fonts);
var langSelector = (language, base, rest) => language.langs.map((tag) => `${base}:lang(${tag})${rest}`).join(", ");
var serifByLanguage = (variable, head) => fontLanguages().map((l3) => `${langSelector(l3, "&", "[data-mode]")} { ${variable}: ${head}, ${l3.fonts.serif}, serif; }`).join("\n");
var blueprint_default = {
  name: "blueprint",
  summary: "Blueprint drawing",
  label: { zh: "\u56FE\u7EB8", "zh-Hant": "\u5716\u7D19", en: "Blueprint", ja: "\u56F3\u9762", he: "\u05E9\u05E8\u05D8\u05D5\u05D8" },
  // lang-ok: viewer-facing theme labels
  scope: ["page", "video"],
  tokens: {
    common: { "--font-sans": SANS, "--font-mono": MONO, "--radius": "0px", "--shadow": "none", "--bw": "1.5px", "--head-font": "var(--font-sans)" },
    light: {
      "--bg": "#f6f6f3",
      "--paper": "#ffffff",
      "--ink": "#16181d",
      "--ink-2": "#4b5260",
      "--ink-3": "#8b929e",
      "--line": "#1d2026",
      "--line-2": "#d6dae1",
      "--fill": "#f3f5f8",
      "--accent": "#1d5fbf",
      "--accent-bg": "#e4ecf8",
      "--ok": "#1d5fbf",
      "--ok-bg": "#e4ecf8",
      "--err": "#c62828",
      "--err-bg": "#fbeaea",
      "--warn": "#a8620a",
      "--warn-bg": "#fdf3e2",
      "--head-bg": "#16181d",
      "--head-fg": "#ffffff"
    },
    dark: {
      "--bg": "#081322",
      "--paper": "#0d1c31",
      "--ink": "#e6edf7",
      "--ink-2": "#a9b8cc",
      "--ink-3": "#6b7f99",
      "--line": "#c9d6e8",
      "--line-2": "#23385a",
      "--fill": "#12253f",
      "--accent": "#6ea8ff",
      "--accent-bg": "#16305a",
      "--ok": "#6ea8ff",
      "--ok-bg": "#16305a",
      "--err": "#ff7070",
      "--err-bg": "#3b1620",
      "--warn": "#f0b14a",
      "--warn-bg": "#3a2a10",
      "--head-bg": "#e6edf7",
      "--head-fg": "#081322"
    }
  },
  css: `& .am-frame { border: 1px solid var(--line); padding: 30px; }
& .am-frame::before {
  content: ""; position: absolute; inset: 18px; border: 1px solid var(--line); pointer-events: none;
}
& .am-ruler {
  display: flex; position: absolute; font: 10px/1 var(--font-mono); color: var(--ink-3);
}
@media (max-width: 760px) {
  & .am-frame { padding: 0; border: 0; }
  & .am-frame::before, & .am-ruler { display: none; }
}`,
  video: {
    // Drawing-sheet ground with a fine grid.
    tokens: {
      light: {
        "--v-stage": `linear-gradient(var(--line-2) 1px, transparent 1px) 0 0 / 40px 40px,
             linear-gradient(90deg, var(--line-2) 1px, transparent 1px) 0 0 / 40px 40px, var(--paper)`
      },
      dark: {
        "--v-stage": `linear-gradient(rgba(201, 214, 232, 0.07) 1px, transparent 1px) 0 0 / 40px 40px,
             linear-gradient(90deg, rgba(201, 214, 232, 0.07) 1px, transparent 1px) 0 0 / 40px 40px, var(--bg)`
      }
    },
    css: `& .amv-sheet {
  display: block; position: absolute; inset: 24px; border: 1.5px solid var(--line); pointer-events: none;
}
& .amv-sheet::before {
  content: ""; position: absolute; inset: 24px; border: 1.5px solid var(--line);
}`
  }
};
var shadcn_default = {
  name: "shadcn",
  summary: "shadcn cards",
  label: { zh: "\u5361\u7247", "zh-Hant": "\u5361\u7247", en: "Cards", ja: "\u30AB\u30FC\u30C9", he: "\u05DB\u05E8\u05D8\u05D9\u05E1\u05D9\u05DD" },
  // lang-ok: viewer-facing theme labels
  scope: ["page", "video"],
  tokens: {
    common: { "--font-sans": SANS, "--font-mono": MONO, "--radius": "8px", "--shadow": "0 1px 2px 0 rgba(0,0,0,0.05)", "--bw": "1px", "--head-font": "var(--font-sans)" },
    light: {
      "--bg": "#fafafa",
      "--paper": "#ffffff",
      "--ink": "#09090b",
      "--ink-2": "#71717a",
      "--ink-3": "#a1a1aa",
      "--line": "#e4e4e7",
      "--line-2": "#f0f0f2",
      "--fill": "#f4f4f5",
      "--accent": "#2563eb",
      "--accent-bg": "#eff6ff",
      "--ok": "#16a34a",
      "--ok-bg": "#f0fdf4",
      "--err": "#dc2626",
      "--err-bg": "#fef2f2",
      "--warn": "#d97706",
      "--warn-bg": "#fffbeb",
      "--head-bg": "#18181b",
      "--head-fg": "#fafafa"
    },
    dark: {
      "--bg": "#09090b",
      "--paper": "#121215",
      "--ink": "#fafafa",
      "--ink-2": "#a1a1aa",
      "--ink-3": "#71717a",
      "--line": "#27272a",
      "--line-2": "#1c1c1f",
      "--fill": "#18181b",
      "--accent": "#60a5fa",
      "--accent-bg": "#172554",
      "--ok": "#4ade80",
      "--ok-bg": "#052e16",
      "--err": "#f87171",
      "--err-bg": "#450a0a",
      "--warn": "#fbbf24",
      "--warn-bg": "#451a03",
      "--head-bg": "#fafafa",
      "--head-fg": "#18181b"
    }
  },
  css: `& .am-panel-id { border-radius: 6px; min-width: 24px; height: 24px; margin: 9px 0 9px 14px; font-size: 12px; }
& .am-panel-head { border-bottom-width: 1px; }
& .am-kv { border-color: var(--line); border-radius: var(--radius); overflow: hidden; }`,
  video: {
    css: `& .amv-scene-n { margin: 12px 0 12px 14px; min-width: 40px; border-radius: 8px; font-size: 22px; }
& .amv-scene-head { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06); }`
  }
};
var SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", serif';
var LANGUAGE_SERIF_HEAD = '"Iowan Old Style", Palatino, Georgia';
var paper_default = {
  name: "paper",
  summary: "Paper, for long reading",
  label: { zh: "\u7EB8\u5F20", "zh-Hant": "\u7D19\u5F35", en: "Paper", ja: "\u7D19", he: "\u05E0\u05D9\u05D9\u05E8" },
  // lang-ok: viewer-facing theme labels
  scope: ["page"],
  tokens: {
    common: { "--font-sans": SANS, "--font-mono": MONO, "--font-serif": SERIF, "--radius": "2px", "--shadow": "none", "--bw": "1px", "--head-font": "var(--font-serif)" },
    light: {
      "--bg": "#f5f2ea",
      "--paper": "#fdfbf6",
      "--ink": "#1f1c17",
      "--ink-2": "#57514a",
      "--ink-3": "#8c867b",
      "--line": "#cbc3b4",
      "--line-2": "#e5dfd3",
      "--fill": "#f3eee4",
      "--accent": "#8c2f1e",
      "--accent-bg": "#f5e5df",
      "--ok": "#2e6a3b",
      "--ok-bg": "#e4efe5",
      "--err": "#a3251b",
      "--err-bg": "#f7e3e0",
      "--warn": "#7f5300",
      "--warn-bg": "#f6ecd6",
      "--head-bg": "#1f1c17",
      "--head-fg": "#fdfbf6"
    },
    dark: {
      "--bg": "#15130f",
      "--paper": "#1c1a15",
      "--ink": "#ebe5d8",
      "--ink-2": "#b5ad9e",
      "--ink-3": "#7b7467",
      "--line": "#4a443a",
      "--line-2": "#2d2a24",
      "--fill": "#242119",
      "--accent": "#e59a7d",
      "--accent-bg": "#3a2219",
      "--ok": "#8cc79a",
      "--ok-bg": "#1c3122",
      "--err": "#f0928a",
      "--err-bg": "#3a1d1a",
      "--warn": "#e3b866",
      "--warn-bg": "#352a13",
      "--head-bg": "#ebe5d8",
      "--head-fg": "#15130f"
    }
  },
  css: `${serifByLanguage("--font-serif", LANGUAGE_SERIF_HEAD)}
& .am-head h1, & .am-panel-head h2, & .am-md, & .am-intro, & .am-callout { font-family: var(--font-serif); }
& .am-head h1 { font-weight: 600; letter-spacing: 0; }
& .am-md p, & .am-md li, & .am-md blockquote, & .am-intro { font-size: 15.5px; line-height: 1.75; }
& .am-md p { margin-bottom: 12px; }
& .am-md table { font-family: var(--font-sans); }`
};
var TITLE_HEAD = '"CMU Serif", "Latin Modern Roman", "Iowan Old Style", "Palatino"';
var b1b_default = {
  name: "3b1b",
  summary: "3Blue1Brown dark",
  scope: ["video"],
  mode: "dark",
  video: {
    tokens: {
      common: {
        "--bg": "#0e1015",
        "--paper": "#141922",
        "--ink": "#eceff4",
        "--ink-2": "#a9b4c4",
        "--ink-3": "#6c7789",
        "--line": "#58c4dd",
        "--line-2": "#2a3444",
        "--fill": "#171d27",
        "--accent": "#f7d96f",
        "--accent-bg": "rgba(247, 217, 111, 0.12)",
        "--ok": "#83c167",
        "--ok-bg": "rgba(131, 193, 103, 0.14)",
        "--err": "#fc6255",
        "--err-bg": "rgba(252, 98, 85, 0.14)",
        "--warn": "#f7d96f",
        "--warn-bg": "rgba(247, 217, 111, 0.12)",
        "--head-bg": "#eceff4",
        "--head-fg": "#0e1015",
        "--radius": "6px",
        "--bw": "1.6px",
        "--shadow": "none",
        "--font-sans": '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Roboto, sans-serif',
        "--font-mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        "--head-font": "var(--font-sans)",
        "--v-stage": "radial-gradient(ellipse at 50% 40%, #151a23 0%, #0e1015 70%)",
        "--v-cap-fg": "#fff",
        "--v-cap-bg": "rgba(8, 10, 14, 0.55)",
        "--v-cap-border": "transparent",
        "--v-title-font": '"CMU Serif", "Latin Modern Roman", "Iowan Old Style", "Palatino", "Songti SC", "STSong", "Noto Serif CJK SC", serif',
        "--v-glow": "drop-shadow(0 0 6px rgba(247, 217, 111, 0.55))"
      }
    },
    css: `${serifByLanguage("--v-title-font", TITLE_HEAD)}
& .amv-scene-head { left: 96px; top: 56px; border: 0; background: none; align-items: baseline; gap: 22px; }
& .amv-scene-n { background: none; color: var(--line); padding: 0; min-width: 0; font: 500 30px var(--font-mono); }
& .amv-scene-title { padding: 0; font-weight: 400; font-size: 46px; }
& .amv-scene-meta { display: none; }
& .amv-title { font-weight: 400; font-size: 104px; letter-spacing: 0.005em; }
& .amv-subtitle { color: var(--line); }
& .amv-titleblock { display: none; }
& .amv-caption { bottom: 56px; }
& .amv-caption span { text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6); font-size: 40px; }`
  }
};
var COLOR_TOKENS = Object.freeze([
  "--bg",
  "--paper",
  "--ink",
  "--ink-2",
  "--ink-3",
  "--line",
  "--line-2",
  "--fill",
  "--accent",
  "--accent-bg",
  "--ok",
  "--ok-bg",
  "--err",
  "--err-bg",
  "--warn",
  "--warn-bg",
  "--head-bg",
  "--head-fg"
]);
var LANGS = languageIds();
var ALL = Object.freeze([blueprint_default, shadcn_default, paper_default, b1b_default]);
var BUILTIN_NAMES = ALL.map((t) => t.name);
var themes = (scope) => ALL.filter((t) => t.scope.includes(scope));
var themeNames = (scope) => themes(scope).map((t) => t.name);
var AUTO = "auto";
function pickTheme({ scope, template, visuals }) {
  if (scope === "video") return "blueprint";
  return template === "doc" || !visuals ? "paper" : "blueprint";
}
function themeSet(user = [], broken = /* @__PURE__ */ new Map()) {
  const all = [...ALL, ...user];
  const list = (scope) => all.filter((t) => t.scope.includes(scope));
  const names = (scope) => list(scope).map((t) => t.name);
  const unusable = [...broken].filter(([name]) => !BUILTIN_NAMES.includes(name));
  return Object.freeze({
    list,
    names,
    get: (name) => all.find((t) => t.name === name),
    // Names a draft or flag may give: usable themes plus broken ones, so the error can say what is wrong with the file.
    choices: (scope) => [AUTO, ...names(scope), ...unusable.map(([name]) => name)],
    // Why a name cannot be used, or null.
    problem(name, scope) {
      if (name === AUTO) return null;
      if (names(scope).includes(name)) return null;
      const bad = unusable.find(([n]) => n === name);
      if (bad) return `Theme "${name}" cannot be used: ${bad[1].reason} (${bad[1].file})`;
      return `Theme "${name}" is not installed. Choose one of: ${names(scope).join(" | ")}`;
    },
    // The themes a page carries: the built-in ones for its scope, plus its own theme when that is a user theme.
    embedFor: (name, scope) => [...themes(scope), ...user.filter((t) => t.name === name && t.scope.includes(scope))],
    warnings: [...broken.values()].map(({ file, reason }) => `${file} skipped: ${reason}`)
  });
}
var BUILTIN = themeSet();
var ParseError = class extends Error {
  constructor(message, line) {
    super(message);
    this.name = "ParseError";
    this.line = line;
  }
};
var CHOICES = Object.freeze({
  template: ["sheet", "doc", "video"],
  theme: [AUTO, ...themeNames("page")],
  style: ["off", "80", "strict"],
  mode: ["auto", "light", "dark"]
});
function applyOverrides(meta, overrides, choices = CHOICES) {
  const set = Object.entries(overrides).filter(([, v]) => v !== void 0);
  for (const [key, value] of set) {
    if (choices[key] && !choices[key].includes(String(value))) {
      throw new ParseError(`Invalid ${key} value "${value}". Choose one of: ${choices[key].join(" | ")}`, 0);
    }
  }
  return { ...meta, ...Object.fromEntries(set) };
}
var VOICES = Object.freeze(["auto", "elevenlabs", "local", "system", "off"]);
var DEFAULT_META = Object.freeze({
  template: "sheet",
  theme: AUTO,
  style: "80",
  mode: "auto",
  cols: 3,
  title: ""
});
var NUMERIC_KEYS = /* @__PURE__ */ new Set(["cols", "span"]);
var FENCE_OPEN = /^(`{3,}|~{3,})\s*([^\s`]*)\s*(.*)$/;
var PANEL_HEADING = /^##\s+(.+?)\s*$/;
var ATTR_BLOCK = /\s*\{([^{}]*)\}\s*$/;
var PANEL_ID = /^([A-Z][0-9]?)\s+(.+)$/;
var ATTR_TOKEN = /([\w-]+)(?:=("[^"]*"|'[^']*'|\S+))?/g;
function parseDoc(source, { defaults: defaults2 = {}, choices = {} } = {}) {
  const lines = String(source).replace(/\r\n?/g, "\n").split("\n");
  const { meta, bodyStart } = parseFrontmatter(lines, { ...DEFAULT_META, ...defaults2 }, { ...CHOICES, ...choices });
  const sections = splitSections(lines, bodyStart);
  const intro = extractTitle(sections.intro, meta);
  const panels = assignIds(sections.panels);
  return { meta, intro, panels };
}
function parseFrontmatter(lines, base, allowed) {
  if (lines[0]?.trim() !== "---") return { meta: { ...base }, bodyStart: 0 };
  const end = lines.findIndex((l3, i) => i > 0 && l3.trim() === "---");
  if (end === -1) throw new ParseError("frontmatter is not closed: missing the closing --- line", 1);
  const entries = {};
  for (let i = 1; i < end; i++) {
    const raw = stripLineComment(lines[i]).trim();
    if (!raw || raw.startsWith("#")) continue;
    const m = raw.match(/^([\p{L}\p{M}\p{N}_-]+(?: [\p{L}\p{M}\p{N}_-]+)*)\s*:\s*(.*)$/u);
    if (!m) throw new ParseError(`Cannot parse frontmatter line "${lines[i]}"; expected key: value`, i + 1);
    entries[m[1]] = { value: coerce(m[1], unquote(m[2])), line: i + 1 };
  }
  const meta = { ...base };
  for (const [key, { value, line }] of Object.entries(entries)) {
    if (allowed[key] && !allowed[key].includes(String(value))) {
      throw new ParseError(`Invalid ${key} value "${value}". Choose one of: ${allowed[key].join(" | ")}`, line);
    }
    meta[key] = allowed[key] ? String(value) : value;
  }
  return { meta, bodyStart: end + 1 };
}
function splitSections(lines, start) {
  const intro = [];
  const panels = [];
  let current = { blocks: intro };
  let mdBuf = null;
  const flushMd = () => {
    if (mdBuf && mdBuf.lines.some((l3) => l3.trim())) {
      current.blocks.push({ type: "md", text: mdBuf.lines.join("\n"), line: mdBuf.line });
    }
    mdBuf = null;
  };
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(FENCE_OPEN);
    if (fence) {
      flushMd();
      const close = findFenceClose(lines, i, fence[1]);
      if (close === -1) throw new ParseError(`fenced block ${fence[1]}${fence[2]} is not closed`, i + 1);
      const bare = fence[2].includes("=");
      current.blocks.push({
        type: "fence",
        lang: bare ? "" : fence[2].toLowerCase(),
        args: (bare ? `${fence[2]} ${fence[3]}` : fence[3]).trim(),
        text: lines.slice(i + 1, close).join("\n"),
        line: i + 1
      });
      i = close;
      continue;
    }
    const heading = line.match(PANEL_HEADING);
    if (heading) {
      flushMd();
      current = { ...parseHeading(heading[1]), line: i + 1, blocks: [] };
      panels.push(current);
      continue;
    }
    if (!mdBuf) mdBuf = { line: i + 1, lines: [] };
    mdBuf.lines.push(line);
  }
  flushMd();
  return { intro, panels };
}
function findFenceClose(lines, openIdx, marker) {
  const closeRe = new RegExp(`^${marker[0] === "`" ? "`" : "~"}{${marker.length},}\\s*$`);
  for (let j2 = openIdx + 1; j2 < lines.length; j2++) {
    if (closeRe.test(lines[j2])) return j2;
  }
  return -1;
}
function parseHeading(text) {
  let rest = text;
  let attrs = {};
  const attrMatch = rest.match(ATTR_BLOCK);
  if (attrMatch) {
    attrs = parseAttrs(attrMatch[1]);
    rest = rest.slice(0, attrMatch.index);
  }
  const idMatch = rest.match(PANEL_ID);
  return idMatch ? { id: idMatch[1], title: idMatch[2].trim(), attrs } : { id: null, title: rest.trim(), attrs };
}
function parseAttrs(text) {
  const attrs = {};
  for (const m of text.matchAll(ATTR_TOKEN)) {
    attrs[m[1]] = m[2] === void 0 ? true : coerce(m[1], unquote(m[2]));
  }
  return attrs;
}
function extractTitle(intro, meta) {
  if (meta.title || intro[0]?.type !== "md") return intro;
  const [first, ...rest] = intro;
  const lines = first.text.split("\n");
  const idx = lines.findIndex((l3) => l3.trim());
  const m = lines[idx]?.match(/^#\s+(.+)$/);
  if (!m) return intro;
  meta.title = m[1].trim();
  const remaining = lines.slice(idx + 1);
  if (!remaining.some((l3) => l3.trim())) return rest;
  return [{ ...first, text: remaining.join("\n"), line: first.line + idx + 1 }, ...rest];
}
function assignIds(panels) {
  const used = new Set(panels.map((p) => p.id).filter(Boolean));
  let code = "A".charCodeAt(0);
  const nextFree = () => {
    while (used.has(String.fromCharCode(code))) code++;
    const id = code <= 90 ? String.fromCharCode(code) : `P${code - 64}`;
    used.add(id);
    code++;
    return id;
  };
  return panels.map((p) => p.id ? p : { ...p, id: nextFree() });
}
function unquote(v) {
  const s = v.trim();
  return /^(["']).*\1$/.test(s) ? s.slice(1, -1) : s;
}
function stripLineComment(line) {
  let quote = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === "#" && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}
function coerce(key, value) {
  if (NUMERIC_KEYS.has(key) && /^\d+$/.test(value)) return Number(value);
  return value;
}
var CJK_RE = /[⺀-鿿가-힯豈-﫿︰-﹏＀-￯　-〿]/;
var NARROW = /* @__PURE__ */ new Set([..."iljtfrI.,:;|!'`()[]{}"]);
var WIDE = /* @__PURE__ */ new Set([..."mwMWOQGD@%&"]);
var HIRAGANA_RE = /[\u3040-\u309f]/;
var HIRAGANA_SHARE = 0.05;
function isJapanese(text) {
  let hira = 0;
  let cjk = 0;
  for (const ch of String(text)) {
    if (HIRAGANA_RE.test(ch)) hira++;
    if (CJK_RE.test(ch)) cjk++;
  }
  return hira > 0 && hira / cjk >= HIRAGANA_SHARE;
}
function isCJK(ch) {
  return CJK_RE.test(ch);
}
var HANGUL_SYLLABLE = /[가-힯]/;
var HAN_KANA = new RegExp(CJK_RE.source.replace(HANGUL_SYLLABLE.source.slice(1, -1), ""));
var UNSPACED = [
  ["th", new RegExp("\\p{Script=Thai}", "u")],
  ["lo", new RegExp("\\p{Script=Lao}", "u")],
  ["km", new RegExp("\\p{Script=Khmer}", "u")],
  ["my", new RegExp("\\p{Script=Myanmar}", "u")]
];
var SEGMENTERS = /* @__PURE__ */ new Map();
function segmenter(locale, granularity) {
  const key = `${locale}:${granularity}`;
  if (!SEGMENTERS.has(key)) SEGMENTERS.set(key, new Intl.Segmenter(locale, { granularity }));
  return SEGMENTERS.get(key);
}
function countWords(text) {
  const unspaced = UNSPACED.find(([, re3]) => re3.test(text));
  return unspaced ? [...segmenter(unspaced[0], "word").segment(text)].filter((s) => s.isWordLike).length : text.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'’-]*/gu)?.length ?? 0;
}
var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
}
var words2 = (list) => new Set(list.split(" "));
var NEVER = words2("title textarea style xmp iframe noembed noframes script plaintext link meta base object embed frame frameset template html head body noscript svg math");
var PHRASING = words2("a abbr b bdi bdo br cite code data del dfn em i img ins kbd mark q rp rt ruby s samp small span strong sub sup time u var wbr");
var BLOCK = words2("address area article aside audio blockquote button canvas caption col colgroup datalist dd details dialog div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr input label legend li main map menu meter nav ol optgroup option output p picture pre progress search section select slot source summary table tbody td tfoot th thead tr track ul video acronym big center font strike tt");
var VOID = words2("br wbr img");
var REASON = {
  never: (t) => `${t} is shown as text; raw markup belongs in an html fence`,
  unknown: (t) => `${t} is not an HTML element, shown as text; put code in backticks`,
  block: (t) => `${t} is a block element and cannot sit inside a sentence, shown as text; put it on its own line`,
  unclosed: (t) => `${t} has no closing tag in the same text, shown as text; put code in backticks`,
  stray: (t) => `${t} has no opening tag in the same text, shown as text`,
  open: (t) => `${t} is never closed with >, shown as text`,
  comment: (t) => `${t} is never closed with -->, shown as text`,
  bogus: (t) => `${t} is not a tag a page can hold, shown as text; put code in backticks`
};
function kind(name, inline2) {
  if (NEVER.has(name)) return "never";
  if (!PHRASING.has(name) && !BLOCK.has(name)) return "unknown";
  return inline2 && !PHRASING.has(name) ? "block" : null;
}
var shown = (tag) => tag.label ?? `<${tag.close ? "/" : ""}${tag.name}>`;
function hide(tag, reason, note2) {
  note2(tag.text, REASON[reason](shown(tag)));
  return esc(tag.text);
}
var SCAN = /<!--[\s\S]*?-->|<(!--|[?!]\[?\w*)|<(\/?)([A-Za-z][^\s/>]*)/g;
var OPENING = /^ {0,3}<(\/?)([A-Za-z][^\s/>]*)/;
var CHUNK = /"[^"]*"|'[^']*'|[^"'>]+/y;
function tagEnd(text, from) {
  let i = from;
  while (i < text.length && text[i] !== ">") {
    CHUNK.lastIndex = i;
    if (!CHUNK.exec(text)) return -1;
    i = CHUNK.lastIndex;
  }
  return i < text.length ? i + 1 : -1;
}
function readMatch(text, m) {
  if (m[1]) {
    const end2 = m[1] === "!--" ? -1 : text.indexOf(">", m.index);
    return { reason: m[1] === "!--" ? "comment" : "bogus", tag: { text: end2 === -1 ? m[0] : text.slice(m.index, end2 + 1), label: m[0] } };
  }
  const end = tagEnd(text, m.index + m[0].length);
  return { reason: end === -1 ? "open" : null, tag: { text: end === -1 ? m[0] : text.slice(m.index, end), close: m[2] === "/", name: m[3].toLowerCase() } };
}
function mapTags(text, decide, note2) {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(SCAN)) {
    if (m.index < last || !m[1] && !m[3]) continue;
    const { reason, tag } = readMatch(text, m);
    out += text.slice(last, m.index) + (reason ? hide(tag, reason, note2) : decide(tag));
    last = m.index + tag.text.length;
  }
  return out + text.slice(last);
}
var readTag = (text) => {
  const m = /^<(\/?)([A-Za-z][^\s/>]*)/.exec(text);
  if (m) return { text, close: m[1] === "/", name: m[2].toLowerCase() };
  const bogus = /^<[?!](?!--)\[?\w*/.exec(text);
  return bogus && { text, label: bogus[0] };
};
var ATTR = /\s*([^\s"'<>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]*))?/g;
var URL_ATTRS = words2("href src action xlink:href poster cite background");
var ENTITY = /&#x([0-9a-f]+);?|&#(\d+);?|&(tab|newline|colon);?/gi;
var NAMED = { tab: "	", newline: "\n", colon: ":" };
function decode(text) {
  return text.replace(ENTITY, (_2, hex, dec, name) => {
    if (name) return NAMED[name.toLowerCase()];
    const code = hex ? parseInt(hex, 16) : Number(dec);
    return code > 1114111 ? "" : String.fromCodePoint(code);
  });
}
function unsafeUrl(element, attr, value) {
  const url = decode(value.replace(/^["']|["']$/g, "")).replace(/[\x00-\x20\x7f]/g, "").toLowerCase();
  if (/^(javascript|vbscript):/.test(url)) return true;
  return url.startsWith("data:") && !(element === "img" && attr === "src" && url.startsWith("data:image/"));
}
function unsafe(element, attr, value) {
  if (/^on|^(srcdoc|formaction)$/.test(attr)) return true;
  return URL_ATTRS.has(attr) && unsafeUrl(element, attr, value);
}
function cleanTag(tag, note2) {
  if (tag.close) return tag.text;
  const head = 1 + tag.name.length;
  const removed = [];
  const attrs = tag.text.slice(head).replace(ATTR, (attr, name, value = "") => {
    if (!unsafe(tag.name, name.toLowerCase(), value)) return attr;
    removed.push(name);
    return "";
  });
  if (removed.length) note2(tag.text, `removed ${removed.join(", ")} from <${tag.name}>${removed.some((n) => URL_ATTRS.has(n.toLowerCase())) ? " (unsafe URL)" : ""}`);
  return tag.text.slice(0, head) + attrs;
}
function htmlTokens(tokens, out = []) {
  for (const t of tokens ?? []) {
    if (t.type === "html") out.push(t);
    else htmlTokens(t.tokens, out);
  }
  return out;
}
function unpaired(found) {
  const hidden = /* @__PURE__ */ new Map();
  const open = [];
  for (const item of found) {
    const { tag } = item;
    const reason = tag.label ? "bogus" : kind(tag.name, true);
    if (reason) hidden.set(item, reason);
    else if (VOID.has(tag.name)) continue;
    else if (!tag.close) open.push(item);
    else {
      const i = open.findLastIndex((o) => o.tag.name === tag.name);
      if (i === -1) hidden.set(item, "stray");
      else open.splice(i).slice(1).forEach((o) => hidden.set(o, "unclosed"));
    }
  }
  open.forEach((o) => hidden.set(o, "unclosed"));
  return hidden;
}
function filterRun(tokens, note2) {
  const found = htmlTokens(tokens).map((token) => ({ token, tag: readTag(token.text) })).filter((item) => item.tag);
  const hidden = unpaired(found);
  for (const item of found) {
    const reason = hidden.get(item);
    item.token.text = reason ? hide(item.tag, reason, note2) : cleanTag(item.tag, note2);
  }
}
function filterInline(tokens, note2) {
  filterRun(tokens, note2);
  return tokens;
}
function relexReason(raw) {
  const special = /^ {0,3}(<[?!](?!--)\[?\w*|<!--)/.exec(raw);
  if (special) {
    const comment = special[1] === "<!--";
    return comment && raw.includes("-->") ? null : { reason: comment ? "comment" : "bogus", at: special[1], label: special[1] };
  }
  const m = OPENING.exec(raw);
  if (!m) return null;
  const tag = { close: m[1] === "/", name: m[2].toLowerCase() };
  const reason = kind(tag.name, false) ?? (tag.name === "pre" && !tag.close && !/<\/pre>/i.test(raw) ? "unclosed" : null);
  return reason && { reason, at: m[0].trim(), label: shown(tag) };
}
function relex(token, { reason, at: at3, label }, { lex, note: note2 }) {
  note2(at3, REASON[reason](label));
  return filterBlocks(lex(token.raw.replace("<", "&lt;")), { lex, note: note2 });
}
var filterHtmlBlock = (text, note2) => mapTags(text, (tag) => {
  const reason = kind(tag.name, false);
  return reason ? hide(tag, reason, note2) : cleanTag(tag, note2);
}, note2);
var tight = (block2) => block2.type === "paragraph" ? { ...block2, type: "text" } : block2;
function filterBlocks(tokens, ctx) {
  for (let k2 = 0; k2 < tokens.length; k2++) {
    const t = tokens[k2];
    const plan = t.type === "html" ? relexReason(t.raw) : null;
    if (plan) {
      const again = relex(t, plan, ctx);
      tokens.splice(k2, 1, ...again);
      k2 += again.length - 1;
    } else if (t.type === "html") {
      t.text = filterHtmlBlock(t.text, ctx.note);
    } else if (t.type === "table") {
      [...t.header, ...t.rows.flat()].forEach((cell) => filterRun(cell.tokens, ctx.note));
    } else if (t.type === "list") {
      t.items.forEach((item) => {
        filterBlocks(item.tokens, ctx);
        if (!t.loose) item.tokens = item.tokens.map(tight);
      });
    } else if (t.type === "blockquote") {
      filterBlocks(t.tokens, ctx);
    } else if (t.type === "paragraph" || t.type === "heading" || t.type === "text") {
      filterRun(t.tokens, ctx.note);
    }
  }
  return tokens;
}
var sink = null;
var note = (at3, message) => sink?.push({ at: at3, message });
function collectHtmlNotes(render) {
  const outer = sink;
  const notes = [];
  sink = notes;
  try {
    return { result: render(), notes };
  } finally {
    sink = outer;
  }
}
var marked = new F({ gfm: true });
var inline = new F({ gfm: true });
marked.use({ hooks: { processAllTokens: (tokens) => filterBlocks(tokens, { lex: (source) => marked.lexer(source), note }) } });
inline.use({ hooks: { processAllTokens: (tokens) => filterInline(tokens, note) } });
var STATUS = {
  ok: { cls: "ok", icon: "\u2713" },
  no: { cls: "no", icon: "\u2717" },
  warn: { cls: "warn", icon: "!" }
};
var STATUS_ALIAS = { "\u2713": "ok", "\u2714": "ok", "\u2717": "no", "\u2718": "no", "\u26A0": "warn" };
function statusHtml(word, label = "") {
  const kind2 = STATUS[STATUS_ALIAS[word] ?? word];
  if (!kind2) return null;
  const text = label.trim();
  return `<span class="am-status am-status--${kind2.cls}"><span class="am-status-icon" aria-hidden="true">${kind2.icon}</span>${text}</span>`;
}
var IMAGE_ONLY = /<p>\s*(<img\b[^>]*>)\s*<\/p>/g;
var CELL_STATUS = /<td([^>]*)>\s*(ok|no|warn|✓|✔|✗|✘|⚠)(?:\s+((?:(?!<\/?td\b)[\s\S])*?))?\s*<\/td>/g;
function figure(img) {
  const alt = img.match(/\salt="([^"]*)"/)?.[1];
  return `<figure class="am-figure">${img}${alt ? `<figcaption>${alt}</figcaption>` : ""}</figure>`;
}
function decorate(html) {
  return html.replace(/<table>/g, '<div class="am-table-wrap"><table>').replace(/<\/table>/g, "</table></div>").replace(IMAGE_ONLY, (_2, img) => figure(img)).replace(CELL_STATUS, (_2, attrs, word, label = "") => `<td${attrs}>${statusHtml(word, label)}</td>`);
}
var SPACED_IMAGE = /(`[^`\n]*`)|(!\[[^\]\n]*\]\()\s*((?:[^()<>"\n]|\([^()<>"\n]*\))*?)(\s+"[^"\n]*")?\s*\)/g;
function wrapSpacedImages(text) {
  return text.replace(SPACED_IMAGE, (whole, code, head, dest, title = "") => code || !/\s/.test(dest) ? whole : `${head}<${dest}>${title})`);
}
function md(text) {
  return decorate(marked.parse(wrapSpacedImages(String(text ?? ""))));
}
function mdInline(text) {
  return inline.parseInline(wrapSpacedImages(String(text ?? "")));
}
var ComponentError = class extends Error {
  constructor(message, line = 0) {
    super(message);
    this.name = "ComponentError";
    this.line = line;
  }
};
function contentLines(text) {
  return String(text).split("\n").map((raw, i) => ({ raw, text: raw.trim(), line: i + 1 })).filter((l3) => l3.text && !l3.text.startsWith("//"));
}
function fields(text) {
  return text.split("|").map((s) => s.trim());
}
var KINDS = /* @__PURE__ */ new Set(["info", "ok", "warn", "err"]);
var ALIASES = { warning: "warn", error: "err", note: "info" };
var callout_default = {
  name: "callout",
  summary: "Conclusion / tip / warning bar",
  syntax: `\`\`\`callout <info|ok|warn|err> [title]
Body (Markdown)
\`\`\`
- If the first argument is not a type, the whole argument string is the title and the type is info.`,
  example: "```callout warn Caution\nClose the valve before you remove the pump.\n```",
  render(text, { args }) {
    const [first = "", ...rest] = args.split(/\s+/).filter(Boolean);
    const kind2 = KINDS.has(first) ? first : "info";
    const title = (KINDS.has(first) ? rest.join(" ") : args).trim();
    if (!title && !text.trim()) throw new ComponentError("callout needs a title or a body", 1);
    const firstLine = contentLines(text)[0];
    const typeLine = firstLine && firstLine.text.match(/^type\s*[:：]\s*([a-z][\w-]*)\s*(?:#.*)?$/i);
    if (typeLine) {
      const word = typeLine[1].toLowerCase();
      const wrongKind = KINDS.has(word) ? word : ALIASES[word] ?? "<info|ok|warn|err>";
      throw new ComponentError(`callout: put the type on the fence line, not in the body: \`\`\`callout ${wrongKind} [title]. The line "${firstLine.text}" would show as body text`, firstLine.line);
    }
    const head = title ? `<div class="am-callout-title">${esc(title)}</div>` : "";
    const body = text.trim() ? `<div class="am-callout-body am-md">${md(text)}</div>` : "";
    return `<div class="am-callout am-callout--${kind2}" role="note">${head}${body}</div>`;
  }
};
var kv_default = {
  name: "kv",
  summary: "Key-value grid / title block (metadata)",
  syntax: `\`\`\`kv [cols=2]
key: value
* wide key: value   \u2190 starts with *: spans the full row, larger text
\`\`\`
- Splits at the first colon (: or the fullwidth colon); the value may contain more colons.`,
  example: "```kv cols=2\n* Title: Simplified Technical English\nSpecification: ASD-STE100\nOwner: ASD\n```",
  render(text, { args }) {
    const cols = Math.max(1, Math.min(Number(parseAttrs(args).cols) || 2, 6));
    const cells = contentLines(text).map(({ text: t, line }) => {
      const wide = t.startsWith("*");
      const body = wide ? t.slice(1).trim() : t;
      const m = body.match(/^([^:：]+)[:：]\s*(.*)$/);
      if (!m) throw new ComponentError(`kv line has no colon: "${t}"; expected key: value`, line);
      return `<div class="am-kv-cell${wide ? " am-kv-cell--wide" : ""}"><dt>${esc(m[1].trim())}</dt><dd>${mdInline(m[2])}</dd></div>`;
    });
    if (!cells.length) throw new ComponentError("kv needs at least one key: value line", 1);
    return `<dl class="am-kv" style="--kv-cols: ${cols}">${cells.join("")}</dl>`;
  }
};
var STATE_OF = { "+": "added", "-": "removed", "~": "changed" };
var SIGN = { added: "+", removed: "\u2212", changed: "~" };
var STATES = Object.keys(SIGN);
var EN_DELTA = { added: "added", removed: "removed", changed: "changed", view: "View", before: "Before", changes: "Changes", after: "After" };
var labelsOf = (ui) => ({ ...EN_DELTA, ...ui?.delta });
function splitMarker(text) {
  const m = text.match(/^([+\-~]) +(\S.*)$/);
  return m ? { mark: m[1], text: m[2] } : { mark: null, text };
}
var markState = (mark) => STATE_OF[mark] ?? null;
var deltaAttr = (state) => state ? ` data-delta="${state}"` : "";
function deltaBadge(state, ui) {
  if (!state) return "";
  return `<span class="am-delta-badge am-delta-badge--${state}" role="img" aria-label="${esc(labelsOf(ui)[state])}">${SIGN[state]}</span>`;
}
function withDelta(html, states, { ui, video = false } = {}) {
  const used = STATES.map((s) => [s, states.filter((x2) => x2 === s).length]).filter(([, n]) => n > 0);
  if (!used.length) return html;
  const t = labelsOf(ui);
  const word = (s, n) => n === 1 ? t[s] : t.counts?.[s] ?? t[s];
  const counts = used.map(([s, n]) => `<span class="am-delta-count am-delta-count--${s}">${SIGN[s]}${n} ${esc(word(s, n))}</span>`).join(" ");
  const views = ["before", "changes", "after"].map((v) => `<button type="button" data-view="${v}" aria-pressed="${v === "changes"}">${esc(t[v])}</button>`).join("");
  const switcher = video ? "" : `<span class="am-delta-switch" role="group" aria-label="${esc(t.view)}" hidden>${views}</span>`;
  const open = html.indexOf(">");
  const close = html.lastIndexOf("</");
  return `${html.slice(0, open - 1)} am-view-changes"${html.slice(open, close)}<div class="am-delta-bar">${counts}${switcher}</div>${html.slice(close)}`;
}
var tree_default = {
  name: "tree",
  summary: "Hierarchy tree (org chart / indented list)",
  syntax: `\`\`\`tree [list]
Root | subtitle
  Child
    Grandchild | one-line note
  *Highlighted child
\`\`\`
- Indentation (spaces or tabs) sets the level; "label | note" adds a gray note.
- One root with 2 to 4 children \u2192 org chart; more children or the list argument \u2192 indented list; several roots \u2192 side by side.
- Labels support inline Markdown, such as \`Section 1\` Words.
- Change markers show what a plan adds, removes and changes. A line can start with + (added), - (removed) or ~ (changed), followed by a space, after the indentation:
\`\`\`tree list
src/
  components/
    + delta.js | parses change markers
    ~ flow.js
    ~ tree.js
  - legacy/
    old-flow.js
\`\`\`
  - Indentation still sets the level. The children of a + or - node inherit it; a child that carries a different marker is an error. ~ marks one node and is not inherited.
  - The Changes view draws added in the theme's ok color, removed faded with a struck-through label, changed with a warn outline, and each marked node with a +, \u2212 or ~ badge. A count row and a Before / Changes / After switch sit under the tree: Before and After show the tree as it was and as it will be, plain and without the items that are not in that view.
  - A line that starts with a marker and a space is always read as a marker. To keep a label that starts with "- ", write \\- item.`,
  example: "```tree\nASD-STE100 | Simplified Technical English\n  Part 1: Writing rules\n    `Section 1` Words\n  Part 2: Dictionary\n    Approved words | one word, one meaning\n```",
  render(text, { args, ui, video }) {
    const roots = buildTree(text);
    if (!roots.length) throw new ComponentError("tree needs at least one node", 1);
    return withDelta(treeHtml(roots, /\blist\b/.test(args), ui), statesOf(roots), { ui, video });
  }
};
function treeHtml(roots, listMode, ui) {
  if (roots.length === 1) {
    const [root] = roots;
    const n = root.children.length;
    if (!listMode && n >= 2 && n <= 4) return orgHtml(root, ui);
    return `<div class="am-tree">${rootBox(root, ui, true)}${listHtml(root.children, ui)}</div>`;
  }
  if (!listMode && roots.length <= 4) {
    return `<div class="am-tree"><div class="am-tree-cols am-tree-cols--free" style="--n: ${roots.length}">${colsHtml(roots, ui)}</div></div>`;
  }
  return `<div class="am-tree">${listHtml(roots, ui)}</div>`;
}
var statesOf = (nodes) => nodes.flatMap((n) => [n.state, ...statesOf(n.children)]);
function buildTree(text) {
  const roots = [];
  const stack = [];
  let step = 0;
  String(text).split("\n").forEach((raw, i) => {
    if (!raw.trim()) return;
    const indent = raw.replace(/\t/g, "  ").match(/^ */)[0].length;
    const node = { ...parseLabel(raw.trim()), indent, step: step++, line: i + 1, children: [] };
    while (stack.length && stack.at(-1).indent >= indent) stack.pop();
    (stack.length ? stack.at(-1).children : roots).push(node);
    stack.push(node);
  });
  return roots.map((root) => settle(root, null));
}
function settle(node, inherited) {
  const own = markState(node.mark);
  if (inherited && own && own !== inherited) {
    throw new ComponentError(`tree: "${node.mark}" under a ${inherited} node contradicts it. The children of a ${inherited} node are ${inherited} too; remove the marker or move the node`, node.line);
  }
  const state = inherited ?? own;
  const below = state === "added" || state === "removed" ? state : null;
  return { ...node, state, children: node.children.map((child) => settle(child, below)) };
}
function parseLabel(t) {
  const escaped = /^\\[+\-~] /.test(t);
  const { mark, text } = escaped ? { mark: null, text: t.slice(1) } : splitMarker(t);
  const hi = text.startsWith("*");
  const [label, sub = ""] = fields(hi ? text.slice(1) : text);
  return { label, sub, hi, mark };
}
var labelHtml = (label) => mdInline(label).replace(/^<code>([^<]*)<\/code>(?=\s*\S)/, '<span class="am-tree-tag">$1</span>');
var vattrs = (n) => ` data-key="${esc(n.label)}" data-step="${n.step}"${deltaAttr(n.state)}`;
var HIDDEN_IN = { before: "added", after: "removed" };
function lineAttrs(siblings, i, cols) {
  const n = siblings.length;
  return Object.entries(HIDDEN_IN).map(([view, hidden]) => {
    const shown2 = siblings.map((x2) => x2.state !== hidden);
    const first = shown2.indexOf(true);
    const last = shown2.lastIndexOf(true);
    const natural = cols ? n === 1 ? "none" : i === 0 ? "start" : i === n - 1 ? "end" : "full" : i < n - 1 ? "full" : "short";
    const kind2 = cols ? first === last || i < first || i > last ? "none" : i === first ? "start" : i === last ? "end" : "full" : i < last ? "full" : i === last ? "short" : "none";
    return kind2 === natural ? "" : ` data-line-${view}="${kind2}"`;
  }).join("");
}
var dropAttrs = (children) => Object.entries(HIDDEN_IN).map(([view, hidden]) => children.every((c) => c.state === hidden) ? ` data-line-${view}="none"` : "").join("");
var boxInner = (n, ui) => `${deltaBadge(n.state, ui)}${labelHtml(n.label)}${n.sub ? `<small>${mdInline(n.sub)}</small>` : ""}`;
function rootBox(root, ui, solo = false) {
  const drop = solo ? "" : dropAttrs(root.children);
  return `<div class="am-tree-root${solo ? " am-tree-root--solo" : ""}"${deltaAttr(root.state)}${drop}><div class="am-tree-box am-tree-box--root"${vattrs(root)}>${boxInner(root, ui)}</div></div>`;
}
function colHtml(node, ui, siblings, i) {
  const children = node.children.length ? listHtml(node.children, ui) : "";
  return `<div class="am-tree-col"${deltaAttr(node.state)}${lineAttrs(siblings, i, true)}><div class="am-tree-box${node.hi ? " am-tree-box--hi" : ""}"${vattrs(node)}>${boxInner(node, ui)}</div>${children}</div>`;
}
var colsHtml = (nodes, ui) => nodes.map((n, i) => colHtml(n, ui, nodes, i)).join("");
function orgHtml(root, ui) {
  return `<div class="am-tree">${rootBox(root, ui)}<div class="am-tree-cols" style="--n: ${root.children.length}">${colsHtml(root.children, ui)}</div></div>`;
}
function listHtml(nodes, ui) {
  return `<ul class="am-tree-list">${nodes.map((n, i) => liHtml(n, ui, nodes, i)).join("")}</ul>`;
}
function liHtml(n, ui, siblings, i) {
  const sub = n.sub ? `<span class="am-tree-sub">${mdInline(n.sub)}</span>` : "";
  const kids = n.children.length ? `<ul>${n.children.map((c, k2) => liHtml(c, ui, n.children, k2)).join("")}</ul>` : "";
  return `<li${n.hi ? ' class="am-tree-hi"' : ""}${vattrs(n)}${lineAttrs(siblings, i, false)}><span class="am-tree-label">${deltaBadge(n.state, ui)}${labelHtml(n.label)}</span>${sub}${kids}</li>`;
}
var NICE_MAX = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
var NICE_STEP = [1, 2, 2.5, 5, 10];
function niceScale(peak) {
  if (!Number.isFinite(peak) || peak <= 0) return { max: 1, step: 1 };
  const target = peak * 1.4;
  const pow = 10 ** Math.floor(Math.log10(target));
  const integral = Number.isInteger(peak);
  const nice = NICE_MAX.map((m) => m * pow).find((m) => m >= target - 1e-9) ?? 10 * pow;
  const max = integral ? Math.ceil(nice) : nice;
  const stepPow = 10 ** Math.floor(Math.log10(max));
  const step = [...NICE_STEP.map((s) => s * stepPow / 10), ...NICE_STEP.map((s) => s * stepPow)].find((s) => max / s <= 7 && Number.isInteger(round(max / s)) && (integral ? s >= 1 : true)) ?? max;
  return { max: round(max), step: round(step) };
}
var round = (n) => Math.round(n * 1e3) / 1e3;
var pct = (v, max) => `${Math.round(v / max * 1e4) / 100}%`;
var NUM = /^(?:max\s+)?(-?\d+(?:\.\d+)?)$/i;
var limits_default = {
  name: "limits",
  summary: "Value vs limit bars",
  syntax: `\`\`\`limits
label | value / limit | unit (optional) | note (optional)
label | limit | unit         \u2190 limit only: the bar fills to the limit
\`\`\`
- A row turns red when the value is over the limit. The limit may be written as "max 20".`,
  example: "```limits\nProcedural sentence | 13 / 20 | words\nDescriptive sentence | max 25 | words\nNoun cluster | 4 / 3 | words | over\n```",
  render(text, { dir = "ltr", ui } = {}) {
    const rows = contentLines(text).map(({ text: t, line }) => parseRow(t, line));
    if (!rows.length) throw new ComponentError("limits needs at least one line", 1);
    const words3 = { ...EN_WORDS, ...ui?.limits };
    return `<div class="am-limits">${rows.map((row) => rowHtml(row, dir === "rtl" ? "right" : "left", words3)).join("")}</div>`;
  }
};
function parseRow(t, line) {
  const [label, spec = "", unit = "", note2 = ""] = fields(t);
  const [a, b] = spec.split("/").map((s) => s.trim());
  const nums = (b === void 0 ? [a] : [a, b]).map((s) => s?.match(NUM)?.[1]);
  if (!spec || nums.some((n) => n === void 0)) {
    throw new ComponentError(`limits line must be label | value / limit | unit: "${t}"`, line);
  }
  const [value, limit] = b === void 0 ? [null, Number(nums[0])] : nums.map(Number);
  return { label, value, limit, unit, note: note2 };
}
var EN_WORDS = { value: "{value} / max {limit}", limit: "max {limit}" };
var fill = (template, value, limit) => template.replace("{value}", value).replace("{limit}", limit);
function rowHtml({ label, value, limit, unit, note: note2 }, side = "left", words3 = EN_WORDS) {
  const { max, step } = niceScale(Math.max(limit, value ?? 0));
  const shown2 = value ?? limit;
  const over2 = value !== null && value > limit;
  const valText = `${value !== null ? fill(words3.value, value, limit) : fill(words3.limit, value, limit)}${unit ? ` ${unit}` : ""}`;
  const ticks = [];
  if (step > 0 && max > 0) {
    for (let v = 0; v <= max + 1e-9; v += step) ticks.push(`<span style="${side}: ${pct(round(v), max)}">${round(v)}</span>`);
  }
  return `<div class="am-lim${over2 ? " is-over" : ""}">
<div class="am-lim-head"><span>${esc(label)}${note2 ? `<span class="am-lim-note">${esc(note2)}</span>` : ""}</span><span class="am-lim-val">${esc(valText)}</span></div>
<div class="am-lim-track"><div class="am-lim-fill" style="width: ${pct(shown2, max)}"></div><div class="am-lim-mark" style="${side}: ${pct(limit, max)}"></div></div>
<div class="am-lim-ticks" aria-hidden="true">${ticks.join("")}</div>
</div>`;
}
var RTL_LETTER = /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}]/u;
var LETTER = new RegExp("\\p{L}", "u");
function isLtrOnly(text) {
  const s = decode2(text);
  return !RTL_LETTER.test(s) && [...s].some((ch) => LETTER.test(ch));
}
var hasRtl = (text) => RTL_LETTER.test(decode2(text));
var decode2 = (text) => String(text ?? "").replace(/&(amp|lt|gt|quot|#39);/g, (_2, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[e]).replace(/&[#\w]+;/g, " ");
var NEUTRAL = /[\p{P}\p{S}]/u;
var WJ = String.fromCharCode(8288);
var PREFIX = new RegExp("((?:^|[\\s(])\\p{Script=Hebrew}{1,3}-)(?=[^\\s-])", "gu");
var SIGNED = /(^|[\s(])([+\-−±~]\d[\d.,]*%?)/g;
var WORD = /\S+/g;
var WORD_LEAD = new RegExp(`^(?:\\p{Script=Hebrew}{1,3}[-\\u05BE]|[([{\xAB\u201C\u2018"']|&quot;|&#39;)+`, "u");
var WORD_TRAIL = /(?:[.,:!?)\]}»”’…"'،؛؟]|(?<!&[#\w]+);|&quot;|&#39;)+$/u;
var EDGE_NEUTRAL = /^[\p{P}\p{S}]|[\p{P}\p{S}]$/u;
function isolateWord(word) {
  const lead = word.match(WORD_LEAD)?.[0] ?? "";
  const rest = word.slice(lead.length);
  const trail = rest.match(WORD_TRAIL)?.[0] ?? "";
  const core = rest.slice(0, rest.length - trail.length);
  return isLtrOnly(core) && EDGE_NEUTRAL.test(decode2(core)) ? `${lead}<bdi dir="ltr">${core}</bdi>${trail}` : word;
}
var LRI = String.fromCharCode(8294);
var PDI = String.fromCharCode(8297);
var INLINE = /* @__PURE__ */ new Set(["a", "abbr", "b", "cite", "code", "del", "dfn", "em", "i", "ins", "kbd", "mark", "q", "s", "samp", "strong", "sub", "sup", "u", "var"]);
var SKIP = /* @__PURE__ */ new Set(["svg", "pre", "script", "style", "textarea", "select", "option", "title"]);
var TOKEN = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+|</g;
function isolateLtrRuns(html) {
  const out = [];
  let run2 = [];
  let skip = null;
  let depth = 0;
  const flush = () => {
    if (!run2.length) return;
    const text = run2.filter((t) => !t.startsWith("<")).join("");
    const tags = run2.filter((t) => t.startsWith("<") && !t.startsWith("<!--"));
    const balanced = tags.filter((t) => !t.startsWith("</")).length === tags.filter((t) => t.startsWith("</")).length;
    const first = run2.findIndex((t) => t.trim());
    const last = run2.length - 1 - [...run2].reverse().findIndex((t) => t.trim());
    if (balanced && isLtrOnly(text) && NEUTRAL.test(decode2(text).trim())) {
      out.push(...run2.slice(0, first), '<bdi dir="ltr">', ...run2.slice(first, last + 1), "</bdi>", ...run2.slice(last + 1));
    } else {
      let code = 0;
      const fixed = run2.map((t) => {
        if (/^<code(?=[ >])/i.test(t)) code++;
        else if (/^<\/code>/i.test(t)) code--;
        return t.startsWith("<") || code > 0 ? t : t.replace(WORD, isolateWord).replace(SIGNED, '$1<bdi dir="ltr">$2</bdi>').replace(PREFIX, `$1${WJ}`);
      });
      out.push(...fixed);
    }
    run2 = [];
  };
  for (const m of String(html).matchAll(TOKEN)) {
    const tok = m[0];
    const name = m[1]?.toLowerCase();
    if (skip) {
      out.push(tok);
      if (name === skip) depth += tok.startsWith("</") ? -1 : tok.endsWith("/>") ? 0 : 1;
      if (depth === 0) skip = null;
      continue;
    }
    if (name && SKIP.has(name) && !tok.startsWith("</")) {
      flush();
      out.push(tok);
      if (!tok.endsWith("/>")) {
        skip = name;
        depth = 1;
      }
      continue;
    }
    if (!name || INLINE.has(name)) {
      run2.push(tok);
      continue;
    }
    flush();
    out.push(tok);
  }
  flush();
  return out.join("");
}
var ALL2 = [callout_default, kv_default, tree_default, limits_default];
var COMPONENTS = new Map(ALL2.map((c) => [c.name, c]));
var RAW_LANGS = /* @__PURE__ */ new Set();
function panelHtml(panel, { cols = 3, grid = true, hints = {} } = {}) {
  const { attrs } = panel;
  const span = Math.min(Number(attrs.span) || 1, cols);
  const rows = Number(attrs.rows) || 1;
  const layout4 = [
    grid && span > 1 ? `grid-column: span ${span}` : "",
    grid && rows > 1 ? `grid-row: span ${rows}` : ""
  ].filter(Boolean).join("; ");
  const style = layout4 ? ` style="${layout4}"` : "";
  const hinted = Math.floor(Number(hints.span));
  const data = grid && hinted >= 1 ? ` data-span="${Math.min(hinted, cols)}"` : "";
  const cls = `${span > 1 ? " am-span-wide" : ""}${attrs.bare ? " am-panel--bare" : ""}`;
  const meta = attrs.meta ? `<span class="am-panel-meta">${esc(attrs.meta)}</span>` : "";
  const head = attrs.bare ? "" : `<header class="am-panel-head"><span class="am-panel-id">${esc(panel.id)}</span><h2>${esc(panel.title)}</h2>${meta}</header>
`;
  return `<section class="am-panel${cls}" id="panel-${esc(panel.id)}"${style}${data}>
${head}<div class="am-panel-body">${panel.html}</div>
</section>`;
}
var RESERVED = /* @__PURE__ */ new Set(["template", "theme", "style", "mode", "cols", "title", "subtitle", "lang"]);
function headHtml(meta, introHtml, language = {}) {
  const extras = Object.entries(meta).filter(([k2, v]) => !RESERVED.has(k2) && v !== "");
  const names = language.metaKeys ?? {};
  const value = (v) => language.dir === "rtl" ? `<bdi${hasRtl(v) ? ' dir="rtl"' : ""}>${esc(v)}</bdi>` : esc(v);
  const metaRow = extras.length ? `<div class="am-head-meta">${extras.map(([k2, v]) => `<span><b>${esc(names[k2.toLowerCase()] ?? k2)}</b>${value(v)}</span>`).join("")}</div>` : "";
  const sub = meta.subtitle ? `<p class="am-sub">${esc(meta.subtitle)}</p>` : "";
  const intro = introHtml ? `<div class="am-intro am-md">${introHtml}</div>` : "";
  return `<header class="am-head"><h1>${esc(meta.title || "Untitled")}</h1>${sub}${metaRow}${intro}</header>`;
}
var ruler = (side, labels) => `<div class="am-ruler am-ruler--${side}" aria-hidden="true">${labels.map((l3) => `<span>${l3}</span>`).join("")}</div>`;
function fillRows(panels, cols) {
  const spans = panels.map((p) => Math.max(1, Math.min(Number(p.attrs.span) || 1, cols)));
  if (panels.some((p) => Number(p.attrs.rows) > 1)) return spans;
  let used = 0;
  return spans.map((span, i) => {
    if (used + span > cols) used = 0;
    used += span;
    const next = spans[i + 1];
    const fill2 = next === void 0 || used + next > cols ? cols - used : 0;
    used = fill2 || used === cols ? 0 : used;
    return span + fill2;
  });
}
var WIDE_TABLE_COLS = 4;
var TABLE_COLS_PER_SPAN = 2;
var DIAGRAM_PX_PER_SPAN = 560;
var CELL_SEP = /(?<!\\)\|/;
var DELIMITER_ROW = /^\|[\s:|-]+\|?$/;
function tableColumns(blocks) {
  const counts = blocks.filter((b) => b.type === "md").flatMap((b) => {
    const lines = b.text.split("\n").map((l3) => l3.trim());
    return lines.flatMap((l3, i) => l3.startsWith("|") && DELIMITER_ROW.test(lines[i + 1] ?? "") ? [l3.split(CELL_SEP).length - 2] : []);
  });
  return Math.max(0, ...counts);
}
var svgWidth = (html) => Math.max(0, ...[...html.matchAll(/<svg\b[^>]*?\swidth="(\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1])));
function minSpan(panel) {
  const tableCols = tableColumns(panel.blocks ?? []);
  const byTable = tableCols >= WIDE_TABLE_COLS ? Math.ceil(tableCols / TABLE_COLS_PER_SPAN) : 1;
  const byDiagram = Math.ceil(svgWidth(panel.html ?? "") / DIAGRAM_PX_PER_SPAN);
  return Math.max(1, byTable, byDiagram);
}
function sheet({ meta, introHtml, panels, language }) {
  const cols = Math.max(1, Math.min(Number(meta.cols) || 3, 12));
  const sized = panels.map((p) => p.attrs.span === void 0 && minSpan(p) > 1 ? { ...p, attrs: { ...p.attrs, span: Math.min(minSpan(p), cols) } } : p);
  const spans = fillRows(sized, cols);
  const placed = sized.map((p, i) => ({ ...p, attrs: { ...p.attrs, span: spans[i] } }));
  const nums = Array.from({ length: 8 }, (_2, i) => i + 1);
  const letters = ["A", "B", "C", "D"];
  return `<main class="am-sheet">
${headHtml(meta, introHtml, language)}
<div class="am-frame">
${ruler("top", nums)}${ruler("bottom", nums)}${ruler("left", letters)}${ruler("right", letters)}
<div class="am-grid" style="--cols: ${cols}">
${placed.map((p, i) => panelHtml(p, { cols, hints: { span: panels[i].attrs.span } })).join("\n")}
</div>
</div>
</main>`;
}
function doc({ meta, introHtml, panels, ui, language }) {
  const withToc = panels.length >= 3;
  const toc = withToc ? `<nav class="am-toc" aria-label="${esc(ui?.toc ?? "Contents")}">${panels.map((p) => `<a href="#panel-${esc(p.id)}">${esc(p.id)} \xB7 ${esc(p.title)}</a>`).join("")}</nav>` : "";
  return `<main class="am-doc">
${headHtml(meta, introHtml, language)}
<div class="am-doc-layout${withToc ? "" : " am-doc-layout--notoc"}">
${toc}<div class="am-doc-body">
${panels.map((p) => panelHtml(p, { grid: false })).join("\n")}
</div>
</div>
</main>`;
}
var TEMPLATES = { sheet, doc };
var block = (selector, vars) => `${selector} {
${Object.entries(vars).map(([k2, v]) => `  ${k2}: ${v};`).join("\n")}
}`;
function tokenCss(sel, { common = {}, light = {}, dark = {} }) {
  const parts = [block(`${sel}, ${sel}[data-mode="light"]`, { ...common, ...light })];
  if (Object.keys(dark).length) {
    parts.push(block(`${sel}[data-mode="dark"]`, dark), `@media (prefers-color-scheme: dark) {
${block(`${sel}[data-mode="auto"]`, dark)}
}`);
  }
  return parts.join("\n");
}
var pageSel = (t) => `html[data-theme="${t.name}"]`;
var scoped = (css, sel) => css.replace(/&/g, sel);
var languageFontCss = () => fontLanguages().map((l3) => block(langSelector(l3, "html", "[data-theme][data-mode]"), { "--font-sans": l3.fonts.sans }));
var ownLanguageFont = (t) => fontLanguages().map((l3) => block(langSelector(l3, "html", `[data-theme="${t.name}"][data-mode]`), { "--font-sans": t.tokens.common["--font-sans"] }));
function pageCss(list = themes("page"), { diff = false, delta = false, rtl = false } = {}) {
  const decorations = list.filter((t) => t.css).map((t) => scoped(t.css, pageSel(t)));
  const ownFonts = list.filter((t) => t.ownFont).flatMap(ownLanguageFont);
  return [list.map((t) => tokenCss(pageSel(t), t.tokens)).join("\n\n"), ...languageFontCss(), ...ownFonts, BASE_CSS, ...diff ? [DIFF_CSS] : [], ...delta ? [DELTA_CSS] : [], ...rtl ? [RTL_CSS] : [], ...decorations].join("\n\n");
}
var EN_WORDS2 = Object.freeze({
  "utilize": "use",
  "utilise": "use",
  "utilization": "use",
  "commence": "start",
  "commenced": "started",
  "prior to": "before",
  "in order to": "to",
  "approximately": "about",
  "ensure": "make sure",
  "replenish": "fill",
  "terminate": "stop",
  "facilitate": "help",
  "leverage": "use",
  "numerous": "many",
  "subsequently": "then",
  "endeavor": "try",
  "ascertain": "find",
  "sufficient": "enough",
  "demonstrate": "show",
  "assist": "help",
  "obtain": "get",
  "initiate": "start",
  "modify": "change",
  "possess": "have",
  "purchase": "buy",
  "in the event that": "if",
  "due to the fact that": "because",
  "at this point in time": "now",
  "a number of": "some",
  "with regard to": "about",
  "in addition": "also"
});
var ZH_LIGHT_VERBS = Object.freeze([
  { re: /进行(?![中时])了?([一-龥]{2})/g, label: "\u8FDB\u884C" },
  { re: /(?:加以|予以)([一-龥]{2})/g, label: "\u52A0\u4EE5/\u4E88\u4EE5" },
  { re: /[做作]出了?([一-龥]{2})/g, label: "\u505A\u51FA" }
]);
var ZH_CLICHES = Object.freeze([
  "\u8D4B\u80FD",
  "\u6293\u624B",
  "\u95ED\u73AF",
  "\u6253\u901A",
  "\u5168\u65B9\u4F4D",
  "\u591A\u7EF4\u5EA6",
  "\u6DF1\u5EA6\u878D\u5408",
  "\u663E\u8457\u63D0\u5347",
  "\u81F3\u5173\u91CD\u8981",
  "\u4E0D\u53EF\u6216\u7F3A",
  "\u4E0E\u6B64\u540C\u65F6",
  "\u7EFC\u4E0A\u6240\u8FF0",
  "\u503C\u5F97\u6CE8\u610F\u7684\u662F",
  "\u603B\u800C\u8A00\u4E4B",
  "\u4F17\u6240\u5468\u77E5",
  "\u6BCB\u5EB8\u7F6E\u7591",
  "\u4E00\u7AD9\u5F0F",
  "\u5E95\u5C42\u903B\u8F91",
  "\u9897\u7C92\u5EA6",
  "\u65B9\u6CD5\u8BBA"
]);
var UNIT = String.raw`(?:个|次|秒|天|分钟|小时|倍|字|条|项|人|行|位|%|MB|GB|KB|TB|ms)?`;
var ZH_WORDS = Object.freeze([
  // typos
  { re: /登陆/g, suggestion: "\u767B\u5F55" },
  { re: /帐号/g, suggestion: "\u8D26\u53F7" },
  { re: /阀值/g, suggestion: "\u9608\u503C" },
  { re: /布署/g, suggestion: "\u90E8\u7F72" },
  // quantities without a number
  { re: /尽快/g, suggestion: "give a concrete deadline" },
  { re: /若干/g, suggestion: "write the number" },
  { re: /大概|大约/g, suggestion: 'use "\u7EA6" in descriptions, a value in steps' },
  { re: /多次/g, suggestion: "write the count" },
  // 以上/以下/以内 after a number: it is unclear whether the endpoint is included
  { re: new RegExp(String.raw`(?<=\d\s*${UNIT}\s*)(?:以上|以下)`, "g"), suggestion: "name the endpoint: \u5927\u4E8E / \u4E0D\u5C0F\u4E8E, \u5C0F\u4E8E / \u4E0D\u5927\u4E8E" },
  { re: /(?<=\d[^。，；\n]{0,6})以内/g, suggestion: "\u4E0D\u8D85\u8FC7" },
  // one meaning, one word
  { re: /单击|点按/g, suggestion: "\u70B9\u51FB" },
  { re: /键入/g, suggestion: "\u8F93\u5165" },
  { re: /登出/g, suggestion: "\u9000\u51FA\u767B\u5F55" },
  { re: /入参/g, suggestion: "\u53C2\u6570" },
  { re: /出参/g, suggestion: "\u8FD4\u56DE\u503C" },
  { re: /缺省/g, suggestion: "\u9ED8\u8BA4" }
]);
var LIMITS = { zh: { procedural: 35, descriptive: 45 }, en: { procedural: 20, descriptive: 25 } };
var MAX_SENTENCES = 6;
var ABBR = /\b(e\.g|i\.e|etc|vs|cf|approx|Fig|No)\./gi;
var PASSIVE = /\b(?:am|is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?(\w+ed|known|done|made|given|taken|seen|written|built|shown|sent|kept|held|found|set|put|run|begun|chosen|driven|broken)\b/i;
var EN_RE = Object.entries(EN_WORDS2).sort((a, b) => b[0].length - a[0].length).map(([word, suggestion]) => ({ re: new RegExp(`\\b${word.replace(/ /g, "\\s+")}\\b`, "gi"), word, suggestion }));
function splitSentences(text) {
  const masked = text.replace(ABBR, (m) => m.replace(/\./g, "\0"));
  const parts = masked.match(/[^。！？；!?;]+?(?:[。！？；!?;]+|\.(?=\s|$)|$)|[^.]+?\.(?=\s|$)/g) ?? [];
  return parts.map((s) => s.replace(/\u0000/g, ".").trim()).filter(Boolean);
}
function sentenceLength(sentence) {
  const cjk = [...sentence].filter(isCJK).filter((c) => !/[，。！？；：、（）「」『』“”‘’《》]/.test(c)).length;
  const words3 = sentence.match(/[A-Za-z0-9][\w'’-]*/g)?.length ?? 0;
  return cjk >= 4 || cjk > words3 ? { lang: "zh", count: cjk + words3 } : { lang: "en", count: words3 };
}
var CJK_TEXT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu;
function neutralLength(sentence) {
  const han = sentence.match(CJK_TEXT)?.length ?? 0;
  const rest = sentence.replace(CJK_TEXT, " ");
  const words3 = countWords(rest);
  return han >= 4 || han > words3 ? { lang: "zh", count: han + words3 } : { lang: "en", count: words3 };
}
var RULE_LANGUAGES = /* @__PURE__ */ new Set(["zh", "en", "ja"]);
function ruleFamily(language) {
  if (!language) return "auto";
  const base = language.tag.split("-")[0];
  if (!RULE_LANGUAGES.has(base)) return "neutral";
  return language.declared ? base : "auto";
}
function lintDoc(doc2, language) {
  const warnings = [];
  const family = ruleFamily(language);
  const blocks = [...doc2.intro, ...doc2.panels.flatMap((p) => p.blocks)];
  for (const b of blocks) {
    if (b.type === "md") lintMarkdown(b.text, b.line, warnings, family);
    else if (b.lang === "callout") lintMarkdown(b.text, b.line + 1, warnings, family);
    else if (COMPONENTS.get(b.lang)?.lint) lintMarkdown(COMPONENTS.get(b.lang).lint(b.text), b.line + 1, warnings, family);
  }
  return warnings;
}
function clean(text) {
  return text.replace(/~~[^~]*~~/g, "").replace(/`[^`]*`/g, "").replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, "").replace(/[*_]{1,3}/g, "");
}
function lintMarkdown(text, startLine, out, family) {
  let para = null;
  const flush = () => {
    if (para && para.count > MAX_SENTENCES) {
      out.push({ line: para.line, rule: "paragraph-length", message: `paragraph has ${para.count} sentences (max ${MAX_SENTENCES})` });
    }
    para = null;
  };
  let inHtml = false;
  text.split("\n").forEach((raw, i) => {
    const line = startLine + i;
    const t = raw.trim();
    if (/^<(div|svg|table|details|figure)/i.test(t)) inHtml = true;
    if (inHtml) {
      if (/<\/(div|svg|table|details|figure)>\s*$/i.test(t)) inHtml = false;
      return flush();
    }
    if (!t || /^#{1,6}\s/.test(t) || /^[-*_]{3,}$/.test(t)) return flush();
    if (t.startsWith("|")) {
      flush();
      if (/^\|?[\s:|-]+\|?$/.test(t)) return;
      const cells = t.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      if (cells.some((c) => /^(no|✗|✘)(\s|$)/.test(c))) return;
      cells.forEach((c) => checkUnit(clean(c.replace(/^(ok|warn|✓|✔|⚠)(\s|$)/, "")), line, "descriptive", out, family));
      return;
    }
    const list = t.match(/^(?:([-*+])|(\d+)[.)])\s+(.*)$/);
    if (list) {
      flush();
      checkUnit(clean(list[3]), line, list[2] ? "procedural" : "descriptive", out, family);
      return;
    }
    const body = clean(t.replace(/^>\s*/, ""));
    const n = checkUnit(body, line, "descriptive", out, family);
    if (!para) para = { line, count: 0 };
    para.count += n;
  });
  flush();
}
function checkUnit(text, line, kind2, out, family) {
  const sentences = splitSentences(text);
  const zhFamily = family === "auto" || family === "zh";
  const ja = family === "ja" || zhFamily && isJapanese(text);
  const chineseRules = zhFamily && !ja;
  const englishRules = family !== "neutral";
  for (const s of sentences) {
    const { lang, count: count2 } = family === "neutral" ? neutralLength(s) : sentenceLength(s);
    const limit = LIMITS[lang][kind2];
    if (count2 > limit) {
      const unit = lang === "zh" ? "characters" : "words";
      const preview = s.length > 24 ? `${s.slice(0, 24)}\u2026` : s;
      out.push({ line, rule: "sentence-length", message: `${kind2 === "procedural" ? "step" : "sentence"} has ${count2} ${unit} (max ${limit}): "${preview}"` });
    }
    if (englishRules && lang === "en" && PASSIVE.test(s)) {
      out.push({ line, rule: "passive", message: `possible passive voice: "${s.match(PASSIVE)[0]}"`, suggestion: "use active voice" });
    }
  }
  const lexical = [
    ...(englishRules ? EN_RE : []).flatMap(({ re: re3, suggestion }) => [...text.matchAll(re3)].map((m) => ({ index: m.index, rule: "word", message: `not recommended: "${m[0]}"`, suggestion }))),
    ...(chineseRules ? ZH_LIGHT_VERBS : []).flatMap(({ re: re3, label }) => [...text.matchAll(re3)].map((m) => ({ index: m.index, rule: "word", message: `light verb "${m[0]}" (${label})`, suggestion: `use "${m[1]}"` }))),
    ...(chineseRules ? ZH_WORDS : []).flatMap(({ re: re3, suggestion }) => [...text.matchAll(re3)].map((m) => ({ index: m.index, rule: "word", message: `not recommended: "${m[0]}"`, suggestion })))
  ];
  out.push(...lexical.sort((a, b) => a.index - b.index).map(({ index, ...w }) => ({ line, ...w })));
  for (const s of sentences) {
    if (!zhFamily || isJapanese(s)) continue;
    if ((s.match(/的/g) ?? []).length >= 3) out.push({ line, rule: "de-chain", message: `chained "\u7684": ${s}`, suggestion: 'split the sentence or remove extra "\u7684"' });
  }
  for (const c of chineseRules ? ZH_CLICHES : []) {
    if (text.includes(c)) out.push({ line, rule: "cliche", message: `clich\xE9 "${c}"`, suggestion: "delete it or state a concrete fact" });
  }
  return sentences.length;
}
var SOURCE_OPEN = '<textarea id="am-source"';
var SOURCE_RE = new RegExp(`^${SOURCE_OPEN}[^>]*>([\\s\\S]*?)<\\/textarea>`);
function rootTag({ lang, dir, theme, mode, style, voice, video = false }) {
  return `<html lang="${lang}"${dirAttr(dir)} data-theme="${esc(theme)}" data-mode="${esc(mode)}" data-style="${esc(style)}"${voice ? ` data-voice="${esc(voice)}"` : ""}${video ? " data-video" : ""}>`;
}
function rootCarrierAttrs({ lang, dir, theme, mode, style }) {
  return ` data-am-root-lang="${lang}"${dir === "rtl" ? ' data-am-root-dir="rtl"' : ""} data-am-root-theme="${esc(theme)}" data-am-root-mode="${esc(mode)}" data-am-root-style="${esc(style)}"`;
}
var dirAttr = (dir) => dir === "rtl" ? ' dir="rtl"' : "";
function sourceTag(source) {
  return `${SOURCE_OPEN} hidden readonly aria-hidden="true">${esc(source)}</textarea>`;
}
var PAIRS = "\u8FD9\u9019 \u4E2A\u500B \u4EEC\u5011 \u8BF4\u8AAA \u56FD\u570B \u4E3A\u70BA \u6765\u4F86 \u65F6\u6642 \u4F1A\u6703 \u8FC7\u904E \u5BF9\u5C0D \u5B66\u5B78 \u8FD8\u9084 \u6CA1\u6C92 \u6837\u6A23 \u5F00\u958B \u95E8\u9580 \u95EE\u554F \u95F4\u9593 \u70B9\u9EDE \u73B0\u73FE \u79CD\u7A2E \u7ECF\u7D93 \u52A8\u52D5 \u5B9E\u5BE6 \u673A\u6A5F \u5173\u95DC \u4E1A\u696D \u4E0E\u8207 \u65E0\u7121 \u7535\u96FB \u4E66\u66F8 \u9A6C\u99AC \u8F66\u8ECA \u89C1\u898B \u4E70\u8CB7 \u5356\u8CE3 \u8BFB\u8B80 \u8BED\u8A9E \u8BDD\u8A71 \u8BF7\u8ACB \u8BA9\u8B93 \u8BA4\u8A8D \u5E94\u61C9 \u5F53\u7576 \u603B\u7E3D \u5C06\u5C07 \u4F53\u9AD4 \u534E\u83EF \u58F0\u8072 \u542C\u807D \u89C2\u89C0 \u89C9\u89BA \u8BB0\u8A18 \u8BBE\u8A2D \u8BA1\u8A08 \u8BBA\u8AD6 \u8BAE\u8B70 \u8BB8\u8A31 \u8BC1\u8B49 \u8BC6\u8B58 \u8C03\u8ABF \u8BD5\u8A66 \u8BE5\u8A72 \u8BE6\u8A73 \u8BEF\u8AA4 \u8C08\u8AC7 \u8C22\u8B1D \u8C01\u8AB0 \u8BFE\u8AB2 \u8D1F\u8CA0 \u8D23\u8CAC \u8D35\u8CB4 \u8D44\u8CC7 \u8D39\u8CBB \u8D5B\u8CFD \u8D22\u8CA1 \u8D2D\u8CFC \u8D27\u8CA8 \u8D38\u8CBF \u8D28\u8CEA \u94B1\u9322 \u94F6\u9280 \u94C1\u9435 \u7F51\u7DB2 \u9875\u9801 \u7EA7\u7D1A \u7EBF\u7DDA \u7C7B\u985E \u6570\u6578 \u636E\u64DA \u5E93\u5EAB \u6237\u6236 \u52A1\u52D9 \u533A\u5340 \u4E1C\u6771 \u4E50\u6A02 \u4EA7\u7522 \u4EB2\u89AA \u513F\u5152 \u529E\u8FA6 \u5174\u8208 \u519B\u8ECD \u519C\u8FB2 \u51B5\u6CC1 \u5218\u5289 \u521B\u5275 \u5267\u5287 \u5355\u55AE \u53CC\u96D9 \u53F7\u865F \u5458\u54E1 \u56ED\u5712 \u56F4\u570D \u56FE\u5716 \u5706\u5713 \u573A\u5834 \u5757\u584A \u574F\u58DE \u5904\u8655 \u5907\u5099 \u5934\u982D \u5939\u593E \u594B\u596E \u5987\u5A66 \u5B59\u5B6B \u5B81\u5BE7 \u5B9D\u5BF6 \u5BA1\u5BE9 \u5C42\u5C64 \u5C5E\u5C6C \u5C81\u6B72 \u5E08\u5E2B \u5E26\u5E36 \u5E2E\u5E6B \u5E7F\u5EE3 \u5F02\u7570 \u5F20\u5F35 \u5F3A\u5F37 \u5F55\u9304 \u5F52\u6B78 \u5F7B\u5FB9 \u5F84\u5F91 \u60AC\u61F8 \u60CA\u9A5A \u6218\u6230 \u62A4\u8B77 \u62A5\u5831 \u62E9\u64C7 \u62C5\u64D4 \u62E5\u64C1 \u62DF\u64EC \u6362\u63DB \u635F\u640D \u654C\u6575 \u65AD\u65B7 \u65E7\u820A \u663E\u986F \u6653\u66C9 \u6682\u66AB \u672F\u8853 \u6742\u96DC \u6781\u6975 \u6784\u69CB \u6807\u6A19 \u680F\u6B04 \u6811\u6A39 \u6863\u6A94 \u6865\u6A4B \u68C0\u6AA2 \u697C\u6A13 \u6B22\u6B61 \u6BD5\u7562 \u6C14\u6C23 \u6C49\u6F22 \u6D4E\u6FDF \u6D4F\u700F \u6D4B\u6E2C \u6E7E\u7063 \u6EE1\u6EFF \u706D\u6EC5 \u706F\u71C8 \u7231\u611B \u72B6\u72C0 \u72EC\u7368 \u73AF\u74B0 \u753B\u756B \u7597\u7642 \u76D8\u76E4 \u7801\u78BC \u786E\u78BA \u79BB\u96E2 \u79EF\u7A4D \u79F0\u7A31 \u7A77\u7AAE \u7ADE\u7AF6 \u7B14\u7B46 \u7B80\u7C21 \u7CAE\u7CE7 \u7D27\u7DCA \u7EA2\u7D05 \u7EA6\u7D04 \u7EAA\u7D00 \u7EAF\u7D14 \u7EB8\u7D19 \u7EC4\u7D44 \u7EC6\u7D30 \u7EC7\u7E54 \u7EC8\u7D42 \u7ED3\u7D50 \u7ED9\u7D66 \u7EDC\u7D61 \u7EDF\u7D71 \u7EE7\u7E7C \u7EED\u7E8C \u7EF4\u7DAD \u7EFC\u7D9C \u7EFF\u7DA0 \u7F13\u7DE9 \u7F16\u7DE8 \u7F57\u7F85 \u4E60\u7FD2 \u8054\u806F \u804C\u8077 \u8111\u8166 \u8138\u81C9 \u8282\u7BC0 \u8425\u71DF \u84DD\u85CD \u8651\u616E \u867D\u96D6 \u8865\u88DC \u88C5\u88DD \u89C8\u89BD \u89C4\u898F \u89C6\u8996 \u89E6\u89F8 \u8BA2\u8A02 \u8BA8\u8A0E \u8BAD\u8A13 \u8BB2\u8B1B \u8BBF\u8A2A \u8BC4\u8A55 \u8BCD\u8A5E \u8BD1\u8B6F \u8BC9\u8A34 \u8F93\u8F38 \u8F91\u8F2F \u8FB9\u908A \u8FBE\u9054 \u8FC1\u9077 \u8FD0\u904B \u8FDC\u9060 \u8FDE\u9023 \u8FDB\u9032 \u9009\u9078 \u9012\u905E \u9002\u9069 \u903B\u908F \u9057\u907A \u90AE\u90F5 \u94FA\u92EA \u94FE\u93C8 \u9500\u92B7 \u9501\u9396 \u9519\u932F \u952E\u9375 \u955C\u93E1 \u957F\u9577 \u95EA\u9583 \u95ED\u9589 \u95FB\u805E \u9605\u95B1 \u961F\u968A \u9636\u968E \u9645\u969B \u9690\u96B1 \u96BE\u96E3 \u9759\u975C \u9876\u9802 \u9879\u9805 \u987A\u9806 \u987B\u9808 \u9898\u984C \u989D\u984D \u98CE\u98A8 \u98DE\u98DB \u996D\u98EF \u9986\u9928 \u9A8C\u9A57 \u9A97\u9A19 \u9C7C\u9B5A \u9E1F\u9CE5 \u9E21\u96DE \u9EA6\u9EA5 \u9F50\u9F4A \u9F7F\u9F52 \u9F99\u9F8D".split(" ");
var SIMPLIFIED_ONLY = PAIRS.map((pair) => [...pair][0]).join("");
var TRADITIONAL_ONLY = PAIRS.map((pair) => [...pair][1]).join("");
var CJK_PER_LATIN = 3;
var SCRIPT_LANGUAGES = [
  [new RegExp("\\p{Script=Thai}", "u"), "th"],
  [new RegExp("\\p{Script=Hebrew}", "u"), "he"],
  [new RegExp("\\p{Script=Greek}", "u"), "el"],
  [new RegExp("\\p{Script=Arabic}", "u"), "ar"],
  [new RegExp("\\p{Script=Cyrillic}", "u"), "ru"]
];
var HANGUL = new RegExp("\\p{Script=Hangul}", "u");
var SIMPLIFIED = new Set(SIMPLIFIED_ONLY);
var TRADITIONAL = new Set(TRADITIONAL_ONLY);
function hanLanguage(text) {
  let simplified = 0;
  let traditional = 0;
  for (const ch of text) {
    if (SIMPLIFIED.has(ch)) simplified++;
    else if (TRADITIONAL.has(ch)) traditional++;
  }
  return traditional > simplified ? "zh-Hant" : "zh";
}
function detectLang(text) {
  const draft = String(text);
  let cjk = 0;
  let hangul = 0;
  let latin = 0;
  const others = /* @__PURE__ */ new Map();
  for (const ch of draft) {
    if (isCJK(ch)) {
      cjk++;
      if (HANGUL.test(ch)) hangul++;
    } else if (/[a-z]/i.test(ch)) {
      latin++;
    } else {
      const script = SCRIPT_LANGUAGES.find(([re3]) => re3.test(ch));
      if (script) others.set(script[1], (others.get(script[1]) ?? 0) + 1);
    }
  }
  const otherTotal = [...others.values()].reduce((sum2, n) => sum2 + n, 0);
  if ((cjk + otherTotal) * CJK_PER_LATIN < latin) return "en";
  const [topTag, topCount] = [...others].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  if (topCount > cjk) return topTag;
  if (hangul * 2 > cjk) return "ko";
  return isJapanese(draft) ? "ja" : hanLanguage(draft);
}
function canonicalTag(value) {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/_/g, "-");
  if (!text) return null;
  try {
    const tag = Intl.getCanonicalLocales(text)[0];
    const { language } = new Intl.Locale(tag);
    return !language || language === "und" ? null : tag;
  } catch {
    return null;
  }
}
function directionOf(locale) {
  const info = typeof locale.getTextInfo === "function" ? locale.getTextInfo() : locale.textInfo;
  return info?.direction === "rtl" ? "rtl" : "ltr";
}
function resolveLanguage({ declared, previous, text = "" }) {
  const declaredTag = canonicalTag(declared);
  const tag = declaredTag ?? canonicalTag(previous) ?? detectLang(text);
  const locale = new Intl.Locale(tag).maximize();
  const entry = findLanguage(locale.language, locale.script);
  const labels = entry ?? FALLBACK;
  return Object.freeze({
    tag,
    declared: declaredTag !== null,
    htmlLang: tag === "zh" ? "zh-CN" : tag,
    script: locale.script,
    dir: directionOf(locale),
    supported: Boolean(entry),
    labelKey: labels.id,
    ui: labels.deltaCounts ? { ...labels.ui, delta: { ...labels.ui.delta, counts: labels.deltaCounts } } : labels.ui,
    videoUi: labels.videoUi,
    metaKeys: labels.metaKeys ?? {},
    dateOrder: labels.dateOrder ?? "ymd"
  });
}
var RenderError = class extends Error {
  constructor(message, { line, component, example } = {}) {
    super(message);
    this.name = "RenderError";
    this.line = line;
    this.component = component;
    this.example = example;
  }
};
var LintError = class extends Error {
  constructor(warnings) {
    super(`STE check failed (style: strict): ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`);
    this.name = "LintError";
    this.warnings = warnings;
  }
};
function renderDoc(source, overrides = {}, defaults2 = {}, { themes: themes2 = BUILTIN, previousLanguage, baseDir, codeDir, knownImages, knownCode } = {}) {
  const choices = { theme: themes2.choices("page") };
  const parsed = parseDoc(source, { defaults: defaults2, choices });
  const meta = applyOverrides(parsed.meta, overrides, { ...CHOICES, ...choices });
  if (meta.template === "video") throw new ParseError("template: video is a video draft; render it with am video", 0);
  const problem = themes2.problem(meta.theme, "page");
  if (problem) throw new ParseError(problem, 0);
  const doc2 = { ...parsed, meta: meta.theme === AUTO ? { ...meta, theme: pickTheme({ scope: "page", template: meta.template, visuals: hasVisuals(parsed) }) } : meta };
  const language = resolveLanguage({ declared: doc2.meta.lang, previous: previousLanguage, text: source });
  const warnings = doc2.meta.style === "off" ? [] : lintDoc(doc2, language);
  if (doc2.meta.style === "strict" && warnings.length) throw new LintError(warnings);
  const stats = { panels: doc2.panels.length, components: {}, code: [], codeWarnings: [], componentWarnings: [], htmlWarnings: [] };
  const ui = language.ui;
  const ctx = { seq: 0, stats, ui, dir: language.dir, images: { baseDir, known: knownImages }, code: { baseDir: codeDir, known: knownCode } };
  const loose = doc2.intro.find((b) => b.type === "fence" && COMPONENTS.get(b.lang)?.panelOnly);
  if (loose) throw new RenderError(`${loose.lang} belongs in a panel: put it under the ## heading of the panel the answer changes`, { line: loose.line, component: loose.lang, example: COMPONENTS.get(loose.lang).example });
  const introHtml = renderBlocks(doc2.intro, ctx);
  const panels = doc2.panels.map((p) => ({ ...p, html: renderBlocks(p.blocks, ctx) }));
  const page = TEMPLATES[doc2.meta.template]({ meta: doc2.meta, introHtml, panels, ui, language });
  const body = language.dir === "rtl" ? isolateLtrRuns(page) : page;
  const html = shell({ meta: doc2.meta, language, body, source, embedded: themes2.embedFor(doc2.meta.theme, "page") });
  return { html, warnings, stats, meta: doc2.meta, language };
}
function hasVisuals({ intro, panels }) {
  return [...intro, ...panels.flatMap((p) => p.blocks)].some((b) => b.type === "fence" && (COMPONENTS.has(b.lang) || RAW_LANGS.has(b.lang)));
}
function renderBlocks(blocks, ctx) {
  return blocks.map((b) => {
    const { result, notes } = collectHtmlNotes(() => b.type === "md" ? `<div class="am-md">${md(b.text)}</div>` : renderFence(b, ctx));
    noteHtml(b, notes, ctx);
    return embedImages(b, result, ctx);
  }).join("\n");
}
function noteHtml(block2, notes, ctx) {
  if (!notes.length || !ctx.stats.htmlWarnings) return;
  const lines = block2.text.split("\n");
  const first = block2.type === "md" ? block2.line : block2.line + 1;
  const used = /* @__PURE__ */ new Map();
  for (const { at: at3, message } of notes) {
    const tag = at3.split("\n")[0];
    const places = lines.flatMap((l3, i) => Array(l3.split(tag).length - 1).fill(i));
    const n = used.get(tag) ?? 0;
    used.set(tag, n + 1);
    ctx.stats.htmlWarnings.push({ line: first + (places[Math.min(n, places.length - 1)] ?? 0), message });
  }
}
function embedImages(_block, html) {
  return html;
}
function renderFence(block2, ctx) {
  const { lang, args, text, line } = block2;
  if (RAW_LANGS.has(lang)) return text;
  const comp = COMPONENTS.get(lang);
  if (!comp) return codeBlock(block2, ctx);
  if (comp.pageOnly && ctx.video) throw new RenderError(`${lang} works on a page only; a video cannot take answers`, { line, component: lang, example: comp.example });
  ctx.stats.components[lang] = (ctx.stats.components[lang] ?? 0) + 1;
  try {
    const warn = ({ line: at3 = 0, message }) => ctx.stats.componentWarnings?.push({ line: line + at3, component: lang, message });
    return comp.render(text, { args, uid: () => `am${++ctx.seq}`, ui: ctx.ui, dir: ctx.dir ?? "ltr", video: ctx.video, warn });
  } catch (err) {
    if (!(err instanceof ComponentError)) throw err;
    throw new RenderError(err.message, {
      line: line + (err.line || 0),
      component: lang,
      example: comp.example
    });
  }
}
function codeBlock() {
  throw new Error("Code/file fences are disabled in the biliSum HTML adapter.");
}
function timestamp(d = /* @__PURE__ */ new Date(), order = "ymd") {
  const p = (n) => String(n).padStart(2, "0");
  const time = `${p(d.getHours())}:${p(d.getMinutes())}`;
  if (order === "dmy") return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${time}`;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${time}`;
}
function colophon(language) {
  const repo = "https://github.com/QingYunA/answer-me-with-html";
  const link = `<a href="${repo}" target="_blank" rel="noopener">Answer me with HTML</a>`;
  const star = `<a href="${repo}" target="_blank" rel="noopener">\u2605 Star on GitHub</a>`;
  const label = esc(language.ui.generated ?? "Generated by");
  const time = esc(timestamp(/* @__PURE__ */ new Date(), language.dateOrder));
  if (language.dir === "rtl") return `<footer class="am-colophon">${label} <bdi>${link} ${VERSION}</bdi> \xB7 <bdi>${time}</bdi> \xB7 <bdi>${star}</bdi></footer>`;
  return `<footer class="am-colophon">${label} ${link} ${VERSION} \xB7 ${time} \xB7 ${star}</footer>`;
}
var hasDelta = (html) => html.includes('class="am-delta-bar"');
function lightboxShell(ui, hasDiagrams) {
  if (!hasDiagrams) return "";
  return `<div class="am-lightbox" hidden aria-modal="true" role="dialog" aria-label="${esc(ui.diagram)}" data-expand="${esc(ui.expand)}">
<div class="am-lightbox-backdrop"></div>
<div class="am-lightbox-header">
<div class="am-lightbox-title">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
<span class="am-lightbox-title-text"></span>
</div>
<div class="am-lightbox-actions">
<button class="am-lightbox-close" data-action="close" title="${esc(ui.close)}" aria-label="${esc(ui.close)}">\u2715</button>
</div>
</div>
<div class="am-lightbox-stage">
<div class="am-lightbox-canvas am-diagram"></div>
</div>
</div>
`;
}
function shell({ meta, language, body, source, embedded }) {
  const { ui, labelKey } = language;
  const pick = (name, label, values, current) => `<label class="am-pick">${esc(label)}<select data-am="${name}">${values.map(([value, text]) => `<option value="${esc(value)}"${value === current ? " selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
  const root = { lang: language.htmlLang, dir: language.dir, theme: meta.theme, mode: meta.mode, style: meta.style };
  return `<!doctype html>
${rootTag(root)}
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Answer me with HTML ${VERSION}">
<title>${esc(meta.title || "Answer me with HTML")}</title>
<style>
${pageCss(embedded, { diff: body.includes('class="am-codeblock am-codeblock--diff"'), delta: hasDelta(body), rtl: language.dir === "rtl" })}
</style>
</head>
<body>
<div class="am-toolbar"${rootCarrierAttrs(root)}>
${pick("theme", ui.theme, embedded.map((t) => [t.name, t.label[labelKey]]), meta.theme)}
${pick("mode", ui.modeLabel, Object.entries(ui.mode), meta.mode)}
<button class="am-btn am-btn--reply" type="button" data-am="reply" data-ui="${esc(JSON.stringify({ ...ui.reply, done: ui.done }))}">${esc(ui.reply.button)}</button>
<button class="am-btn" type="button" data-am="copy" data-done="${esc(ui.done)}">${esc(ui.copy)}</button>
</div>
${body}
${lightboxShell(ui, body.includes('class="am-diagram'))}${colophon(language)}
${sourceTag(source)}
<script>
${RUNTIME_JS}${language.dir === "rtl" ? RTL_JS : ""}${hasDelta(body) ? DELTA_JS : ""}<\/script>
</body>
</html>
`;
}
export {
  renderDoc
};
