import { StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../../components/AppScreen";
import { EmptyStateCard } from "../../components/EmptyStateCard";
import { useSessionStore } from "../../store/session";
import { commonStyles, theme } from "../../theme";

export default function InsightsScreen() {
  const spendingSummary = useSessionStore((state) => state.dashboard.spendingSummary);

  return (
    <AppScreen title="Insights" subtitle="Grouped spending first, plain language always.">
      {spendingSummary ? (
        <>
          <View style={[commonStyles.card, styles.hero]}>
            <Text style={styles.heroLabel}>This Period</Text>
            <Text style={styles.heroValue}>Rs {Math.round(spendingSummary.total_spend).toLocaleString("en-IN")}</Text>
            <Text style={styles.heroBody}>Tracked spending with flexible and fixed buckets ready for the next charts step.</Text>
          </View>
          {spendingSummary.top_categories.map((category) => (
            <View key={category.category} style={[commonStyles.card, styles.row]}>
              <View>
                <Text style={styles.rowTitle}>{category.category.replace(/_/g, " ")}</Text>
                <Text style={styles.rowSub}>{category.percentage}% of spend</Text>
              </View>
              <Text style={styles.rowAmount}>Rs {Math.round(category.amount).toLocaleString("en-IN")}</Text>
            </View>
          ))}
        </>
      ) : (
        <EmptyStateCard title="Add a few entries" body="Grouped spending and trends will show up here after your first data comes in." />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: theme.spacing.sm
  },
  heroLabel: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  },
  heroValue: {
    fontSize: 32,
    fontWeight: "800",
    color: theme.colors.text
  },
  heroBody: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textMuted
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  rowTitle: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.text
  },
  rowSub: {
    marginTop: 4,
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  },
  rowAmount: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.text
  }
});
