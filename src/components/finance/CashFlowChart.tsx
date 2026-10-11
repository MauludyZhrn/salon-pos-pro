import { View, Text } from "react-native";
import { CartesianChart, Line, Area } from "victory-native";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color } from "@/constants/theme";
import type { DailyCashFlow } from "@/store/financeStore";

interface CashFlowChartProps {
  data: DailyCashFlow[];
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  const { useSidePanel } = useResponsiveLayout();
  const chartHeight = useSidePanel ? 220 : 180;

  const chartData = data.map((d) => ({ day: d.date.slice(5), netCash: d.netCash }));

  if (chartData.length === 0) {
    return (
      <View style={{ height: chartHeight, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: color.textMuted }}>Belum ada data arus kas</Text>
      </View>
    );
  }

  return (
    <View style={{ height: chartHeight, width: "100%" }}>
      <CartesianChart
        data={chartData}
        xKey="day"
        yKeys={["netCash"]}
        domainPadding={{ left: 16, right: 16, top: 20, bottom: 10 }}
        axisOptions={{ lineColor: color.border, labelColor: color.textMuted, formatYLabel: (v) => `${Math.round(Number(v) / 1000)}k` }}
      >
        {({ points, chartBounds }) => (
          <>
            <Area points={points.netCash} y0={chartBounds.bottom} color={`${color.accent}33`} />
            <Line points={points.netCash} color={color.accent} strokeWidth={2} />
          </>
        )}
      </CartesianChart>
    </View>
  );
}
