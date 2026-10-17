# BiliSum Hand

A local handwriting font derived from **LXGW WenKai Lite Regular 1.522**.
The family is renamed to `BiliSum Hand`; no upstream font file is replaced.

## Source and license

- Official project: https://github.com/lxgw/LxgwWenKai-Lite/tree/v1.522
- Original file: `fonts/TTF/LXGWWenKaiLite-Regular.ttf` at that tag.
- Upstream release: https://github.com/lxgw/LxgwWenKai-Lite/releases/tag/v1.522
- Copyright 2021–2026 LXGW; copyright 2020 The Klee Project Authors.
- SIL Open Font License 1.1; complete text: `../licenses/LXGW-WenKai-Lite-OFL-1.1.txt`.

## Packaged subset

The original TTF contains 25,598 Unicode codepoints and is 13,872,424 bytes.
A full WOFF2 conversion is 5,270,020 bytes. The packaged subset retains
8,209 codepoints in **1,651,548 bytes**, avoiding a much larger download and
export size while covering all characters used by the current interface.

Coverage includes all GB2312 characters supported by the original font,
ASCII, Latin characters U+00A0–024F, general punctuation U+2000–206F,
arrows and mathematical symbols U+2190–22FF, CJK punctuation U+3000–303F,
fullwidth forms U+FF00–FFEF, and every supported character found in
`entrypoints/` and `src/` Svelte, TypeScript, CSS and JSON source files.
Rare characters outside the subset use the interface's system-font fallback.

The regular weight is supplied. Browsers may synthesize heavier weights for
headings when `font-synthesis: weight` is enabled by the consuming page.

## Use and regeneration

- `bilisum-hand-regular.woff2` is the local interface font. No font CDN is used.
- `../../src/lib/hand-font-data.ts` holds a generated base64 data URI for the
  same WOFF2 file. It is plain TypeScript, so Node tests and WXT can both
  import it without a raw-asset loader.
- `../../src/lib/hand-font.ts` exports `HAND_FONT_FAMILY`, `HAND_FONT_FACE`,
  `HAND_FONT_LICENSE`, and `waitForHandFont()`. `HAND_FONT_FACE` embeds the
  font and complete license for standalone offline HTML/SVG exports.
- Call `waitForHandFont()` after the page declares its font face and before
  measuring text or fitting a map.

To regenerate, use Python FontTools 4.60.1 with Brotli support. Subset the
original regular TTF to the coverage described above, preserve OpenType
layout features and name records, rename name IDs 1/2/3/4/6/16/17 to the
BiliSum Hand regular family, then save with `font.flavor = 'woff2'`. Preserve
the original copyright and license name records. Base64-encode that exact
WOFF2 binary when refreshing `hand-font-data.ts`.
