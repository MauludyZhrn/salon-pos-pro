import Svg, { Path, Rect, Circle, Line } from "react-native-svg";

export type IconName =
  | "home"
  | "calendar"
  | "cart"
  | "user"
  | "users"
  | "chart"
  | "box"
  | "sliders"
  | "logout"
  | "chevronRight"
  | "chevronLeft"
  | "plus"
  | "minus"
  | "trash"
  | "search"
  | "scissors"
  | "printer"
  | "receipt"
  | "award"
  | "gift";

/** Stroke icons on react-native-svg (already a dependency): no icon font to load. */
export function Icon({ name, color, size = 24, strokeWidth = 1.8 }: { name: IconName; color: string; size?: number; strokeWidth?: number }) {
  const p = { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "printer" && (
        <>
          <Path d="M7 9V4h10v5" {...p} />
          <Rect x={4} y={9} width={16} height={8} rx={2} {...p} />
          <Rect x={7} y={14} width={10} height={6} {...p} />
        </>
      )}
      {name === "receipt" && (
        <>
          <Path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" {...p} />
          <Line x1={9} y1={8} x2={15} y2={8} {...p} />
          <Line x1={9} y1={12} x2={15} y2={12} {...p} />
        </>
      )}
      {name === "scissors" && (
        <>
          <Circle cx={6} cy={6.5} r={2.6} {...p} />
          <Circle cx={6} cy={17.5} r={2.6} {...p} />
          <Line x1={8} y1={8} x2={20} y2={18} {...p} />
          <Line x1={8} y1={16} x2={20} y2={6} {...p} />
        </>
      )}
      {name === "home" && <Path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9z" {...p} />}
      {name === "calendar" && (
        <>
          <Rect x={4} y={5} width={16} height={15} rx={2} {...p} />
          <Line x1={4} y1={10} x2={20} y2={10} {...p} />
          <Line x1={8} y1={3} x2={8} y2={7} {...p} />
          <Line x1={16} y1={3} x2={16} y2={7} {...p} />
        </>
      )}
      {name === "cart" && (
        <>
          <Path d="M3 4h2.5l2 11h10l2-8H7" {...p} />
          <Circle cx={9.5} cy={19.5} r={1.3} {...p} />
          <Circle cx={17} cy={19.5} r={1.3} {...p} />
        </>
      )}
      {name === "user" && (
        <>
          <Circle cx={12} cy={8} r={3.5} {...p} />
          <Path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" {...p} />
        </>
      )}
      {name === "users" && (
        <>
          <Circle cx={9} cy={8} r={3.2} {...p} />
          <Path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" {...p} />
          <Circle cx={17} cy={9} r={2.5} {...p} />
          <Path d="M16.5 14.2c2.5.3 4.5 2.4 4.5 5.3" {...p} />
        </>
      )}
      {name === "chart" && (
        <>
          <Rect x={4.5} y={12} width={3.5} height={8} rx={0.8} {...p} />
          <Rect x={10.25} y={7} width={3.5} height={13} rx={0.8} {...p} />
          <Rect x={16} y={4} width={3.5} height={16} rx={0.8} {...p} />
        </>
      )}
      {name === "box" && (
        <>
          <Path d="M3 8l9-5 9 5v8l-9 5-9-5V8z" {...p} />
          <Path d="M3 8l9 5 9-5" {...p} />
          <Line x1={12} y1={13} x2={12} y2={21} {...p} />
        </>
      )}
      {name === "sliders" && (
        <>
          <Line x1={4} y1={7} x2={20} y2={7} {...p} />
          <Circle cx={9} cy={7} r={2.2} {...p} />
          <Line x1={4} y1={17} x2={20} y2={17} {...p} />
          <Circle cx={15} cy={17} r={2.2} {...p} />
        </>
      )}
      {name === "logout" && (
        <>
          <Path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4" {...p} />
          <Path d="M16 8l4 4-4 4" {...p} />
          <Line x1={20} y1={12} x2={10} y2={12} {...p} />
        </>
      )}
      {name === "chevronRight" && <Path d="M9 5l7 7-7 7" {...p} />}
      {name === "chevronLeft" && <Path d="M15 5l-7 7 7 7" {...p} />}
      {name === "plus" && (
        <>
          <Line x1={12} y1={5} x2={12} y2={19} {...p} />
          <Line x1={5} y1={12} x2={19} y2={12} {...p} />
        </>
      )}
      {name === "minus" && <Line x1={5} y1={12} x2={19} y2={12} {...p} />}
      {name === "trash" && (
        <>
          <Line x1={4} y1={7} x2={20} y2={7} {...p} />
          <Path d="M9 7V4h6v3" {...p} />
          <Path d="M6 7l1 13h10l1-13" {...p} />
        </>
      )}
      {name === "search" && (
        <>
          <Circle cx={11} cy={11} r={6} {...p} />
          <Line x1={16} y1={16} x2={21} y2={21} {...p} />
        </>
      )}
      {name === "award" && (
        <>
          <Circle cx={12} cy={9} r={5.5} {...p} />
          <Path d="M9 14l-1.5 7 4.5-2.5 4.5 2.5L15 14" {...p} />
        </>
      )}
      {name === "gift" && (
        <>
          <Rect x={3} y={8} width={18} height={4} rx={1} {...p} />
          <Path d="M5 12v8a1 1 0 001 1h12a1 1 0 001-1v-8" {...p} />
          <Line x1={12} y1={8} x2={12} y2={21} {...p} />
          <Path d="M12 8H8.5a2.2 2.2 0 110-4.4C11 3.6 12 8 12 8z" {...p} />
          <Path d="M12 8h3.5a2.2 2.2 0 100-4.4C13 3.6 12 8 12 8z" {...p} />
        </>
      )}
    </Svg>
  );
}
