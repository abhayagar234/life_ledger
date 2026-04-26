import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { commonStyles, theme } from "../theme";

type ChoiceCardProps = {
  title: string;
  subtitle: string;
  icon?: string;
  selected?: boolean;
  onPress: () => void;
};

export function ChoiceCard({ title, subtitle, icon = "ellipse-outline", selected = false, onPress }: ChoiceCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        commonStyles.card,
        commonStyles.shadow,
        styles.card,
        selected ? styles.selected : null,
        pressed ? styles.pressed : null
      ]}
    >
      <View style={[styles.iconWrap, selected ? styles.iconWrapSelected : null]}>
        <Ionicons name={icon as never} size={22} color={selected ? theme.colors.white : theme.colors.primary} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md
  },
  selected: {
    borderColor: theme.colors.primary,
    backgroundColor: "#F2FAF8"
  },
  pressed: {
    opacity: 0.92
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceMuted
  },
  iconWrapSelected: {
    backgroundColor: theme.colors.primary
  },
  body: {
    flex: 1,
    gap: 4
  },
  title: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.text
  },
  subtitle: {
    fontSize: theme.typography.caption,
    lineHeight: 18,
    color: theme.colors.textMuted
  }
});
