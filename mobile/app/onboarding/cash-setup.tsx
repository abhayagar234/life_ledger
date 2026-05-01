import { router } from "expo-router";
import { StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { AppScreen } from "../../components/AppScreen";
import { Button } from "../../components/Button";
import { t } from "../../i18n";
import { useSessionStore } from "../../store/session";
import { commonStyles, theme } from "../../theme";

export default function CashSetupScreen() {
  const draft = useSessionStore((state) => state.onboardingDraft);
  const language = useSessionStore((state) => state.onboardingDraft.preferredLanguage);
  const setDraft = useSessionStore((state) => state.setDraft);

  return (
    <AppScreen title={t(language, "cashSetupTitle")} subtitle={t(language, "cashSetupSubtitle")}>
      <View style={[commonStyles.card, styles.row]}>
        <View style={styles.copy}>
          <Text style={styles.label}>{t(language, "trackCash")}</Text>
          <Text style={styles.help}>{t(language, "trackCashHelp")}</Text>
        </View>
        <Switch
          value={draft.tracksCash}
          onValueChange={(value) => setDraft({ tracksCash: value, startCashAmount: value ? draft.startCashAmount : "" })}
          trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
        />
      </View>

      {draft.tracksCash ? (
        <View style={[commonStyles.card, styles.field]}>
          <Text style={styles.label}>{t(language, "startingCash")}</Text>
          <TextInput
            keyboardType="numeric"
            placeholder={t(language, "startingCashExample")}
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            value={draft.startCashAmount}
            onChangeText={(value) => setDraft({ startCashAmount: value })}
          />
        </View>
      ) : null}

      <Button label={t(language, "continue")} onPress={() => router.push("/onboarding/complete")} />
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
