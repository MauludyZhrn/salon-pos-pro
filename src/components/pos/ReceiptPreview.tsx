import { View, Text, ScrollView, Platform, Image } from "react-native";
import { RECEIPT_LOGO } from "@/services/receiptLogo";
import { receiptLines } from "@/utils/receiptText";
import { radius, spacing } from "@/constants/theme";
import type { ReceiptConfig } from "@/services/receiptConfig";
import type { Transaction } from "@/types";

/** Paper-style preview of the receipt, laid out with the same settings as the print. */
export function ReceiptPreview({ tx, cfg, reprint }: { tx: Transaction; cfg: ReceiptConfig; reprint?: boolean }) {
  const text = receiptLines(tx, cfg, { reprint }).join("\n");
  const logo = Image.resolveAssetSource(RECEIPT_LOGO);
  const logoWidth = cfg.paperWidth === 48 ? 150 : 110;
  const logoHeight = logo?.width ? Math.round((logoWidth * logo.height) / logo.width) : logoWidth;
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: "#E5DCD3",
        padding: spacing.sm,
        maxHeight: 360,
      }}
    >
      <ScrollView showsVerticalScrollIndicator>
        {cfg.showLogo && (
          <Image
            source={RECEIPT_LOGO}
            resizeMode="contain"
            style={{ width: logoWidth, height: logoHeight, alignSelf: "center", marginBottom: spacing.xs }}
          />
        )}
        <Text
          selectable
          style={{
            fontFamily: Platform.select({ ios: "Courier", default: "monospace" }),
            fontSize: cfg.paperWidth === 48 ? 10 : 12,
            lineHeight: 16,
            color: "#111111",
          }}
        >
          {text}
        </Text>
      </ScrollView>
    </View>
  );
}
