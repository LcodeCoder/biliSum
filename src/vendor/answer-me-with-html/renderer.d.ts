export function renderDoc(
  source: string,
  overrides?: Record<string, string | number>,
): { html: string; stats: { panels: number }; warnings: unknown[] };
