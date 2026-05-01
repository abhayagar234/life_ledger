import { router } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { useSessionStore } from "../../store/session";
import { commonStyles, theme } from "../../theme";

export default function YouScreen() {
  const profile = useSessionStore((state) => state.profile);
  const displayName = useSessionStore((state) => state.displayName);
  const userId = useSessionStore((state) => state.userId);
  const startFreshDemo = useSessionStore((state) => state.startFreshDemo);
  const sessionCode = userId ? userId.slice(-6).toUpperCase() : "NONE";

  return (
    <AppScreen title="Setup" subtitle="Keep your money path clear and reset the sample workspace when you need a clean run.">
      <View style={[commonStyles.card, styles.callout]}>
        <Text style={styles.calloutEyebrow}>Best Way To Use It</Text>
        <Text style={styles.calloutTitle}>Use Home as the main screen.</Text>
        <Text style={styles.calloutBody}>The clearest flow is sample statement history first, then a cash or due update so the answer changes in front of you.</Text>
      </View>

      <View style={[commonStyles.card, styles.card]}>
        <Text style={styles.label}>Current User</Text>
        <Text style={styles.value}>{displayName}</Text>
        <Text style={styles.help}>Test session: {sessionCode}</Text>
      </View>
      <View style={[commonStyles.card, styles.card]}>
        <Text style={styles.label}>User Type</Text>
        <Text style={styles.value}>{profile?.user_type?.replace(/_/g, " ") ?? "Not set"}</Text>
      </View>
      <View style={[commonStyles.card, styles.card]}>
        <Text style={styles.label}>Income Pattern</Text>
        <Text style={styles.value}>{profile?.income_pattern ?? "Not set"}</Text>
      </View>

      <View style={[commonStyles.card, styles.card]}>
        <Text style={styles.label}>Current Scope</Text>
        <Text style={styles.help}>Ready for testing the core cashflow idea and seeing how the safe-to-spend answer reacts to real changes.</Text>
      </View>

      <Button label="Edit Setup" variant="secondary" onPress={() => router.push("/onboarding")} />
      <Button
        label="Start Fresh Setup"
        onPress={async () => {
          try {
            await startFreshDemo();
            router.replace("/onboarding");
          } catch (error) {
            Alert.alert("Could not reset", error instanceof Error ? error.message : "Please try again.");
          }
        }}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  callout: {
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceMuted
  },
  calloutEyebrow: {
    fontSize: theme.typography.caption,
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  calloutTitle: {
    fontSize: theme.typography.section,
    fontWeight: "700",
    color: theme.colors.text
  },
  calloutBody: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textMuted
  },
  card: {
    gap: theme.spacing.xs
  },
  label: {
    fontSize: theme.typography.caption,
    color: theme.colors.textMuted
  },
  value: {
    fontSize: theme.typography.section,
    fontWeight: "700",
    color: theme.colors.text
  },
  help: {
    fontSize: theme.typography.body,
    lineHeight: 22,
    color: theme.colors.textMuted
  }
});
