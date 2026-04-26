import { router } from "expo-router";
import { StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { useSessionStore } from "../../store/session";
import { commonStyles, theme } from "../../theme";

export default function CashSetupScreen() {
  const draft = useSessionStore((state) => state.onboardingDraft);
  const setDraft = useSessionStore((state) => state.setDraft);

  return (
    <AppScreen title="Do you want to track cash in hand?" subtitle="Many people spend in cash. This helps show what is left.">
      <View style={[commonStyles.card, styles.row]}>
        <View style={styles.copy}>
          <Text style={styles.label}>Track cash</Text>
          <Text style={styles.help}>Wallet cash plus home cash if you want.</Text>
        </View>
        <Switch
          value={draft.tracksCash}
          onValueChange={(value) => setDraft({ tracksCash: value, startCashAmount: value ? draft.startCashAmount : "" })}
          trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
        />
      </View>

      {draft.tracksCash ? (
        <View style={[commonStyles.card, styles.field]}>
          <Text style={styles.label}>Starting cash amount</Text>
          <TextInput
            keyboardType="numeric"
            placeholder="Example: 2500"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            value={draft.startCashAmount}
            onChangeText={(value) => setDraft({ startCashAmount: value })}
          />
        </View>
      ) : null}

      <Button label="Continue" onPress={() => router.push("/onboarding/csv-import")} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.lg
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  label: {
    fontSize: theme.typography.body,
    fontWeight: "700",
    color: theme.colors.text
  },
  help: {
    fontSize: theme.typography.caption,
    lineHeight: 18,
    color: theme.colors.textMuted
  },
  field: {
    gap: theme.spacing.sm
  },
  input: {
    minHeight: 52,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.lg,
    fontSize: theme.typography.body,
    color: theme.colors.text
  }
});
