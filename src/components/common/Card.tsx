import { View, type ViewProps } from "react-native";
import { color, elevation, radius, spacing } from "@/constants/theme";

interface CardProps extends ViewProps {
  padded?: boolean;
  raised?: boolean;
}

export function Card({ padded = true, raised = false, style, children, ...rest }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: color.surface,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: color.border,
          padding: padded ? spacing.md : 0,
          ...(raised ? elevation.card : {}),
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
