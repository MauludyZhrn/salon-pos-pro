import { View, Text } from "react-native";
import { Icon } from "@/components/common/Icon";
import { color, font, radius, spacing } from "@/constants/theme";
import {
  FREE_TREATMENT_POINTS,
  getStampProgress,
  POINTS_PER_TREATMENT,
  TREATMENTS_PER_REWARD,
} from "@/utils/membership";

interface StampCardViewProps {
  points: number;
  compact?: boolean;
}

/**
 * Visualisasi 10-Stamp Treatment Member:
 * - 1 stamp = 1x treatment = 10 poin
 * - 10 stamp = 10x treatment = 100 poin = Gratis 1x treatment
 */
export function StampCardView({ points, compact = false }: StampCardViewProps) {
  const progress = getStampProgress(points);
  const stamps = Array.from({ length: TREATMENTS_PER_REWARD }, (_, i) => i + 1);

  if (compact) {
    return (
      <View style={{ marginTop: spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
          {stamps.map((num) => {
            const filled = num <= progress.filledStamps;
            const isTenth = num === TREATMENTS_PER_REWARD;
            return (
              <View
                key={num}
                style={{
                  flex: 1,
                  height: 24,
                  borderRadius: radius.sm,
                  backgroundColor: filled
                    ? isTenth
                      ? color.accent
                      : color.primary
                    : color.surfaceAlt,
                  borderWidth: 1,
                  borderColor: filled
                    ? isTenth
                      ? color.accent
                      : color.primary
                    : color.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "800",
                    color: filled
                      ? isTenth
                        ? color.accentOn
                        : color.textOnPrimary
                      : color.textMuted,
                  }}
                >
                  {isTenth ? "🎁" : filled ? "✓" : num}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <Text style={{ color: color.textSecondary, fontSize: 11 }}>
            {progress.filledStamps}/{TREATMENTS_PER_REWARD} treatment ({progress.cyclePoints}/{FREE_TREATMENT_POINTS} poin)
          </Text>
          {progress.availableRewards > 0 ? (
            <Text style={{ color: color.accent, fontSize: 11, fontWeight: "700" }}>
              Siap klaim {progress.availableRewards}x Gratis!
            </Text>
          ) : (
            <Text style={{ color: color.textMuted, fontSize: 11 }}>
              {progress.treatmentsToNextReward}x lagi gratis
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: color.primarySoft,
        borderRadius: radius.xl,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: color.borderStrong,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
        <View>
          <Text style={{ color: color.textSecondary, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Kartu Stamp Treatment
          </Text>
          <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 20, fontWeight: "600", marginTop: 2 }}>
            {points} Poin Terkumpul
          </Text>
        </View>
        <View
          style={{
            backgroundColor: progress.availableRewards > 0 ? color.accent : color.surface,
            borderRadius: radius.pill,
            paddingHorizontal: 12,
            paddingVertical: 5,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Icon
            name={progress.availableRewards > 0 ? "gift" : "award"}
            color={progress.availableRewards > 0 ? color.accentOn : color.primaryDeep}
            size={15}
          />
          <Text
            style={{
              color: progress.availableRewards > 0 ? color.accentOn : color.primaryDeep,
              fontSize: 12,
              fontWeight: "800",
            }}
          >
            {progress.availableRewards > 0
              ? `${progress.availableRewards}x Gratis Siap Klaim`
              : `${progress.filledStamps}/${TREATMENTS_PER_REWARD} Treatment`}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, justifyContent: "space-between" }}>
        {stamps.map((num) => {
          const filled = num <= progress.filledStamps;
          const isTenth = num === TREATMENTS_PER_REWARD;
          return (
            <View
              key={num}
              style={{
                width: "18%",
                aspectRatio: 1,
                borderRadius: radius.lg,
                backgroundColor: filled
                  ? isTenth
                    ? color.accent
                    : color.primary
                  : color.surface,
                borderWidth: 1.5,
                borderColor: filled
                  ? isTenth
                    ? color.accent
                    : color.primaryDeep
                  : color.borderStrong,
                alignItems: "center",
                justifyContent: "center",
                padding: 2,
              }}
            >
              <Text
                style={{
                  fontSize: isTenth ? 14 : 13,
                  fontWeight: "800",
                  color: filled
                    ? isTenth
                      ? color.accentOn
                      : color.textOnPrimary
                    : color.textSecondary,
                }}
              >
                {isTenth ? "FREE" : filled ? "✓" : `#${num}`}
              </Text>
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "600",
                  color: filled
                    ? isTenth
                      ? color.accentOn
                      : color.textOnPrimary
                    : color.textMuted,
                  marginTop: 1,
                }}
              >
                {num * POINTS_PER_TREATMENT}p
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={{ color: color.textSecondary, fontSize: 12, marginTop: spacing.sm, textAlign: "center" }}>
        {progress.availableRewards > 0
          ? `Member berhak mendapatkan ${progress.availableRewards}x Gratis Treatment (tukar ${FREE_TREATMENT_POINTS} poin).`
          : `Kurang ${progress.treatmentsToNextReward}x treatment (${progress.treatmentsToNextReward * POINTS_PER_TREATMENT} poin) lagi untuk Gratis 1x Treatment!`}
      </Text>
    </View>
  );
}
