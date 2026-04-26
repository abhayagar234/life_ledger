import { StyleSheet, Text, View } from "react-native";

import { commonStyles, theme } from "../theme";

type EmptyStateCardProps = {
  title: string;
  body: string;
};

export function EmptyStateCard({ title, body }: EmptyStateCardProps) {
  return (
    <View style={[commonStyles.card, styles.card]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.sm
  },
  title: {
    fontSize: theme.typography.section,
    fontWeight: "700",
    color: theme.colors.text
  },
  body: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textMuted
  }
});
