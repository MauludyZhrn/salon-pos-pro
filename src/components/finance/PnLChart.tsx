import { View, Text } from "react-native";
import { CartesianChart, Bar, Line } from "victory-native";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color, spacing } from "@/constants/theme";
import type { DailyPnL } from "@/store/financeStore";

interface PnLChartProps {
  data: DailyPnL[];
}

/** Revenue vs expense bars with a net-profit line overlay, per day. */
export function PnLChart({ data }: PnLChartProps) {
  const { width, useSidePanel } = useResponsiveLayout();
  const chartHeight = useSidePanel ? 260 : 220;

  const chartData = data.map((d) => ({
    day: d.date.slice(5), // MM-DD
    revenue: d.revenueJasa + d.revenueRetail,
    expense: d.hppRetail + d.hppBahan + d.bebanKomisi + d.bebanOperasional,
    profit: d.netProfit,
  }));

  if (chartData.length === 0) {
    return (
      <View style={{ height: chartHeight, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: color.textMuted }}>Belum ada data pada periode ini</Text>
      </View>
    );
  }

  return (
    <View style={{ height: chartHeight, width: "100%" }}>
      <CartesianChart
        data={chartData}
        xKey="day"
        yKeys={["revenue", "expense", "profit"]}
        domainPadding={{ left: 20, right: 20, top: 20 }}
        axisOptions={{
          lineColor: color.border,
          labelColor: color.textMuted,
          formatYLabel: (v) => `${Math.round(Number(v) / 1000)}k`,
        }}
      >
        {({ points, chartBounds }) => (
          <>
            <Bar points={points.revenue} chartBounds={chartBounds} color={color.accent} roundedCorners={{ topLeft: 4, topRight: 4 }} />
            <Bar points={points.expense} chartBounds={chartBounds} color={color.danger} roundedCorners={{ topLeft: 4, topRight: 4 }} />
            <Line points={points.profit} color={color.primary} strokeWidth={2} />
          </>
        )}
      </CartesianChart>
      <Legend />
    </View>
  );
}

function Legend() {
  const items = [
    { label: "Pendapatan", c: color.accent },
    { label: "Beban", c: color.danger },
    { label: "Laba bersih", c: color.primary },
  ];
  return (
    <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.xs, justifyContent: "center" }}>
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i.c }} />
          <Text style={{ color: color.textMuted, fontSize: 11 }}>{i.label}</Text>
        </View>
      ))}
    </View>
  );
}
