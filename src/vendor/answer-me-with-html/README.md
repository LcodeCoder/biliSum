# Answer me with HTML · browser adaptation

This directory contains a checked-in browser port of the user's explicitly
requested `answer-me-with-html` skill, version **0.5.0** (MIT).

Upstream: https://github.com/QingYunA/answer-me-with-html

Installed CLI SHA-256:
`751888304373642db95bcbe356c1c64153f76883e170cab4a56953119e12ec6a`

## Release and regeneration

Normal installation, build and use do **not** require the skill, its CLI, Node,
or a network connection. `renderer.js` is bundled with the extension.

For a reviewed upstream update, run from the repository root:

```sh
node scripts/vendor-html-renderer.mjs /path/to/answer-me-with-html/scripts/am.mjs
```

The optional regeneration tool uses TypeScript and the build toolchain's
esbuild. It validates the version and source hash before adapting the CLI.
`renderer.js` is generated; edit the adaptation script, not this file. Do not
run the general formatter on the generated renderer independently.

## Scope of the adaptation

- Retains native page templates, themes and callout / kv / tree / limits
  components. The skill owns page styling and layout.
- Uses the extension's existing `marked` package in isolated instances.
- Removes Node, filesystem, CLI, code/file fences, video functions, unused
  diagram engines and all inline runtime scripts.
- Disables raw HTML/SVG component fences. Validated AI reading-page data is never parsed as skill instructions: the
  application builds an extended Markdown draft with trusted component
  boundaries, then inserts sanitized chapter Markdown into placeholders.
- `src/lib/html-report.ts` removes unused controls, adds a restrictive CSP,
  sanitizes the final body and includes the upstream MIT notice in each export.
  Preview and download use exactly the same document, with no API configuration.

Full attribution and license: `THIRD_PARTY_NOTICES.md` at the repository root.
