import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../components/AppScreen";
import { Button } from "../components/Button";
import { t } from "../i18n";
import { loadSampleStatement } from "../services/api/moneyos";
import { useSessionStore } from "../store/session";
import { commonStyles, theme } from "../theme";

export default function ImportStatementScreen() {
  const userId = useSessionStore((state) => state.userId);
  const profile = useSessionStore((state) => state.profile);
  const language = useSessionStore((state) => state.onboardingDraft.preferredLanguage);
  const refreshDashboard = useSessionStore((state) => state.refreshDashboard);
  const [loadingSample, setLoadingSample] = useState(false);

  if (!profile) {
    return (
      <AppScreen title="Finish setup first" subtitle="We need your money path saved before we load statement history.">
        <View style={[commonStyles.card, styles.infoCard]}>
          <Text style={styles.infoTitle}>Save setup before sample data</Text>
          <Text style={styles.infoBody}>Once your setup is saved, we can load sample statement history and take you straight to the answer.</Text>
        </View>
        <Button label="Go Back To Setup" onPress={() => router.replace("/onboarding/complete")} />
      </AppScreen>
    );
  }

  return (
    <AppScreen title={t(language, "updateTodayMoney")} subtitle={t(language, "importSubtitle")}>
      <View style={[commonStyles.card, styles.banner]}>
        <Text style={styles.bannerEyebrow}>{t(language, "bestWay")}</Text>
        <Text style={styles.bannerTitle}>{t(language, "sampleTitle")}</Text>
        <Text style={styles.bannerBody}>{t(language, "sampleBody")}</Text>
      </View>

      <Button
        label={t(language, "useSample")}
        onPress={async () => {
          if (!userId) {
            Alert.alert("Missing session", "Please go back and reload the app once.");
            return;
          }

          setLoadingSample(true);
          try {
            const result = await loadSampleStatement(userId);
            await refreshDashboard();
            Alert.alert("Sample ready", result.message);
            router.replace("/(tabs)/home");
          } catch (error) {
            Alert.alert("Could not load sample", error instanceof Error ? error.message : "Please try again.");
          } finally {
            setLoadingSample(false);
          }
        }}
      />

      <Button
        label={t(language, "cashReceivedAction")}
        variant="secondary"
        onPress={() => router.push({ pathname: "/add-entry", params: { mode: "cash_received" } })}
      />

      <Button
        label={t(language, "bigCashSpentAction")}
        variant="secondary"
        onPress={() => router.push({ pathname: "/add-entry", params: { mode: "cash_spent" } })}
      />

      <Button
        label={t(language, "cashInHandAction")}
        variant="secondary"
        onPress={() => router.push({ pathname: "/add-entry", params: { mode: "cash_set" } })}
      />

      <Button
        label={t(language, "addUpcomingDueAction")}
        variant="secondary"
        onPress={() => router.push("/add-upcoming-due")}
      />

      <View style={[commonStyles.card, styles.infoCard]}>
        <Text style={styles.infoTitle}>{t(language, "realCsv")}</Text>
        <Text style={styles.infoBody}>
          This screen loads one predictable sample statement for demo testing. Manual cash and due updates can be done later from Home actions.
        </Text>
      </View>

      <Button label={t(language, "backHome")} variant="secondary" onPress={() => router.back()} />

      {loadingSample ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.help}>Loading sample transactions and rebuilding your answer.</Text>
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceMuted
  },
  bannerEyebrow: {
    fontSize: theme.typography.caption,
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  bannerTitle: {
    fontSize: theme.typography.section,
    fontWeight: "700",
    color: theme.colors.text
  },
  bannerBody: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textMuted
  },
  infoCard: {
    gap: theme.spacing.xs
  },
  infoTitle: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.text
  },
  infoBody: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textMuted
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  help: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  }
});
