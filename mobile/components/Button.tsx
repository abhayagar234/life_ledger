import { Pressable, StyleSheet, Text } from "react-native";

import { theme } from "../theme";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
};

export function Button({ label, onPress, variant = "primary", disabled = false }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === "primary" ? styles.primaryLabel : styles.secondaryLabel
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg
  },
  primary: {
    backgroundColor: theme.colors.primary
  },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  ghost: {
    backgroundColor: "transparent"
  },
  label: {
    fontSize: theme.typography.body,
    fontWeight: "700"
  },
  primaryLabel: {
    color: theme.colors.white
  },
  secondaryLabel: {
    color: theme.colors.text
  },
  pressed: {
    opacity: 0.88
  },
  disabled: {
    opacity: 0.5
  }
});
