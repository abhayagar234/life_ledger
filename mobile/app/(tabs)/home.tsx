import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { EmptyStateCard } from "../../components/EmptyStateCard";
import { QuickActionTile } from "../../components/QuickActionTile";
import { useSessionStore } from "../../store/session";
import { commonStyles, theme } from "../../theme";

function formatMoney(amount: number | null | undefined) {
  const safeAmount = Number.isFinite(amount) ? Number(amount) : 0;
  return `Rs ${Math.round(safeAmount).toLocaleString("en-IN")}`;
}

function buildGaugeState(status?: string | null) {
  if (status === "risk") {
    return {
      zone: "Red Zone",
      color: theme.colors.danger,
      fill: "18%" as const,
      helper: "Danger, slow down"
    };
  }
  if (status === "tight") {
    return {
      zone: "Yellow Zone",
      color: theme.colors.warning,
      fill: "48%" as const,
      helper: "Getting tight"
    };
  }
  if (status === "safe") {
    return {
      zone: "Green Zone",
      color: theme.colors.success,
      fill: "82%" as const,
      helper: "Safe"
    };
  }
  return {
    zone: "Start Here",
    color: theme.colors.primary,
    fill: "35%" as const,
    helper: "Load a statement first"
  };
}

function buildPersona(userType?: string | null) {
  switch (userType) {
    case "salaried":
      return {
        emoji: "💼",
        title: "Salaried",
        subtitle: "Monthly salary and regular bills"
      };
    case "daily_wage":
      return {
        emoji: "🛠️",
        title: "Daily Wage",
        subtitle: "Daily work, cash flow, and uneven income"
      };
    case "farmer_seasonal":
      return {
        emoji: "🌾",
        title: "Farmer / Seasonal",
        subtitle: "Income comes in waves across the season"
      };
    case "business_self_employed":
      return {
        emoji: "🏪",
        title: "Business / Self-Employed",
        subtitle: "Sales, expenses, and mixed money"
      };
    case "family_manager":
      return {
        emoji: "🏠",
        title: "Family Manager",
        subtitle: "Keeping household money visible"
      };
    default:
      return null;
  }
}

