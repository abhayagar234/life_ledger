import { router } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { useSessionStore } from "../../store/session";
import { commonStyles, theme } from "../../theme";

export default function YouScreen() {
  const profile = useSessionStore((state) => state.profile);
  const displayName = useSessionStore((state) => state.displayName);
  const startFreshDemo = useSessionStore((state) => state.startFreshDemo);

  return (
    <AppScreen title="Demo Setup" subtitle="Keep the prototype honest and guide people to the one useful moment.">
      <View style={[commonStyles.card, styles.callout]}>
        <Text style={styles.calloutEyebrow}>What To Show</Text>
        <Text style={styles.calloutTitle}>Use Home as the main demo screen.</Text>
        <Text style={styles.calloutBody}>Tell people this is an early build, the statement history is sample data right now, and the most important action is updating cash reality to see the answer change.</Text>
      </View>

      <View style={[commonStyles.card, styles.card]}>
        <Text style={styles.label}>Demo User</Text>
        <Text style={styles.value}>{displayName}</Text>
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
        <Text style={styles.label}>Demo Scope</Text>
        <Text style={styles.help}>Ready for friend feedback on the core cashflow idea. Not yet ready for investor free exploration.</Text>
      </View>

      <Button label="Edit Setup" variant="secondary" onPress={() => router.push("/onboarding")} />
      <Button
        label="Start Fresh Demo"
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
