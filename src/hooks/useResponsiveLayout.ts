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
  /** Columns for the POS product grid — the number that actually changes per layout. */
  posGridColumns: number;
  /** Whether the booking calendar should render week-view (wide) vs day-list (narrow). */
  useWideCalendar: boolean;
  /** Whether cart/detail panel renders as a fixed side rail vs a bottom sheet. */
  useSidePanel: boolean;
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

  // Grid columns: driven by available width, not just device class, so a
  // split-screen tablet or a folded foldable still gets a sane grid.
  const posGridColumns = (() => {
    if (width < 420) return 2;
    if (width < 700) return 3;
    if (width < 1000) return 4;
    return 5;
  })();

  const useWideCalendar = deviceClass === "tablet" || (orientation === "landscape" && width >= 700);
  const useSidePanel = orientation === "landscape" && width >= 700;

  return { width, height, orientation, deviceClass, posGridColumns, useWideCalendar, useSidePanel };
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
