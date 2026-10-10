import type { Appearance, Theme } from './types';

export const APPEARANCES: readonly Appearance[] = ['light', 'eye', 'dark'];

interface Palette {
  background: string;
  surface: string;
  soft: string;
  text: string;
  muted: string;
  subtle: string;
  line: string;
  lineSoft: string;
  tableLine: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  onAccent: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  error: string;
  errorBg: string;
  shadow: string;
  smallShadow: string;
  overlay: string;
  mapColors: readonly string[];
}

// One palette drives the panel, generated SVG/PNG and offline HTML. Colors
// belong to local presentation preferences, never to a model request/result.
const PALETTES: Record<Appearance, Palette> = {
  light: {
    background: '#f5f2ea',
    surface: '#fdfbf6',
    soft: '#f3eee4',
    text: '#1f1c17',
    muted: '#57514a',
    subtle: '#70665a',
    line: '#cbc3b4',
    lineSoft: '#e5dfd3',
    tableLine: '#bbae9b',
    accent: '#8c2f1e',
    accentSoft: '#f5e5df',
    accentBorder: '#c8a497',
    onAccent: '#fdfbf6',
    success: '#2e6a3b',
    successBg: '#e4efe5',
    warning: '#7f5300',
    warningBg: '#f6ecd6',
    error: '#a3251b',
    errorBg: '#f7e3e0',
    shadow: '0 4px 16px #1f1c170d',
    smallShadow: '0 1px 3px #1f1c170a',
    overlay: '#1f1c17cc',
    mapColors: [
      '#976653',
      '#7c705c',
      '#a67850',
      '#827b62',
      '#987766',
      '#88755f',
    ],
  },
  eye: {
    background: '#eee7d9',
    surface: '#f5efdf',
    soft: '#e7dfce',
    text: '#302c24',
    muted: '#655c4d',
    subtle: '#6a5f4d',
    line: '#c7bba5',
    lineSoft: '#dbd0bb',
    tableLine: '#b4a68d',
    accent: '#78513a',
    accentSoft: '#e7d9c7',
    accentBorder: '#bca487',
    onAccent: '#fbf5e9',
    success: '#426240',
    successBg: '#e1e6d5',
    warning: '#745719',
    warningBg: '#eee0bd',
    error: '#963e2c',
    errorBg: '#efded4',
    shadow: '0 4px 16px #302c240d',
    smallShadow: '0 1px 3px #302c240a',
    overlay: '#302c24cc',
    mapColors: [
      '#876c54',
      '#766b50',
      '#927448',
      '#777653',
      '#907362',
      '#806953',
    ],
  },
  dark: {
    background: '#15130f',
    surface: '#1c1a15',
    soft: '#242119',
    text: '#ebe5d8',
    muted: '#b5ad9e',
    subtle: '#aaa091',
    line: '#4a443a',
    lineSoft: '#2d2a24',
    tableLine: '#665d4f',
    accent: '#e59a7d',
    accentSoft: '#3a2219',
    accentBorder: '#8d6653',
    onAccent: '#211a13',
    success: '#8cc79a',
    successBg: '#1c3122',
    warning: '#e3b866',
    warningBg: '#352a13',
    error: '#f0928a',
    errorBg: '#3a1d1a',
    shadow: '0 4px 16px #00000026',
    smallShadow: '0 1px 3px #0000001a',
    overlay: '#15130fe6',
    mapColors: [
      '#c99a7a',
      '#b6ab89',
      '#c9a773',
      '#aab18f',
      '#c29d8c',
      '#b6a28a',
    ],
  },
};

export function normalizeTheme(
  value: unknown,
  fallback: Theme = 'light',
): Theme {
  return value === 'system' || APPEARANCES.includes(value as Appearance)
    ? (value as Theme)
    : fallback;
}

export function appearancePalette(value: unknown): Palette {
  return PALETTES[
    APPEARANCES.includes(value as Appearance) ? (value as Appearance) : 'light'
  ];
}

export function uiThemeVariables(
  appearance: Appearance,
): Record<string, string> {
  const p = appearancePalette(appearance);
  return {
    '--bg': p.background,
    '--surface': p.surface,
    '--soft': p.soft,
    '--text': p.text,
    '--muted': p.muted,
    '--line': p.line,
    '--table-line': p.tableLine,
    '--accent': p.accent,
    '--accent-soft': p.accentSoft,
    '--accent-border': p.accentBorder,
    '--on-accent': p.onAccent,
    '--map-bg': p.background,
    '--error': p.error,
    '--error-bg': p.errorBg,
    '--success': p.success,
    '--success-bg': p.successBg,
    '--input': p.surface,
    '--shadow': p.shadow,
    '--small-shadow': p.smallShadow,
    '--cover-bg': p.overlay,
    '--cover-text': appearance === 'dark' ? p.text : p.onAccent,
  };
}

export function themeStyleSheet(): string {
  return APPEARANCES.map((appearance) => {
    const selector =
      appearance === 'light'
        ? ':root, :root[data-theme="light"]'
        : `:root[data-theme="${appearance}"]`;
    const variables = Object.entries(uiThemeVariables(appearance))
      .map(([name, value]) => `${name}:${value};`)
      .join('');
    return `${selector}{color-scheme:${appearance === 'dark' ? 'dark' : 'light'};${variables}}`;
  }).join('\n');
}

// Map every renderer color token, including callouts and chart labels. The
// renderer's templates keep their typography/layout while sharing our colors.
export function reportThemeVariables(
  appearance: Appearance,
): Record<string, string> {
  const p = appearancePalette(appearance);
  return {
    '--bg': p.background,
    '--paper': p.surface,
    '--ink': p.text,
    '--ink-2': p.muted,
    '--ink-3': p.subtle,
    '--line': p.line,
    '--line-2': p.lineSoft,
    '--fill': p.soft,
    '--accent': p.accent,
    '--accent-bg': p.accentSoft,
    '--ok': p.success,
    '--ok-bg': p.successBg,
    '--err': p.error,
    '--err-bg': p.errorBg,
    '--warn': p.warning,
    '--warn-bg': p.warningBg,
    '--head-bg': p.text,
    '--head-fg': p.surface,
    '--shadow': p.shadow,
  };
}