export default function HomeScreen() {
  const profile = useSessionStore((state) => state.profile);
  const displayName = useSessionStore((state) => state.displayName);
  const dashboard = useSessionStore((state) => state.dashboard);
  const refreshDashboard = useSessionStore((state) => state.refreshDashboard);
  const error = useSessionStore((state) => state.error);

  if (!profile) {
    return (
      <AppScreen title="Welcome" subtitle="Start setup to see the right home screen for you.">
        <EmptyStateCard title="Setup needed" body="Choose your user type and money rhythm to unlock the dashboard." />
        <Button label="Start Setup" onPress={() => router.push("/onboarding")} />
      </AppScreen>
    );
  }

  const cashflow = dashboard.cashflowSummary;
  const quickActions = [
    { label: "Import Statement", icon: "cloud-upload-outline", hint: "load sample or start with statement data" },
    { label: "Cash In Hand", icon: "wallet-outline", hint: "update real cash now" },
    { label: "Big Cash Spent", icon: "remove-circle-outline", hint: "fill the cash blind spot" },
    { label: "Due Paid", icon: "checkmark-circle-outline", hint: "mark EMI or bill paid" }
  ];
  const gauge = buildGaugeState(cashflow?.status);
  const persona = buildPersona(profile.user_type);
  const primaryBannerAction = cashflow
    ? {
        label: "Add Today's Cash Change",
        onPress: () => router.push("/add-entry")
      }
    : {
        label: "Start With Sample Statement",
        onPress: () => router.push("/import-statement")
      };

  return (
    <AppScreen
      title={`Hello, ${displayName}`}
      subtitle="Know what is truly safe before the next income arrives."
      headerRight={
        <Button
          label="Refresh"
          variant="secondary"
          onPress={() => {
            void refreshDashboard();
          }}
        />
      }
    >
      {persona ? (
        <View style={[commonStyles.card, styles.personaBanner]}>
          <View style={styles.personaAvatar}>
            <Text style={styles.personaEmoji}>{persona.emoji}</Text>
          </View>
          <View style={styles.personaCopy}>
            <Text style={styles.personaEyebrow}>Your Money Path</Text>
            <Text style={styles.personaTitle}>{persona.title}</Text>
            <Text style={styles.personaBody}>{persona.subtitle}</Text>
          </View>
        </View>
      ) : null}

      <View style={[commonStyles.card, styles.demoBanner]}>
        <Text style={styles.demoEyebrow}>Early Demo</Text>
        <Text style={styles.demoTitle}>This build is meant to test one idea well.</Text>
        <Text style={styles.demoBody}>Imported history plus quick cash updates should answer one question: will your money last till the next income?</Text>
        <View style={styles.bannerActions}>
          <Button label={primaryBannerAction.label} onPress={primaryBannerAction.onPress} />
        </View>
      </View>

      {error ? (
        <View style={[commonStyles.card, styles.errorCard]}>
          <Text style={styles.errorTitle}>Could not refresh everything</Text>
          <Text style={styles.errorBody}>{error}</Text>
        </View>
      ) : null}

      {cashflow ? (
        <>
          <View style={[commonStyles.card, commonStyles.shadow, styles.gaugeCard]}>
            <View style={styles.gaugeHeader}>
              <Text style={styles.gaugeEyebrow}>Money Fuel</Text>
              <View style={[styles.zonePill, { backgroundColor: gauge.color }]}>
                <Text style={styles.zonePillText}>{gauge.zone}</Text>
              </View>
            </View>

            <View style={styles.gaugeTrack}>
              <View style={[styles.gaugeSegment, styles.gaugeDanger]} />
              <View style={[styles.gaugeSegment, styles.gaugeWarning]} />
              <View style={[styles.gaugeSegment, styles.gaugeSafe]} />
              <View style={[styles.gaugeNeedle, { left: gauge.fill, borderBottomColor: gauge.color }]} />
            </View>

            <Text style={styles.gaugeHeadline}>{cashflow.headline}</Text>
            <Text style={styles.gaugeSummary}>{cashflow.plain_summary}</Text>
          </View>

          <View style={[commonStyles.card, styles.nextStepCard]}>
            <Text style={styles.nextStepEyebrow}>Try It Yourself</Text>
            <Text style={styles.nextStepTitle}>Tap one action and watch the answer change.</Text>
            <Text style={styles.nextStepBody}>Most people start by loading the sample statement, then update cash in hand or big cash spent to see whether the safe amount moves.</Text>
          </View>

          <View style={styles.metricRow}>
            <View style={[commonStyles.card, styles.metricCard]}>
              <Text style={styles.metricLabel}>Safe To Spend</Text>
              <Text style={styles.metricValue}>{formatMoney(cashflow.safe_to_spend)}</Text>
              <Text style={styles.metricHelper}>
                {cashflow.next_income_date ? `before ${new Date(cashflow.next_income_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "before next money in"}
              </Text>
            </View>
            <View style={[commonStyles.card, styles.metricCard]}>
              <Text style={styles.metricLabel}>Upcoming Dues</Text>
              <Text style={styles.metricValue}>{formatMoney(cashflow.upcoming_dues_total)}</Text>
              <Text style={styles.metricHelper}>kept aside first</Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <View style={[commonStyles.card, styles.metricCard]}>
              <Text style={styles.metricLabel}>Daily Needs Covered</Text>
              <Text style={styles.metricValue}>{formatMoney(cashflow.daily_needs_buffer)}</Text>
              <Text style={styles.metricHelper}>{`of ${formatMoney(cashflow.daily_needs_required)} needed till next income`}</Text>
            </View>
            <View style={[commonStyles.card, styles.metricCard]}>
              <Text style={styles.metricLabel}>Bank Money Seen This Cycle</Text>
              <Text style={styles.metricValue}>{formatMoney(cashflow.liquid_balance)}</Text>
              <Text style={styles.metricHelper}>estimated from statement activity</Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <View style={[commonStyles.card, styles.metricCard]}>
              <Text style={styles.metricLabel}>Cash On Hand</Text>
              <Text style={styles.metricValue}>{formatMoney(cashflow.cash_on_hand)}</Text>
              <Text style={styles.metricHelper}>based on your latest cash update</Text>
            </View>
          </View>

          <View style={[commonStyles.card, commonStyles.shadow, styles.highlightCard]}>
            <View style={styles.highlightHeader}>
              <Ionicons name="sparkles-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>Why We Think So</Text>
            </View>
            {cashflow.explanations.map((line) => (
              <Text key={line} style={styles.highlightText}>
                {line}
              </Text>
            ))}
          </View>
        </>
      ) : (
        <EmptyStateCard
          title="Bring one statement to start"
          body="Import one bank or UPI CSV, then add any important cash on hand. We will turn that into a safe-till-date answer."
        />
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>More Actions</Text>
        <View style={styles.grid}>
          {quickActions.map((action) => (
            <QuickActionTile
              key={action.label}
              label={action.label}
              hint={action.hint}
              icon={action.icon}
              onPress={() => {
                if (action.label === "Import Statement") {
                  router.push("/import-statement");
                  return;
                }
                router.push("/add-entry");
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Watchouts</Text>
        {cashflow?.watchouts.length ? (
          cashflow.watchouts.map((alert) => (
            <View key={alert} style={[commonStyles.card, styles.alertCard]}>
              <Text style={styles.alertText}>{alert}</Text>
            </View>
          ))
        ) : (
          <EmptyStateCard title="No watchouts yet" body="Once statement data is in, this area will call out dues, shortfalls, and where to stay careful." />
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  personaBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: "#FFF8EA"
  },
  personaAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFE8B0"
  },
  personaEmoji: {
    fontSize: 30
  },
  personaCopy: {
    flex: 1,
    gap: 2
  },
  personaEyebrow: {
    fontSize: theme.typography.caption,
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  personaTitle: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.text
  },
  personaBody: {
    fontSize: theme.typography.caption,
    lineHeight: 18,
    color: theme.colors.textMuted
  },
  demoBanner: {
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceMuted
  },
  demoEyebrow: {
    fontSize: theme.typography.caption,
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  demoTitle: {
    fontSize: theme.typography.section,
    fontWeight: "700",
    color: theme.colors.text
  },
  demoBody: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textMuted
  },
  bannerActions: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm
  },
  errorCard: {
    gap: theme.spacing.xs,
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
    lineHeight: 18,
    color: theme.colors.textMuted
  },
  gaugeCard: {
    gap: theme.spacing.md
  },
  gaugeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing.md
  },
  gaugeEyebrow: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  zonePill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill
  },
  zonePillText: {
    fontSize: theme.typography.caption,
    color: theme.colors.white,
    fontWeight: "700"
  },
  gaugeTrack: {
    position: "relative",
    flexDirection: "row",
    height: 18,
    borderRadius: theme.radius.pill,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceMuted
  },
  gaugeSegment: {
    flex: 1
  },
  gaugeDanger: {
    backgroundColor: "#D88B79"
  },
  gaugeWarning: {
    backgroundColor: "#E7C36A"
  },
  gaugeSafe: {
    backgroundColor: "#74B983"
  },
  gaugeNeedle: {
    position: "absolute",
    top: -10,
    marginLeft: -9,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 14,
    borderLeftColor: "transparent",
    borderRightColor: "transparent"
  },
  gaugeHeadline: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: theme.colors.text
  },
  gaugeSummary: {
    fontSize: theme.typography.body,
    lineHeight: 24,
    color: theme.colors.textMuted
  },
  metricRow: {
    flexDirection: "row",
    gap: theme.spacing.md
  },
  nextStepCard: {
    gap: theme.spacing.xs
  },
  nextStepEyebrow: {
    fontSize: theme.typography.caption,
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  nextStepTitle: {
    fontSize: theme.typography.section,
    fontWeight: "700",
    color: theme.colors.text
  },
  nextStepBody: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textMuted
  },
  metricCard: {
    flex: 1,
    gap: theme.spacing.xs
  },
  metricLabel: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "800",
    color: theme.colors.text
  },
  metricHelper: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  },
  section: {
    gap: theme.spacing.md
  },
  sectionTitle: {
    fontSize: theme.typography.section,
    fontWeight: "700",
    color: theme.colors.text
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md
  },
  highlightCard: {
    gap: theme.spacing.sm
  },
  highlightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  highlightText: {
    fontSize: theme.typography.body,
    lineHeight: 24,
    color: theme.colors.textMuted
  },
  alertCard: {
    paddingVertical: theme.spacing.md
  },
  alertText: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.text
  }
});
