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
    background: '#f5f6fa',
    surface: '#ffffff',
    soft: '#eceef5',
    text: '#202333',
    muted: '#5c6379',
    subtle: '#646c82',
    line: '#d8dce8',
    lineSoft: '#e7eaf2',
    tableLine: '#b7bfd2',
    accent: '#5546c8',
    accentSoft: '#eeecfc',
    accentBorder: '#b0a8e6',
    onAccent: '#ffffff',
    success: '#23734b',
    successBg: '#e6f4ec',
    warning: '#83550d',
    warningBg: '#fbefd9',
    error: '#b02f46',
    errorBg: '#fce9ed',
    shadow: '0 8px 24px #20233312',
    smallShadow: '0 1px 3px #2023330a',
    overlay: '#202333d9',
    mapColors: [
      '#5546c8',
      '#286ba5',
      '#28735f',
      '#94631d',
      '#a34670',
      '#675b94',
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
    background: '#151720',
    surface: '#1c1f2b',
    soft: '#252938',
    text: '#edf0fa',
    muted: '#afb7cf',
    subtle: '#a6b0c9',
    line: '#3c4257',
    lineSoft: '#2a3041',
    tableLine: '#626d89',
    accent: '#b4a8ff',
    accentSoft: '#30294b',
    accentBorder: '#7569ad',
    onAccent: '#211b3c',
    success: '#8dd5ac',
    successBg: '#1e372b',
    warning: '#f0c57b',
    warningBg: '#3e321f',
    error: '#ff9dab',
    errorBg: '#40232f',
    shadow: '0 8px 24px #00000033',
    smallShadow: '0 1px 3px #00000024',
    overlay: '#151720e6',
    mapColors: [
      '#b4a8ff',
      '#88bdf2',
      '#82cbb3',
      '#deb471',
      '#e89dbe',
      '#b2a6dd',
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
    '--line-soft': p.lineSoft,
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
    '--warning': p.warning,
    '--warning-bg': p.warningBg,
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
    '--line-soft': p.lineSoft,
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
