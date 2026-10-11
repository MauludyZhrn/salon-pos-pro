/**
 * Design tokens — single source of truth for color, spacing, type.
 * Palette: "Warm Atelier" — charcoal surfaces, muted gold accent, sage for
 * positive states. Deliberately avoids default RN-blue / purple-gradient
 * "AI slop" palettes.
 */

export const color = {
  bg: "#0F0F12",
  surface: "#17171C",
  surfaceAlt: "#1F1F26",
  surfaceRaised: "#232329",
  border: "#2A2A33",
  borderStrong: "#35353F",

  primary: "#C9A24B", // muted gold — CTAs, active states
  primaryMuted: "#8A702F",
  primaryOn: "#1A1506",

  accent: "#5B8C73", // sage — success / paid / in-stock
  accentOn: "#0C1710",

  danger: "#C25B4A", // terracotta — errors, low stock
  dangerOn: "#1C0A06",

  warn: "#D6A24C",
  warnOn: "#1C1304",

  info: "#6C8CB0",

  textPrimary: "#F4F3EF",
  textSecondary: "#A6A5AD",
  textMuted: "#6B6A74",
  textOnPrimary: "#17140A",
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  h1: { fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  h2: { fontSize: 18, lineHeight: 24, letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 21 },
  bodySm: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 11, lineHeight: 14, letterSpacing: 0.4 },
  price: { fontSize: 20, lineHeight: 24, letterSpacing: -0.2 },
} as const;

export const elevation = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  modal: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

/** Breakpoints used by useResponsiveLayout, in dp of the shortest window edge. */
export const breakpoint = {
  compactPortraitMax: 420, // phone portrait
  tabletMin: 600, // tablet portrait+
} as const;
