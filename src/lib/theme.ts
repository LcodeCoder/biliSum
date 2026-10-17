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
  hoverShadow: string;
  insetShadow: string;
  focusInsetShadow: string;
  pressedShadow: string;
  shadowDark: string;
  shadowLight: string;
  overlay: string;
  markerRed: string;
  markerTeal: string;
  markerYellow: string;
  mapColors: readonly string[];
}

function sketchShadows(teal: string, yellow: string) {
  return {
    shadow: `4px 4px 0 ${teal}`,
    smallShadow: `2px 2px 0 ${teal}`,
    hoverShadow: `3px 3px 0 ${yellow}`,
    insetShadow: 'none',
    focusInsetShadow: `2px 2px 0 ${yellow}`,
    pressedShadow: 'none',
    shadowDark: teal,
    shadowLight: yellow,
  };
}

// One palette drives the panel, generated SVG/PNG and offline HTML. Colors
// belong to local presentation preferences, never to a model request/result.
const PALETTES: Record<Appearance, Palette> = {
  light: {
    background: '#fffef5',
    surface: '#fffef5',
    soft: '#f2f0e5',
    text: '#2c2c2c',
    muted: '#626258',
    subtle: '#65645a',
    line: '#aaa99a',
    lineSoft: '#deddd0',
    tableLine: '#9b9b8e',
    accent: '#236e68',
    accentSoft: '#d9efdf',
    accentBorder: '#79b5a9',
    onAccent: '#fffef5',
    success: '#2b6d4d',
    successBg: '#e5efdf',
    warning: '#775410',
    warningBg: '#fff0b5',
    error: '#aa3d3d',
    errorBg: '#fbe7dc',
    markerRed: '#ff6b6b',
    markerTeal: '#4ecdc4',
    markerYellow: '#ffd93d',
    ...sketchShadows('#4ecdc4', '#ffd93d'),
    overlay: '#2c2c2cd9',
    mapColors: [
      '#ed6865',
      '#32aaa3',
      '#d5a416',
      '#6b9d70',
      '#9d80ac',
      '#d99162',
    ],
  },
  eye: {
    background: '#f5efdc',
    surface: '#f5efdc',
    soft: '#ebe3cd',
    text: '#38322b',
    muted: '#665c4d',
    subtle: '#665c4d',
    line: '#aaa08a',
    lineSoft: '#d9cfb6',
    tableLine: '#9c9079',
    accent: '#76502e',
    accentSoft: '#e6dfbd',
    accentBorder: '#b79c68',
    onAccent: '#fff8e7',
    success: '#46603a',
    successBg: '#e4e8cc',
    warning: '#755313',
    warningBg: '#efe2b5',
    error: '#a14635',
    errorBg: '#efdfce',
    markerRed: '#d98b72',
    markerTeal: '#91b5a2',
    markerYellow: '#e7c86a',
    ...sketchShadows('#91b5a2', '#e7c86a'),
    overlay: '#38322bcc',
    mapColors: [
      '#b87565',
      '#659b8a',
      '#b3994b',
      '#7d9b67',
      '#a18ba9',
      '#bd9574',
    ],
  },
  dark: {
    background: '#262923',
    surface: '#262923',
    soft: '#33362f',
    text: '#f0eddd',
    muted: '#c2bfae',
    subtle: '#c2bfae',
    line: '#858777',
    lineSoft: '#494d40',
    tableLine: '#929584',
    accent: '#8ad7c8',
    accentSoft: '#364f41',
    accentBorder: '#709b87',
    onAccent: '#24352e',
    success: '#a5d49c',
    successBg: '#35452f',
    warning: '#f1d77c',
    warningBg: '#494225',
    error: '#ffafa1',
    errorBg: '#4b332c',
    markerRed: '#df8f79',
    markerTeal: '#709d87',
    markerYellow: '#584e27',
    ...sketchShadows('#51725f', '#8d7c3b'),
    overlay: '#181c16e6',
    mapColors: [
      '#ee9b87',
      '#81cdbd',
      '#e1c66e',
      '#a1bd88',
      '#b5a0ca',
      '#d8a87e',
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
    '--marker-red': p.markerRed,
    '--marker-teal': p.markerTeal,
    '--marker-yellow': p.markerYellow,
    '--notebook-lines': `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='28'%3E%3Cpath d='M0 27.5H40' fill='none' stroke='${p.lineSoft.replace('#', '%23')}' stroke-width='.65'/%3E%3C/svg%3E")`,
    '--map-bg': p.background,
    '--error': p.error,
    '--error-bg': p.errorBg,
    '--success': p.success,
    '--success-bg': p.successBg,
    '--warning': p.warning,
    '--warning-bg': p.warningBg,
    '--input': p.surface,
    '--select-arrow': `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='m3 4.5 3 3 3-3' fill='none' stroke='${p.muted.replace('#', '%23')}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    '--shadow': p.shadow,
    '--small-shadow': p.smallShadow,
    '--hover-shadow': p.hoverShadow,
    '--inset-shadow': p.insetShadow,
    '--focus-inset-shadow': p.focusInsetShadow,
    '--pressed-shadow': p.pressedShadow,
    '--shadow-dark': p.shadowDark,
    '--shadow-light': p.shadowLight,
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
    '--font-sans':
      "'BiliSum Hand', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    '--font-hand':
      "'BiliSum Hand', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    '--marker-red': p.markerRed,
    '--marker-teal': p.markerTeal,
    '--marker-yellow': p.markerYellow,
    '--font-serif':
      "'BiliSum Hand', 'PingFang SC', 'Microsoft YaHei', sans-serif",
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
    '--head-bg': p.surface,
    '--head-fg': p.text,
    '--shadow': p.shadow,
    '--small-shadow': p.smallShadow,
    '--focus-inset-shadow': p.focusInsetShadow,
    '--radius': '4px',
    '--bw': '2px',
  };
}
