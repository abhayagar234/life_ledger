import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AppScreen } from "../components/AppScreen";
import { Button } from "../components/Button";
import { EmptyStateCard } from "../components/EmptyStateCard";
import { listLedgerEntries } from "../services/api/moneyos";
import type { LedgerEntryRead } from "../services/api/types";
import { useSessionStore } from "../store/session";
import { commonStyles, theme } from "../theme";

function formatMoney(amount: number | null | undefined) {
  const safeAmount = Number.isFinite(amount) ? Number(amount) : 0;
  return `Rs ${Math.round(safeAmount).toLocaleString("en-IN")}`;
}

function isThisWeek(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  return date >= weekStart;
}

function prettyLabel(entry: LedgerEntryRead) {
  return entry.description || entry.counterparty_name || entry.entry_type.replace(/_/g, " ");
}

function prettyDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function Row({ entry }: { entry: LedgerEntryRead }) {
  const isMoneyIn = entry.cash_direction === "in" || entry.entry_type === "income";
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {prettyLabel(entry)}
        </Text>
        <Text style={styles.rowMeta}>{prettyDate(entry.entry_date)}</Text>
      </View>
      <Text style={[styles.rowAmount, isMoneyIn ? styles.rowAmountIn : styles.rowAmountOut]}>
        {`${isMoneyIn ? "+" : "-"} ${formatMoney(entry.amount)}`}
      </Text>
    </View>
  );
}

export default function HistoryScreen() {
  const userId = useSessionStore((state) => state.userId);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<LedgerEntryRead[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await listLedgerEntries(userId, 120);
        if (active) {
          setEntries(rows);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not load history.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [userId]);

  const thisWeek = useMemo(() => entries.filter((entry) => isThisWeek(entry.entry_date)), [entries]);

  return (
    <AppScreen title="Recent updates" subtitle="This week and recent transactions">
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={[commonStyles.card, styles.errorCard]}>
          <Text style={styles.errorTitle}>Could not load history</Text>
          <Text style={styles.errorBody}>{error}</Text>
        </View>
      ) : null}

      {!loading && !entries.length ? (
        <EmptyStateCard title="No transactions yet" body="Add entries or import statement to see your history here." />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={[commonStyles.card, styles.sectionCard]}>
            <Text style={styles.sectionTitle}>This Week</Text>
            {thisWeek.length ? (
              thisWeek.slice(0, 30).map((entry) => <Row key={entry.id} entry={entry} />)
            ) : (
              <Text style={styles.sectionEmpty}>No transaction this week yet.</Text>
            )}
          </View>

          <View style={[commonStyles.card, styles.sectionCard]}>
            <Text style={styles.sectionTitle}>Recent</Text>
            {entries.slice(0, 60).map((entry) => (
              <Row key={`recent-${entry.id}`} entry={entry} />
            ))}
          </View>
        </ScrollView>
      )}

      <Button label="Back to Home" variant="secondary" onPress={() => router.replace("/(tabs)/home")} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  loadingText: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  },
  errorCard: {
    gap: 4,
    borderColor: "#E7B8AD",
    backgroundColor: "#FFF5F2"
  },
  errorTitle: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.danger
  },
  errorBody: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  },
  sectionCard: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm
  },
  sectionTitle: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.text
  },
  sectionEmpty: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E6E9E5"
  },
  rowCopy: {
    flex: 1,
    gap: 2
  },
  rowTitle: {
    fontSize: theme.typography.caption,
    color: theme.colors.text
  },
  rowMeta: {
    fontSize: 12,
    color: theme.colors.textMuted
  },
  rowAmount: {
    fontSize: theme.typography.caption,
    fontWeight: "700"
  },
  rowAmountIn: {
    color: theme.colors.success
  },
  rowAmountOut: {
    color: theme.colors.danger
  }
});
