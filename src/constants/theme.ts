import { Platform } from "react-native";

/**
 * Design tokens. Palette "Loyal Pink": rose #E981A4, orchid #F4C5D7,
 * blush #F9ADB7, peach #FEC9C3, cream #FAF2DD. Text is a deep plum, never
 * pure black, so the pinks stay warm. White on rose fails contrast, so
 * filled rose surfaces carry plum text (textOnPrimary) and rose used as TEXT
 * on light surfaces is the deeper primaryDeep.
 */

export const color = {
  bg: "#FBF4E6", // cream, a touch lighter than #FAF2DD
  surface: "#FFFFFF",
  surfaceAlt: "#FDF1EE", // blush tint: inputs, inactive chips
  surfaceRaised: "#FFFFFF",
  border: "#F1DFD8",
  borderStrong: "#E7C9C9",

  primary: "#E981A4", // rose: fills, active icons
  primaryDeep: "#BE4A78", // rose as text / pressed fill (4.5:1 on white)
  primaryMuted: "#F9ADB7", // blush
  primarySoft: "#F4C5D7", // orchid
  peach: "#FEC9C3",
  cream: "#FAF2DD",
  primaryOn: "#3B1526",

  accent: "#4F8F6B", // sage: success / paid / revenue
  accentOn: "#FFFFFF",

  danger: "#C2384D",
  dangerOn: "#FFFFFF",

  warn: "#D9953E",
  warnOn: "#3B1526",

  info: "#6E80B3",

  textPrimary: "#3B1526",
  textSecondary: "#7A5566",
  textMuted: "#9A7A89",
  textOnPrimary: "#3B1526",

  scrim: "rgba(59,21,38,0.45)",
} as const;

/** Serif for titles and prices: Georgia on iOS, the system serif (Noto Serif) on Android. No font files to load. */
export const font = {
  display: Platform.select({ ios: "Georgia", default: "serif" }) as string,
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
  xl: 22,
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
    shadowColor: "#B8607F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 2,
  },
  modal: {
    shadowColor: "#3B1526",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

/** Breakpoints used by useResponsiveLayout, in dp. */
export const breakpoint = {
  smallPhoneMax: 359, // small phone portrait (320–359dp)
  compactPortraitMax: 420, // phone portrait
  tabletMin: 600, // tablet portrait+ (shortest edge >= 600dp)
  sidePanelMinWidth: 780, // minimum window width for split POS catalog + cart rail
  sidePanelMinHeight: 500, // minimum window height so split cart summary + list both fit
  wideTabletMin: 900, // tablet landscape
  largeTabletMin: 1195, // large tablet landscape
} as const;
