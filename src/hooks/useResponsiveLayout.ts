import { useWindowDimensions } from "react-native";
import { useEffect, useState, useCallback } from "react";
import * as ScreenOrientation from "expo-screen-orientation";
import { breakpoint } from "@/constants/theme";

export type DeviceClass = "phone" | "tablet";
export type Orientation = "portrait" | "landscape";

export interface ResponsiveLayout {
  width: number;
  height: number;
  orientation: Orientation;
  deviceClass: DeviceClass;
  /** True on narrow smartphones (320–359dp width). */
  isSmallPhone: boolean;
  /** True when vertical height is tight (e.g. phone in landscape or split-screen < 500dp). */
  isCompactHeight: boolean;
  /** Convenience flag matching deviceClass === "tablet". */
  isTablet: boolean;
  /** Columns for the POS product grid — computed from actual available catalog width. */
  posGridColumns: number;
  /** Columns for secondary card lists (Services, Membership, Employees, History). */
  listColumns: number;
  /** Columns for the Inventory product grid. */
  inventoryColumns: number;
  /** Whether the booking calendar should render stylist-column view (wide) vs agenda list (narrow). */
  useWideCalendar: boolean;
  /** Whether POS cart renders as a fixed right side rail vs floating bar + Cart tab. */
  useSidePanel: boolean;
  /** Adaptive width (300–380dp) for the POS side cart panel when useSidePanel is active. */
  sidePanelWidth: number;
  /** Available horizontal width for the POS product catalog. */
  catalogWidth: number;
  /** Horizontal screen padding adapted to screen width. */
  pagePadding: number;
  /** Maximum content width for centered form/settings/detail layouts on large tablets. */
  contentMaxWidth: number;
  /** Optional max width for BottomSheet modals so tablet sheets stay comfortably proportioned. */
  sheetMaxWidth: number | undefined;
  /** Safe maximum height for scrollable body inside a BottomSheet. */
  sheetMaxBodyHeight: number;
}

/**
 * Single source of truth for layout math. Reads live window dimensions
 * (already orientation-aware, updates on rotation with no extra listener
 * needed) and derives every structural layout decision from it, so no
 * screen hardcodes breakpoints itself.
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();

  const orientation: Orientation = width >= height ? "landscape" : "portrait";
  const shortEdge = Math.min(width, height);
  const deviceClass: DeviceClass = shortEdge >= breakpoint.tabletMin ? "tablet" : "phone";
  const isTablet = deviceClass === "tablet";
  const isSmallPhone = width <= breakpoint.smallPhoneMax;
  const isCompactHeight = height < breakpoint.sidePanelMinHeight;

  // Activate POS split-panel only when both horizontal width and vertical height
  // can comfortably fit the product catalog AND the cart rail + checkout summary.
  // Phone landscape (height < 500dp) stays in full-width grid mode with floating cart bar.
  const useSidePanel =
    width >= breakpoint.sidePanelMinWidth &&
    height >= breakpoint.sidePanelMinHeight &&
    (orientation === "landscape" || width >= breakpoint.wideTabletMin);

  // Adaptive cart panel width between 300dp and 380dp (~34% of window width).
  const sidePanelWidth = useSidePanel
    ? Math.min(380, Math.max(300, Math.round(width * 0.34)))
    : 0;

  const pagePadding = isSmallPhone ? 12 : width >= breakpoint.wideTabletMin ? 20 : 16;

  // Catalog width accounts for the side panel and horizontal gaps when split-panel is active.
  const catalogWidth = useSidePanel ? Math.max(320, width - sidePanelWidth - pagePadding * 2) : width;

  // Grid columns: driven by actual catalog width so cards remain 140–235dp wide
  // across small phones, foldables, split-screen windows, and large tablets.
  const posGridColumns = (() => {
    if (catalogWidth < 520) return 2;
    if (catalogWidth < 760) return 3;
    if (catalogWidth < 980) return 4;
    return 5;
  })();

  const listColumns = (() => {
    if (width < 680) return 1;
    if (width < 1100) return 2;
    return 3;
  })();

  const inventoryColumns = (() => {
    if (width < 360) return 1;
    if (width < 740) return 2;
    if (width < 1100) return 3;
    return 4;
  })();

  // Wide stylist-column calendar requires enough width (and reasonable height) to show time slots.
  const useWideCalendar = width >= breakpoint.tabletMin && height >= 420;

  const contentMaxWidth = 960;
  const sheetMaxWidth = width >= breakpoint.tabletMin ? Math.min(600, width - 32) : undefined;
  const sheetMaxBodyHeight = Math.max(160, Math.round(height * (isCompactHeight ? 0.56 : 0.65)));

  return {
    width,
    height,
    orientation,
    deviceClass,
    isSmallPhone,
    isCompactHeight,
    isTablet,
    posGridColumns,
    listColumns,
    inventoryColumns,
    useWideCalendar,
    useSidePanel,
    sidePanelWidth,
    catalogWidth,
    pagePadding,
    contentMaxWidth,
    sheetMaxWidth,
    sheetMaxBodyHeight,
  };
}

/**
 * Optional: lock/unlock orientation per-screen (e.g. lock POS to landscape
 * on tablets for a cashier station, but leave phones free). Call this in a
 * screen's useEffect; it unlocks on unmount so it never leaks globally.
 */
export function useOrientationLock(lock: ScreenOrientation.OrientationLock | null) {
  useEffect(() => {
    if (!lock) return;
    let cancelled = false;
    ScreenOrientation.lockAsync(lock).catch(() => {
      /* orientation lock unsupported on this device — ignore, UI still adapts via useResponsiveLayout */
    });
    return () => {
      if (!cancelled) {
        ScreenOrientation.unlockAsync().catch(() => {});
      }
      cancelled = true;
    };
  }, [lock]);
}

/** Imperative current orientation, for one-off reads outside render (e.g. before printing a receipt layout). */
export function useOrientationState() {
  const [orientation, setOrientation] = useState<ScreenOrientation.Orientation | null>(null);

  const refresh = useCallback(() => {
    ScreenOrientation.getOrientationAsync().then(setOrientation);
  }, []);

  useEffect(() => {
    refresh();
    const sub = ScreenOrientation.addOrientationChangeListener((evt) => {
      setOrientation(evt.orientationInfo.orientation);
    });
    return () => ScreenOrientation.removeOrientationChangeListener(sub);
  }, [refresh]);

  return orientation;
}
