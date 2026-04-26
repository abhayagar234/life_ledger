import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";

type SummaryCardProps = {
  eyebrow: string;
  title: string;
  helper: string;
};

export function SummaryCard({ eyebrow, title, helper }: SummaryCardProps) {
  return (
    <LinearGradient colors={["#0B6E69", "#0E5B57"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.helper}>{helper}</Text>
      <View style={styles.glow} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    overflow: "hidden",
    gap: theme.spacing.sm
  },
  eyebrow: {
    fontSize: theme.typography.caption,
    color: "rgba(255,255,255,0.78)",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  title: {
    fontSize: theme.typography.display,
    lineHeight: 40,
    fontWeight: "800",
    color: theme.colors.white
  },
  helper: {
    fontSize: theme.typography.body,
    color: "rgba(255,255,255,0.88)"
  },
  glow: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -40,
    right: -20
  }
});
