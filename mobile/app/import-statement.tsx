import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../components/AppScreen";
import { Button } from "../components/Button";
import { ChoiceCard } from "../components/ChoiceCard";
import { loadSampleStatement } from "../services/api/moneyos";
import { useSessionStore } from "../store/session";
import { commonStyles, theme } from "../theme";

export default function ImportStatementScreen() {
  const userId = useSessionStore((state) => state.userId);
  const profile = useSessionStore((state) => state.profile);
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
    <AppScreen title="Start With A Statement" subtitle="Statement history does the heavy lifting first.">
      <View style={[commonStyles.card, styles.banner]}>
        <Text style={styles.bannerEyebrow}>Best Way To Try The App</Text>
        <Text style={styles.bannerTitle}>Load a sample statement in one tap.</Text>
        <Text style={styles.bannerBody}>That gives you a realistic salary, rent, bills, side income, and EMI story so you can test the main promise without hunting for a CSV right now.</Text>
      </View>

      <ChoiceCard
        title="Use Sample Statement"
        subtitle="Recommended for first-time use. Loads a clean example with salary, bills, and dues."
        icon="cloud-download-outline"
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

      <ChoiceCard
        title="Add Cash or Due Update"
        subtitle="If you already know the flow, jump straight to cash in hand, big cash spent, or due paid."
        icon="wallet-outline"
        onPress={() => router.push("/add-entry")}
      />

      <View style={[commonStyles.card, styles.infoCard]}>
        <Text style={styles.infoTitle}>Real CSV import is the next step.</Text>
        <Text style={styles.infoBody}>For now, sample statement data gives the cleanest first-run experience. The goal is to test whether the safe-till-date answer feels useful.</Text>
      </View>

      <Button label="Back To Home" variant="secondary" onPress={() => router.back()} />

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
