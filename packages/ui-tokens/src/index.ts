// JS-accessible mirror of tokens.css, for contexts that can't read CSS
// custom properties directly (e.g. Recharts/D3 canvas rendering).
// If you change a value here, change it in tokens.css too — they must
// stay identical. Consider this the one exception where duplication is
// intentional rather than a DRY violation, since CSS vars and JS values
// are consumed by fundamentally different rendering paths.

export const colors = {
  bgPrimary: "#0A0A0B",
  bgElevated: "#141412",
  bgElevated2: "#1C1C19",

  gold100: "#F5E6C8",
  gold300: "#E8C572",
  gold500: "#C9A050",
  gold700: "#8A6A2F",
  gold900: "#3C2F14",

  textPrimary: "#F2F0EA",
  textSecondary: "#B4B2A9",
  textMuted: "#6E6C63",
  textOnGold: "#1A1408",

  live: "#A32D2D",
  success: "#4E7A4A",
  danger: "#A32D2D",

  border: "#2A2620",
  borderStrong: "#3C2F14",

  glassPanel: "rgba(20, 20, 18, 0.55)",
  glassPanelStrong: "rgba(28, 28, 25, 0.72)",
  glassBorder: "rgba(232, 197, 114, 0.18)",
} as const;

export const chartPalette = {
  primarySeries: colors.gold300,
  comparisonSeries: colors.textSecondary,
  positive: colors.success,
  negative: colors.danger,
  grid: colors.border,
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
  12: 48,
  16: 64,
} as const;

export const radius = {
  sm: 2,
  md: 4,
  lg: 8,
  full: 9999,
} as const;
