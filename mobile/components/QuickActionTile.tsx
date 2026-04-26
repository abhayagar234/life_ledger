import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { commonStyles, theme } from "../theme";

type QuickActionTileProps = {
  label: string;
  hint: string;
  icon: string;
  onPress?: () => void;
};

export function QuickActionTile({ label, hint, icon, onPress }: QuickActionTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [commonStyles.card, styles.tile, pressed ? styles.pressed : null]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon as never} size={20} color={theme.colors.primary} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: "47%",
    gap: theme.spacing.sm
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  label: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.text
  },
  hint: {
    fontSize: theme.typography.caption,
    lineHeight: 18,
    color: theme.colors.textMuted
  },
  pressed: {
    opacity: 0.92
  }
});
